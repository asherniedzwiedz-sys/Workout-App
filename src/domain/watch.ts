import type { Exercise, Routine } from './types';
import { nextPendingSet, type ActiveWorkout } from './workout';

// Phone ↔ Apple Watch protocol. The phone sends a full snapshot (JSON string under
// the "state" key of the WatchConnectivity application context); the watch sends
// small action messages back. Keep in sync with targets/watch/Models.swift.

export const WATCH_PROTOCOL_VERSION = 1;

export interface WatchSet {
  id: string;
  label: string;
  type: string;
  /** Effective values: what was logged, or the placeholder that one tap would log. */
  weight: number | null;
  reps: number | null;
  done: boolean;
}

export interface WatchExercise {
  key: string;
  name: string;
  restSec: number;
  skipped: boolean;
  sets: WatchSet[];
}

export interface WatchState {
  v: number;
  active: boolean;
  workoutName: string;
  startedAt: number;
  restEndsAt: number | null;
  restDuration: number;
  exercises: WatchExercise[];
  current: { exerciseKey: string; setId: string } | null;
  routines: { id: number; name: string; exerciseCount: number }[];
  sentAt: number;
}

function labelSets(types: string[]): string[] {
  let n = 0;
  return types.map((t) => {
    if (t === 'warmup') return 'W';
    if (t === 'drop') return 'D';
    if (t === 'failure') return 'F';
    n++;
    return String(n);
  });
}

export function buildWatchState(input: {
  workout: ActiveWorkout | null;
  exercises: Record<string, Exercise>;
  restEndsAt: number | null;
  restDuration: number;
  routines: Routine[];
  now: number;
}): WatchState {
  const { workout } = input;
  const next = workout ? nextPendingSet(workout) : null;
  return {
    v: WATCH_PROTOCOL_VERSION,
    active: workout !== null,
    workoutName: workout?.name ?? '',
    startedAt: workout?.startedAt ?? 0,
    restEndsAt: input.restEndsAt !== null && input.restEndsAt > input.now ? input.restEndsAt : null,
    restDuration: input.restDuration,
    exercises: (workout?.exercises ?? []).map((e) => {
      const labels = labelSets(e.sets.map((s) => s.type));
      return {
        key: e.key,
        name: input.exercises[e.exerciseId]?.name ?? 'Exercise',
        restSec: e.restSec,
        skipped: e.skipped,
        sets: e.sets.map((s, i) => ({
          id: s.id,
          label: labels[i] ?? String(i + 1),
          type: s.type,
          weight: s.weight ?? s.targetWeight,
          reps: s.reps ?? s.targetReps,
          done: s.completed,
        })),
      };
    }),
    current: next ? { exerciseKey: next.exercise.key, setId: next.set.id } : null,
    routines: input.routines
      .filter((r) => r.exercises.length > 0)
      .slice(0, 20)
      .map((r) => ({ id: r.id, name: r.name, exerciseCount: r.exercises.length })),
    sentAt: input.now,
  };
}

export type WatchAction =
  | { action: 'completeSet'; exerciseKey: string; setId: string; weight: number | null; reps: number | null }
  | { action: 'adjustRest'; delta: number }
  | { action: 'skipRest' }
  | { action: 'startRoutine'; routineId: number }
  | { action: 'finishWorkout' }
  | { action: 'requestState' };

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Validates a message from the watch; anything malformed is ignored. */
export function parseWatchAction(message: Record<string, unknown>): WatchAction | null {
  switch (message.action) {
    case 'completeSet': {
      if (typeof message.exerciseKey !== 'string' || typeof message.setId !== 'string') return null;
      const weight = num(message.weight);
      const reps = num(message.reps);
      return {
        action: 'completeSet',
        exerciseKey: message.exerciseKey,
        setId: message.setId,
        weight: weight !== null && weight >= 0 && weight < 2000 ? weight : null,
        reps: reps !== null && reps > 0 && reps < 1000 ? Math.round(reps) : null,
      };
    }
    case 'adjustRest': {
      const delta = num(message.delta);
      return delta !== null && Math.abs(delta) <= 600 ? { action: 'adjustRest', delta } : null;
    }
    case 'skipRest':
      return { action: 'skipRest' };
    case 'startRoutine': {
      const routineId = num(message.routineId);
      return routineId !== null ? { action: 'startRoutine', routineId } : null;
    }
    case 'finishWorkout':
      return { action: 'finishWorkout' };
    case 'requestState':
      return { action: 'requestState' };
    default:
      return null;
  }
}
