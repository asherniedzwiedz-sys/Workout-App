import { estimateOneRepMax } from './oneRepMax';
import type { SetType } from './types';

// Pure state transitions for an in-progress workout. The zustand store in
// src/state/activeWorkout.ts wraps these and persists the result.

export interface ActiveSet {
  id: string;
  type: SetType;
  /** What the user typed; null means "use the placeholder". */
  weight: number | null;
  reps: number | null;
  /** Placeholder shown in the inputs (routine target or last session). */
  targetWeight: number | null;
  targetReps: number | null;
  completed: boolean;
  completedAt: number | null;
}

export interface ActiveExercise {
  key: string;
  exerciseId: string;
  restSec: number;
  notes: string;
  skipped: boolean;
  sets: ActiveSet[];
}

export interface ActiveWorkout {
  id: string;
  name: string;
  routineId: number | null;
  startedAt: number;
  notes: string;
  exercises: ActiveExercise[];
}

export interface PreviousSet {
  type: SetType;
  weight: number;
  reps: number;
}

export interface ExercisePlan {
  exerciseId: string;
  restSec: number;
  sets: { targetWeight: number | null; targetReps: number | null; type?: SetType }[];
}

let counter = 0;
export function makeId(prefix = 'id'): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function newSet(targetWeight: number | null, targetReps: number | null, type: SetType = 'normal'): ActiveSet {
  return {
    id: makeId('set'),
    type,
    weight: null,
    reps: null,
    targetWeight,
    targetReps,
    completed: false,
    completedAt: null,
  };
}

export function createWorkout(
  input: { name: string; routineId: number | null; exercises: ExercisePlan[] },
  now: number,
): ActiveWorkout {
  return {
    id: makeId('workout'),
    name: input.name,
    routineId: input.routineId,
    startedAt: now,
    notes: '',
    exercises: input.exercises.map((plan) => planToExercise(plan)),
  };
}

function planToExercise(plan: ExercisePlan): ActiveExercise {
  return {
    key: makeId('ex'),
    exerciseId: plan.exerciseId,
    restSec: plan.restSec,
    notes: '',
    skipped: false,
    sets: plan.sets.map((s) => newSet(s.targetWeight, s.targetReps, s.type)),
  };
}

/** Builds a plan for an exercise added on the fly, seeded from the last session if there is one. */
export function planFromPrevious(
  exerciseId: string,
  restSec: number,
  previous: PreviousSet[] | undefined,
  defaultSets = 3,
): ExercisePlan {
  if (previous && previous.length > 0) {
    return {
      exerciseId,
      restSec,
      sets: previous.map((p) => ({ targetWeight: p.weight, targetReps: p.reps, type: p.type })),
    };
  }
  return {
    exerciseId,
    restSec,
    sets: Array.from({ length: defaultSets }, () => ({ targetWeight: null, targetReps: null })),
  };
}

function mapExercise(
  workout: ActiveWorkout,
  key: string,
  fn: (e: ActiveExercise) => ActiveExercise,
): ActiveWorkout {
  return { ...workout, exercises: workout.exercises.map((e) => (e.key === key ? fn(e) : e)) };
}

export function addExercise(workout: ActiveWorkout, plan: ExercisePlan): ActiveWorkout {
  return { ...workout, exercises: [...workout.exercises, planToExercise(plan)] };
}

export function removeExercise(workout: ActiveWorkout, key: string): ActiveWorkout {
  return { ...workout, exercises: workout.exercises.filter((e) => e.key !== key) };
}

/** Replaces the exercise in place, keeping its position and set count. */
export function swapExercise(workout: ActiveWorkout, key: string, plan: ExercisePlan): ActiveWorkout {
  return mapExercise(workout, key, (e) => {
    const count = Math.max(e.sets.length, 1);
    const seeded = plan.sets.length > 0 ? plan.sets : [{ targetWeight: null, targetReps: null }];
    const sets: ActiveSet[] = Array.from({ length: count }, (_, i) => {
      const source = seeded[Math.min(i, seeded.length - 1)] ?? { targetWeight: null, targetReps: null };
      return newSet(source.targetWeight, source.targetReps ?? e.sets[i]?.targetReps ?? null, source.type);
    });
    return { ...e, exerciseId: plan.exerciseId, restSec: plan.restSec, skipped: false, sets };
  });
}

export function setSkipped(workout: ActiveWorkout, key: string, skipped: boolean): ActiveWorkout {
  return mapExercise(workout, key, (e) => ({ ...e, skipped }));
}

export function moveExercise(workout: ActiveWorkout, key: string, direction: -1 | 1): ActiveWorkout {
  const index = workout.exercises.findIndex((e) => e.key === key);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= workout.exercises.length) return workout;
  const exercises = [...workout.exercises];
  const [item] = exercises.splice(index, 1);
  if (!item) return workout;
  exercises.splice(target, 0, item);
  return { ...workout, exercises };
}

export function setRest(workout: ActiveWorkout, key: string, restSec: number): ActiveWorkout {
  return mapExercise(workout, key, (e) => ({ ...e, restSec: Math.max(0, Math.round(restSec)) }));
}

export function setExerciseNotes(workout: ActiveWorkout, key: string, notes: string): ActiveWorkout {
  return mapExercise(workout, key, (e) => ({ ...e, notes }));
}

/** Adds a set that inherits the last set's values as its placeholder. */
export function addSet(workout: ActiveWorkout, key: string): ActiveWorkout {
  return mapExercise(workout, key, (e) => {
    const last = e.sets[e.sets.length - 1];
    const targetWeight = last ? (last.weight ?? last.targetWeight) : null;
    const targetReps = last ? (last.reps ?? last.targetReps) : null;
    const type: SetType = last && last.type !== 'warmup' ? last.type : 'normal';
    return { ...e, skipped: false, sets: [...e.sets, newSet(targetWeight, targetReps, type)] };
  });
}

/** Inserts warm-up sets at the top of an exercise. */
export function addWarmupSets(
  workout: ActiveWorkout,
  key: string,
  warmups: { weight: number; reps: number }[],
): ActiveWorkout {
  return mapExercise(workout, key, (e) => ({
    ...e,
    sets: [...warmups.map((w) => newSet(w.weight, w.reps, 'warmup')), ...e.sets],
  }));
}

export function removeSet(workout: ActiveWorkout, key: string, setId: string): ActiveWorkout {
  return mapExercise(workout, key, (e) => ({ ...e, sets: e.sets.filter((s) => s.id !== setId) }));
}

export function updateSet(
  workout: ActiveWorkout,
  key: string,
  setId: string,
  patch: Partial<Pick<ActiveSet, 'weight' | 'reps' | 'type'>>,
): ActiveWorkout {
  return mapExercise(workout, key, (e) => ({
    ...e,
    sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
  }));
}

export type ToggleResult =
  | { ok: true; workout: ActiveWorkout; completed: boolean }
  | { ok: false; reason: 'missing-reps' | 'not-found' };

/**
 * Completes (or un-completes) a set. Empty inputs take the placeholder values,
 * so a prefilled set is logged with a single tap.
 */
export function toggleSetComplete(
  workout: ActiveWorkout,
  key: string,
  setId: string,
  now: number,
): ToggleResult {
  const exercise = workout.exercises.find((e) => e.key === key);
  const set = exercise?.sets.find((s) => s.id === setId);
  if (!exercise || !set) return { ok: false, reason: 'not-found' };

  if (set.completed) {
    return {
      ok: true,
      completed: false,
      workout: mapExercise(workout, key, (e) => ({
        ...e,
        sets: e.sets.map((s) => (s.id === setId ? { ...s, completed: false, completedAt: null } : s)),
      })),
    };
  }

  const reps = set.reps ?? set.targetReps;
  const weight = set.weight ?? set.targetWeight ?? 0;
  if (reps === null || !(reps > 0)) return { ok: false, reason: 'missing-reps' };

  return {
    ok: true,
    completed: true,
    workout: mapExercise(workout, key, (e) => {
      const index = e.sets.findIndex((s) => s.id === setId);
      return {
        ...e,
        skipped: false,
        sets: e.sets.map((s, i) => {
          if (s.id === setId) return { ...s, weight, reps, completed: true, completedAt: now };
          // Later blank sets of the same type inherit what was just lifted, so each
          // following set is also a single tap.
          if (i > index && !s.completed && s.type === set.type) {
            return {
              ...s,
              targetWeight: s.targetWeight ?? weight,
              targetReps: s.targetReps ?? reps,
            };
          }
          return s;
        }),
      };
    }),
  };
}

export interface WorkoutTotals {
  completedSets: number;
  totalSets: number;
  volume: number;
}

export function workoutTotals(workout: ActiveWorkout): WorkoutTotals {
  let completedSets = 0;
  let totalSets = 0;
  let volume = 0;
  for (const e of workout.exercises) {
    if (e.skipped) continue;
    for (const s of e.sets) {
      totalSets++;
      if (s.completed) {
        completedSets++;
        volume += (s.weight ?? 0) * (s.reps ?? 0);
      }
    }
  }
  return { completedSets, totalSets, volume };
}

/** Finds the next set to do: first incomplete set of the first unfinished, non-skipped exercise. */
export function nextPendingSet(
  workout: ActiveWorkout,
): { exercise: ActiveExercise; set: ActiveSet; setIndex: number } | null {
  for (const exercise of workout.exercises) {
    if (exercise.skipped) continue;
    const setIndex = exercise.sets.findIndex((s) => !s.completed);
    const set = exercise.sets[setIndex];
    if (set) return { exercise, set, setIndex };
  }
  return null;
}

export interface FinishedSet {
  type: SetType;
  weight: number;
  reps: number;
  e1rm: number;
  completedAt: number;
}

export interface FinishedWorkout {
  name: string;
  routineId: number | null;
  startedAt: number;
  endedAt: number;
  notes: string;
  exercises: { exerciseId: string; notes: string; sets: FinishedSet[] }[];
  totalVolume: number;
  totalSets: number;
}

/** Drops skipped exercises and incomplete sets, producing what gets saved to history. */
export function finishWorkout(workout: ActiveWorkout, now: number): FinishedWorkout {
  const exercises = workout.exercises
    .filter((e) => !e.skipped)
    .map((e) => ({
      exerciseId: e.exerciseId,
      notes: e.notes,
      sets: e.sets
        .filter((s) => s.completed && s.reps !== null && s.reps > 0)
        .map((s) => {
          const weight = s.weight ?? 0;
          const reps = s.reps ?? 0;
          return {
            type: s.type,
            weight,
            reps,
            e1rm: s.type === 'warmup' ? 0 : estimateOneRepMax(weight, reps),
            completedAt: s.completedAt ?? now,
          };
        }),
    }))
    .filter((e) => e.sets.length > 0);

  let totalVolume = 0;
  let totalSets = 0;
  for (const e of exercises) {
    for (const s of e.sets) {
      totalSets++;
      totalVolume += s.weight * s.reps;
    }
  }
  return {
    name: workout.name,
    routineId: workout.routineId,
    startedAt: workout.startedAt,
    endedAt: now,
    notes: workout.notes,
    exercises,
    totalVolume,
    totalSets,
  };
}
