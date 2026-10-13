import { getDb } from '@/db/client';
import { getRun, markRunHealthSynced } from '@/db/runs';
import { getWorkoutDetail, listUnsyncedWorkouts, markWorkoutHealthSynced } from '@/db/workouts';
import { runningActiveKcal, strengthActiveKcal } from '@/domain/energy';
import { getSettings } from '@/state/settings';

import { isExpoGo } from './runtime';

// Writes finished workouts and manual runs to Apple Health with
// @kingstinct/react-native-healthkit. The native module only exists in a
// development/production build, so it is required lazily and never in Expo Go.

export type HealthSupport = 'available' | 'expo-go' | 'unsupported';
type HealthKit = typeof import('@kingstinct/react-native-healthkit');

let module: HealthKit | null | undefined;

function healthKit(): HealthKit | null {
  if (module !== undefined) return module;
  if (isExpoGo) {
    module = null;
    return module;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const hk = require('@kingstinct/react-native-healthkit') as HealthKit;
    module = hk.isHealthDataAvailable() ? hk : null;
  } catch (error) {
    console.warn('HealthKit unavailable', error);
    module = null;
  }
  return module;
}

export function healthSupport(): HealthSupport {
  if (isExpoGo) return 'expo-go';
  return healthKit() ? 'available' : 'unsupported';
}

const WRITE_TYPES = [
  'HKWorkoutTypeIdentifier',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
] as const;

/** Shows the Health permission sheet (only the first time; iOS remembers the answer). */
export async function connectHealth(): Promise<boolean> {
  const hk = healthKit();
  if (!hk) return false;
  try {
    return await hk.requestAuthorization({ toShare: WRITE_TYPES });
  } catch (error) {
    console.warn('Health authorization failed', error);
    return false;
  }
}

function enabled(): boolean {
  return getSettings().healthSync && healthKit() !== null;
}

export async function syncWorkoutToHealth(workoutId: number): Promise<boolean> {
  const hk = healthKit();
  if (!hk || !enabled()) return false;
  const workout = await getWorkoutDetail(workoutId);
  if (!workout || workout.healthSynced) return false;
  const start = new Date(workout.startedAt);
  const end = new Date(Math.max(workout.endedAt, workout.startedAt + 60_000));
  const kcal = strengthActiveKcal(getSettings().bodyWeightLbs ?? 0, workout.durationSec);
  try {
    await hk.requestAuthorization({ toShare: WRITE_TYPES });
    await hk.saveWorkoutSample(
      hk.WorkoutActivityType.traditionalStrengthTraining,
      kcal > 0
        ? [{ quantityType: 'HKQuantityTypeIdentifierActiveEnergyBurned', quantity: kcal, unit: 'kcal', startDate: start, endDate: end }]
        : [],
      start,
      end,
      kcal > 0 ? { energyBurned: kcal } : undefined,
      { HKExternalUUID: `ironlog-workout-${workout.id}`, HKIndoorWorkout: true },
    );
    await markWorkoutHealthSynced(workout.id);
    return true;
  } catch (error) {
    console.warn('Saving workout to Health failed', error);
    return false;
  }
}

/** Manual runs only: Strava runs normally reach Health from the watch or phone that recorded them. */
export async function syncRunToHealth(runId: number): Promise<boolean> {
  const hk = healthKit();
  if (!hk || !enabled()) return false;
  const run = await getRun(runId);
  if (!run || run.source !== 'manual' || run.healthSynced) return false;
  const start = new Date(run.startedAt);
  const end = new Date(run.startedAt + Math.max(run.elapsedTimeSec, run.movingTimeSec, 60) * 1000);
  const kcal = runningActiveKcal(getSettings().bodyWeightLbs ?? 0, run.distanceM);
  try {
    await hk.requestAuthorization({ toShare: WRITE_TYPES });
    await hk.saveWorkoutSample(
      hk.WorkoutActivityType.running,
      [
        { quantityType: 'HKQuantityTypeIdentifierDistanceWalkingRunning', quantity: run.distanceM, unit: 'm', startDate: start, endDate: end },
        ...(kcal > 0
          ? [{ quantityType: 'HKQuantityTypeIdentifierActiveEnergyBurned' as const, quantity: kcal, unit: 'kcal', startDate: start, endDate: end }]
          : []),
      ],
      start,
      end,
      { distance: run.distanceM, ...(kcal > 0 ? { energyBurned: kcal } : {}) },
      { HKExternalUUID: `ironlog-run-${run.id}` },
    );
    await markRunHealthSynced(run.id);
    return true;
  } catch (error) {
    console.warn('Saving run to Health failed', error);
    return false;
  }
}

/** Backfills everything not yet written (e.g. after turning sync on). */
export async function syncPendingToHealth(): Promise<{ workouts: number; runs: number }> {
  if (!enabled()) return { workouts: 0, runs: 0 };
  let workouts = 0;
  let runs = 0;
  for (const w of await listUnsyncedWorkouts()) if (await syncWorkoutToHealth(w.id)) workouts++;
  const pendingRuns = await getDb().getAllAsync<{ id: number }>(
    "SELECT id FROM runs WHERE source = 'manual' AND health_synced = 0 ORDER BY started_at",
  );
  for (const r of pendingRuns) if (await syncRunToHealth(r.id)) runs++;
  return { workouts, runs };
}
