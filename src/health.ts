import { getWorkout, markHealthSynced, unsyncedWorkoutIds } from './db';
import { hasDevBuildModules } from './native';
import { getSettings } from './settings';

type HealthKit = typeof import('@kingstinct/react-native-healthkit');
let hk: HealthKit | null | undefined;

/** Lazy so Expo Go never touches the native module (it isn't bundled there). */
function healthKit(): HealthKit | null {
  if (hk === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- must not load in Expo Go
      hk = hasDevBuildModules ? (require('@kingstinct/react-native-healthkit') as HealthKit) : null;
      if (hk && !hk.isHealthDataAvailable()) hk = null;
    } catch {
      hk = null;
    }
  }
  return hk;
}

export const healthAvailable = () => !!healthKit();

/** Writes a finished workout to Apple Health once. Returns false when unavailable, disabled, or denied. */
export async function saveWorkoutToHealth(workoutId: number): Promise<boolean> {
  const H = healthKit();
  const w = getWorkout(workoutId);
  if (!H || !getSettings().healthSync || !w?.ended_at || w.health_synced) return false;
  try {
    await H.requestAuthorization({ toShare: ['HKWorkoutTypeIdentifier'] });
    await H.saveWorkoutSample(H.WorkoutActivityType.traditionalStrengthTraining, [], new Date(w.started_at), new Date(w.ended_at));
    markHealthSynced(workoutId);
    return true;
  } catch (e) {
    console.warn('Apple Health save failed', e);
    return false;
  }
}

/** Backfills workouts logged before Health was available (e.g. in Expo Go). */
export async function syncAllToHealth(): Promise<number> {
  let n = 0;
  for (const id of unsyncedWorkoutIds()) if (await saveWorkoutToHealth(id)) n++;
  return n;
}
