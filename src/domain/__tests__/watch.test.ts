import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary';

import { buildWatchState, parseWatchAction } from '../watch';
import { addWarmupSets, createWorkout, toggleSetComplete, type ActiveWorkout } from '../workout';
import type { Routine } from '../types';

const byId = Object.fromEntries(EXERCISE_LIBRARY.map((e) => [e.id, e]));

function workout(): ActiveWorkout {
  let w = createWorkout(
    {
      name: 'Push A',
      routineId: 1,
      exercises: [
        { exerciseId: 'barbell-bench-press', restSec: 150, sets: [{ targetWeight: 185, targetReps: 5 }, { targetWeight: 185, targetReps: 5 }] },
        { exerciseId: 'triceps-pushdown', restSec: 60, sets: [{ targetWeight: 50, targetReps: 12 }] },
      ],
    },
    1000,
  );
  w = addWarmupSets(w, w.exercises[0]!.key, [{ weight: 95, reps: 5 }]);
  return w;
}

const routine: Routine = { id: 4, name: 'Pull', notes: null, source: 'manual', createdAt: 0, updatedAt: 0, exercises: [{ exerciseId: 'pull-up', sets: 3, reps: 8, weight: 0, restSec: 120 }] };
const empty: Routine = { ...routine, id: 5, name: 'Empty', exercises: [] };

describe('buildWatchState', () => {
  it('describes the active workout with labels, effective values and the next set', () => {
    let w = workout();
    const bench = w.exercises[0]!;
    const result = toggleSetComplete(w, bench.key, bench.sets[0]!.id, 2000);
    if (result.ok) w = result.workout;
    const state = buildWatchState({ workout: w, exercises: byId, restEndsAt: 5000, restDuration: 60, routines: [routine, empty], now: 3000 });
    expect(state.active).toBe(true);
    expect(state.exercises[0]!.name).toBe('Bench Press (Barbell)');
    expect(state.exercises[0]!.sets.map((s) => s.label)).toEqual(['W', '1', '2']);
    expect(state.exercises[0]!.sets[0]).toMatchObject({ weight: 95, reps: 5, done: true });
    expect(state.exercises[0]!.sets[1]).toMatchObject({ weight: 185, reps: 5, done: false });
    expect(state.current).toEqual({ exerciseKey: bench.key, setId: bench.sets[1]!.id });
    expect(state.restEndsAt).toBe(5000);
    expect(state.routines).toEqual([{ id: 4, name: 'Pull', exerciseCount: 1 }]);
    // Must survive a JSON round trip (that's how it crosses to the watch).
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('drops a rest timer that already ended and handles no workout', () => {
    const state = buildWatchState({ workout: null, exercises: byId, restEndsAt: 1000, restDuration: 60, routines: [], now: 5000 });
    expect(state).toMatchObject({ active: false, restEndsAt: null, exercises: [], current: null });
  });
});

describe('parseWatchAction', () => {
  it('accepts valid actions and sanitizes values', () => {
    expect(parseWatchAction({ action: 'completeSet', exerciseKey: 'a', setId: 'b', weight: 185, reps: 5.4 })).toEqual({
      action: 'completeSet',
      exerciseKey: 'a',
      setId: 'b',
      weight: 185,
      reps: 5,
    });
    expect(parseWatchAction({ action: 'completeSet', exerciseKey: 'a', setId: 'b', weight: -5, reps: 0 })).toMatchObject({ weight: null, reps: null });
    expect(parseWatchAction({ action: 'adjustRest', delta: 15 })).toEqual({ action: 'adjustRest', delta: 15 });
    expect(parseWatchAction({ action: 'startRoutine', routineId: 3 })).toEqual({ action: 'startRoutine', routineId: 3 });
  });

  it('rejects malformed messages', () => {
    expect(parseWatchAction({ action: 'completeSet', exerciseKey: 1 })).toBeNull();
    expect(parseWatchAction({ action: 'adjustRest', delta: 9999 })).toBeNull();
    expect(parseWatchAction({ action: 'dropTables' })).toBeNull();
    expect(parseWatchAction({})).toBeNull();
  });
});
