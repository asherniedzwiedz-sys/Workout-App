import { router } from 'expo-router';

import WatchBridge, { type WatchStatus } from '../../modules/watch-bridge';

import { getRoutine, listRoutines } from '@/db/routines';
import type { Routine } from '@/domain/types';
import { buildWatchState, parseWatchAction, type WatchAction } from '@/domain/watch';
import { updateSet } from '@/domain/workout';
import { useActiveWorkout } from '@/state/activeWorkout';
import { useDataVersion } from '@/state/dataVersion';
import { useExercises } from '@/state/exercises';
import { useRestTimer } from '@/state/restTimer';
import { getSettings, useSettings } from '@/state/settings';

// Keeps the Apple Watch app in sync with the phone. The native bridge only exists in
// an iOS development build; in Expo Go `WatchBridge` is null and this is a no-op
// (rest-timer and reminder notifications still reach the watch the normal way).

export function watchBridgeAvailable(): boolean {
  return WatchBridge !== null;
}

export function getWatchStatus(): WatchStatus | null {
  try {
    return WatchBridge?.getStatus() ?? null;
  } catch {
    return null;
  }
}

let routinesCache: Routine[] = [];
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function pushNow(): void {
  if (!WatchBridge || !getSettings().watchSync) return;
  const timer = useRestTimer.getState();
  const state = buildWatchState({
    workout: useActiveWorkout.getState().workout,
    exercises: useExercises.getState().byId,
    restEndsAt: timer.endsAt,
    restDuration: timer.durationSec,
    routines: routinesCache,
    now: Date.now(),
  });
  try {
    WatchBridge.updateState(JSON.stringify(state));
  } catch (error) {
    console.warn('Watch update failed', error);
  }
}

function schedulePush(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushNow();
  }, 250);
}

async function refreshRoutines(): Promise<void> {
  try {
    routinesCache = await listRoutines();
  } catch {
    routinesCache = [];
  }
  schedulePush();
}

export async function handleWatchAction(action: WatchAction): Promise<void> {
  const store = useActiveWorkout.getState();
  switch (action.action) {
    case 'completeSet': {
      const workout = store.workout;
      const exercise = workout?.exercises.find((e) => e.key === action.exerciseKey);
      const set = exercise?.sets.find((s) => s.id === action.setId);
      if (!workout || !exercise || !set || set.completed) break;
      const patch: { weight?: number; reps?: number } = {};
      if (action.weight !== null) patch.weight = action.weight;
      if (action.reps !== null) patch.reps = action.reps;
      if (Object.keys(patch).length) store.apply((w) => updateSet(w, action.exerciseKey, action.setId, patch));
      useActiveWorkout.getState().toggleSet(action.exerciseKey, action.setId);
      break;
    }
    case 'adjustRest':
      useRestTimer.getState().adjust(action.delta);
      break;
    case 'skipRest':
      useRestTimer.getState().stop();
      break;
    case 'startRoutine': {
      if (store.workout) break;
      const routine = await getRoutine(action.routineId);
      if (!routine) break;
      await store.startRoutine(routine);
      router.push('/workout');
      break;
    }
    case 'finishWorkout': {
      const result = await store.finish();
      if (result) router.replace(`/history/${result.workoutId}?finished=1`);
      break;
    }
    case 'requestState':
      break;
  }
  schedulePush();
}

/** Call once after the database and stores are loaded. */
export function startWatchSync(): void {
  if (started || !WatchBridge) return;
  started = true;
  WatchBridge.addListener('onMessage', (message) => {
    const action = parseWatchAction(message);
    if (action) void handleWatchAction(action);
  });
  WatchBridge.addListener('onStatusChange', (status) => {
    if (status.reachable) schedulePush();
  });
  useActiveWorkout.subscribe(schedulePush);
  useRestTimer.subscribe(schedulePush);
  useSettings.subscribe(schedulePush);
  useDataVersion.subscribe(() => void refreshRoutines());
  void refreshRoutines();
}
