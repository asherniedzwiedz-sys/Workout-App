import { create } from 'zustand';

import { deleteKv, getKv, setKv } from '@/db/kv';
import { getPreviousSets, saveFinishedWorkout } from '@/db/workouts';
import { formatSet } from '@/domain/format';
import type { Routine } from '@/domain/types';
import {
  addExercise,
  createWorkout,
  finishWorkout,
  nextPendingSet,
  planFromPrevious,
  swapExercise,
  toggleSetComplete,
  type ActiveWorkout,
  type ExercisePlan,
  type FinishedWorkout,
  type PreviousSet,
} from '@/domain/workout';
import { setCompleted, errorBuzz } from '@/services/feedback';
import { syncWorkoutToHealth } from '@/services/health';

import { notifyDataChanged } from './dataVersion';
import { exerciseName, getExercise } from './exercises';
import { useRestTimer } from './restTimer';
import { getSettings } from './settings';

const STORAGE_KEY = 'active_workout';

interface ActiveWorkoutState {
  workout: ActiveWorkout | null;
  /** Last session's sets per exercise id, for the "Previous" column. */
  previous: Record<string, PreviousSet[]>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  startEmpty: () => Promise<void>;
  startRoutine: (routine: Routine) => Promise<void>;
  /** Applies a pure transition from src/domain/workout.ts and persists it. */
  apply: (fn: (w: ActiveWorkout) => ActiveWorkout) => void;
  toggleSet: (exerciseKey: string, setId: string) => boolean;
  addExercises: (exerciseIds: string[]) => Promise<void>;
  swap: (exerciseKey: string, exerciseId: string) => Promise<void>;
  finish: () => Promise<{ workoutId: number; finished: FinishedWorkout } | null>;
  discard: () => Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function persist(workout: ActiveWorkout | null): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const write = workout ? setKv(STORAGE_KEY, workout) : deleteKv(STORAGE_KEY);
    write.catch((error: unknown) => console.warn('Could not save active workout', error));
  }, 300);
}

async function clearPersisted(): Promise<void> {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  await deleteKv(STORAGE_KEY);
}

function restFor(exerciseId: string): number {
  return getExercise(exerciseId)?.defaultRestSec ?? 120;
}

/** Text for the rest notification / watch: what to do when rest ends. */
export function describeNext(workout: ActiveWorkout): string {
  const next = nextPendingSet(workout);
  if (!next) return 'All sets done — finish your workout.';
  const { exercise, set, setIndex } = next;
  const weight = set.weight ?? set.targetWeight ?? 0;
  const reps = set.reps ?? set.targetReps;
  const target = reps ? ` · ${formatSet(weight, reps)}` : '';
  return `${exerciseName(exercise.exerciseId)}: set ${setIndex + 1} of ${exercise.sets.length}${target}`;
}

export const useActiveWorkout = create<ActiveWorkoutState>((set, get) => ({
  workout: null,
  previous: {},
  hydrated: false,

  hydrate: async () => {
    const stored = await getKv<ActiveWorkout | null>(STORAGE_KEY, null);
    set({ workout: stored, hydrated: true });
    if (stored) {
      const previous = await getPreviousSets(stored.exercises.map((e) => e.exerciseId));
      set({ previous });
    }
  },

  startEmpty: async () => {
    const workout = createWorkout({ name: defaultWorkoutName(), routineId: null, exercises: [] }, Date.now());
    set({ workout, previous: {} });
    persist(workout);
  },

  startRoutine: async (routine) => {
    const previous = await getPreviousSets(routine.exercises.map((e) => e.exerciseId));
    const plans: ExercisePlan[] = routine.exercises.map((re) => {
      const prev = previous[re.exerciseId]?.filter((s) => s.type !== 'warmup') ?? [];
      return {
        exerciseId: re.exerciseId,
        restSec: re.restSec,
        sets: Array.from({ length: re.sets }, (_, i) => ({
          // A routine weight of 0 means "use whatever I did last time".
          targetWeight: re.weight > 0 ? re.weight : (prev[i]?.weight ?? prev[prev.length - 1]?.weight ?? null),
          targetReps: re.reps,
        })),
      };
    });
    const workout = createWorkout({ name: routine.name, routineId: routine.id, exercises: plans }, Date.now());
    set({ workout, previous });
    persist(workout);
  },

  apply: (fn) => {
    const current = get().workout;
    if (!current) return;
    const next = fn(current);
    set({ workout: next });
    persist(next);
  },

  toggleSet: (exerciseKey, setId) => {
    const current = get().workout;
    if (!current) return false;
    const result = toggleSetComplete(current, exerciseKey, setId, Date.now());
    if (!result.ok) {
      errorBuzz();
      return false;
    }
    set({ workout: result.workout });
    persist(result.workout);
    const timer = useRestTimer.getState();
    if (result.completed) {
      setCompleted();
      const exercise = result.workout.exercises.find((e) => e.key === exerciseKey);
      const completedSet = exercise?.sets.find((s) => s.id === setId);
      const settings = getSettings();
      if (exercise && settings.autoStartRest && exercise.restSec > 0 && completedSet?.type !== 'warmup') {
        timer.start(exercise.restSec, exerciseName(exercise.exerciseId), describeNext(result.workout));
      } else if (exercise && completedSet?.type === 'warmup' && settings.autoStartRest) {
        // Short breather between warm-up sets.
        timer.start(Math.min(60, exercise.restSec), exerciseName(exercise.exerciseId), describeNext(result.workout));
      }
    }
    return true;
  },

  addExercises: async (exerciseIds) => {
    if (!get().workout || exerciseIds.length === 0) return;
    const fetched = await getPreviousSets(exerciseIds);
    const previous = { ...get().previous, ...fetched };
    let workout = get().workout;
    if (!workout) return;
    for (const id of exerciseIds) {
      workout = addExercise(workout, planFromPrevious(id, restFor(id), previous[id]));
    }
    set({ workout, previous });
    persist(workout);
  },

  swap: async (exerciseKey, exerciseId) => {
    const fetched = await getPreviousSets([exerciseId]);
    const previous = { ...get().previous, ...fetched };
    const current = get().workout;
    if (!current) return;
    const workout = swapExercise(current, exerciseKey, planFromPrevious(exerciseId, restFor(exerciseId), previous[exerciseId]));
    set({ workout, previous });
    persist(workout);
  },

  finish: async () => {
    const current = get().workout;
    if (!current) return null;
    const finished = finishWorkout(current, Date.now());
    if (finished.exercises.length === 0) return null;
    const workoutId = await saveFinishedWorkout(finished);
    useRestTimer.getState().stop();
    set({ workout: null, previous: {} });
    await clearPersisted();
    notifyDataChanged();
    void syncWorkoutToHealth(workoutId).then((saved) => saved && notifyDataChanged());
    return { workoutId, finished };
  },

  discard: async () => {
    useRestTimer.getState().stop();
    set({ workout: null, previous: {} });
    await clearPersisted();
  },
}));

function defaultWorkoutName(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Night Workout';
  if (hour < 12) return 'Morning Workout';
  if (hour < 17) return 'Afternoon Workout';
  if (hour < 21) return 'Evening Workout';
  return 'Night Workout';
}
