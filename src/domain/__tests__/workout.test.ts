import {
  addSet,
  addWarmupSets,
  createWorkout,
  finishWorkout,
  moveExercise,
  nextPendingSet,
  planFromPrevious,
  removeSet,
  setSkipped,
  swapExercise,
  toggleSetComplete,
  updateSet,
  workoutTotals,
  type ActiveWorkout,
} from '../workout';

function sample(): ActiveWorkout {
  return createWorkout(
    {
      name: 'Push',
      routineId: 1,
      exercises: [
        {
          exerciseId: 'barbell-bench-press',
          restSec: 180,
          sets: [
            { targetWeight: 185, targetReps: 5 },
            { targetWeight: 185, targetReps: 5 },
            { targetWeight: 185, targetReps: 5 },
          ],
        },
        { exerciseId: 'push-up', restSec: 60, sets: [{ targetWeight: null, targetReps: 15 }] },
      ],
    },
    1_000,
  );
}

function ok(result: ReturnType<typeof toggleSetComplete>): ActiveWorkout {
  if (!result.ok) throw new Error(`toggle failed: ${result.reason}`);
  return result.workout;
}

describe('set logging', () => {
  it('completes a prefilled set with one tap using the placeholder values', () => {
    const w = sample();
    const ex = w.exercises[0]!;
    const result = toggleSetComplete(w, ex.key, ex.sets[0]!.id, 5_000);
    const next = ok(result);
    const set = next.exercises[0]!.sets[0]!;
    expect(result.ok && result.completed).toBe(true);
    expect(set).toMatchObject({ weight: 185, reps: 5, completed: true, completedAt: 5_000 });
  });

  it('prefers typed values over placeholders', () => {
    let w = sample();
    const ex = w.exercises[0]!;
    w = updateSet(w, ex.key, ex.sets[0]!.id, { weight: 195, reps: 4 });
    w = ok(toggleSetComplete(w, ex.key, ex.sets[0]!.id, 2));
    expect(w.exercises[0]!.sets[0]).toMatchObject({ weight: 195, reps: 4 });
  });

  it('logs bodyweight sets with zero weight', () => {
    const w = sample();
    const ex = w.exercises[1]!;
    const next = ok(toggleSetComplete(w, ex.key, ex.sets[0]!.id, 2));
    expect(next.exercises[1]!.sets[0]).toMatchObject({ weight: 0, reps: 15, completed: true });
  });

  it('refuses to complete a set with no reps', () => {
    const w = createWorkout(
      { name: 'x', routineId: null, exercises: [{ exerciseId: 'a', restSec: 60, sets: [{ targetWeight: 100, targetReps: null }] }] },
      0,
    );
    const ex = w.exercises[0]!;
    expect(toggleSetComplete(w, ex.key, ex.sets[0]!.id, 1)).toEqual({ ok: false, reason: 'missing-reps' });
  });

  it('fills blank placeholders on later sets from the completed set', () => {
    let w = createWorkout(
      {
        name: 'x',
        routineId: null,
        exercises: [
          {
            exerciseId: 'a',
            restSec: 60,
            sets: [
              { targetWeight: null, targetReps: null },
              { targetWeight: null, targetReps: null },
              { targetWeight: 200, targetReps: null },
            ],
          },
        ],
      },
      0,
    );
    const ex = w.exercises[0]!;
    w = updateSet(w, ex.key, ex.sets[0]!.id, { weight: 135, reps: 5 });
    w = ok(toggleSetComplete(w, ex.key, ex.sets[0]!.id, 1));
    const [, second, third] = w.exercises[0]!.sets;
    expect(second).toMatchObject({ targetWeight: 135, targetReps: 5 });
    // Explicit targets are kept; only blanks are filled.
    expect(third).toMatchObject({ targetWeight: 200, targetReps: 5 });
    w = ok(toggleSetComplete(w, ex.key, second!.id, 2));
    expect(w.exercises[0]!.sets[1]).toMatchObject({ weight: 135, reps: 5, completed: true });
  });

  it('un-completes a set on a second tap', () => {
    let w = sample();
    const ex = w.exercises[0]!;
    w = ok(toggleSetComplete(w, ex.key, ex.sets[0]!.id, 1));
    const result = toggleSetComplete(w, ex.key, ex.sets[0]!.id, 2);
    expect(result.ok && result.completed).toBe(false);
    expect(ok(result).exercises[0]!.sets[0]!.completed).toBe(false);
  });

  it('adds a set that inherits the last set as its placeholder', () => {
    let w = sample();
    const ex = w.exercises[0]!;
    w = updateSet(w, ex.key, ex.sets[2]!.id, { weight: 205, reps: 3 });
    w = addSet(w, ex.key);
    const added = w.exercises[0]!.sets[3]!;
    expect(added).toMatchObject({ targetWeight: 205, targetReps: 3, weight: null, completed: false });
  });

  it('removes a set', () => {
    let w = sample();
    const ex = w.exercises[0]!;
    w = removeSet(w, ex.key, ex.sets[1]!.id);
    expect(w.exercises[0]!.sets).toHaveLength(2);
  });

  it('adds warm-up sets above working sets', () => {
    let w = sample();
    const ex = w.exercises[0]!;
    w = addWarmupSets(w, ex.key, [{ weight: 45, reps: 10 }, { weight: 95, reps: 5 }]);
    expect(w.exercises[0]!.sets.map((s) => s.type)).toEqual(['warmup', 'warmup', 'normal', 'normal', 'normal']);
  });
});

describe('exercise management', () => {
  it('swaps an exercise in place, keeping the set count', () => {
    const w = sample();
    const ex = w.exercises[0]!;
    const next = swapExercise(w, ex.key, planFromPrevious('dumbbell-bench-press', 120, [{ type: 'normal', weight: 70, reps: 10 }]));
    expect(next.exercises[0]!.exerciseId).toBe('dumbbell-bench-press');
    expect(next.exercises[0]!.sets).toHaveLength(3);
    expect(next.exercises[0]!.sets.every((s) => s.targetWeight === 70 && s.targetReps === 10 && !s.completed)).toBe(true);
    expect(next.exercises[0]!.restSec).toBe(120);
  });

  it('skips exercises and excludes them from totals and the saved workout', () => {
    let w = sample();
    const bench = w.exercises[0]!;
    const pushups = w.exercises[1]!;
    w = ok(toggleSetComplete(w, pushups.key, pushups.sets[0]!.id, 10));
    w = setSkipped(w, bench.key, true);
    expect(workoutTotals(w)).toEqual({ completedSets: 1, totalSets: 1, volume: 0 });
    const finished = finishWorkout(w, 99);
    expect(finished.exercises.map((e) => e.exerciseId)).toEqual(['push-up']);
  });

  it('moves exercises', () => {
    const w = sample();
    const moved = moveExercise(w, w.exercises[1]!.key, -1);
    expect(moved.exercises.map((e) => e.exerciseId)).toEqual(['push-up', 'barbell-bench-press']);
    expect(moveExercise(w, w.exercises[0]!.key, -1)).toBe(w);
  });

  it('finds the next pending set, skipping skipped exercises', () => {
    let w = sample();
    const bench = w.exercises[0]!;
    w = ok(toggleSetComplete(w, bench.key, bench.sets[0]!.id, 1));
    expect(nextPendingSet(w)?.setIndex).toBe(1);
    w = setSkipped(w, bench.key, true);
    expect(nextPendingSet(w)?.exercise.exerciseId).toBe('push-up');
  });
});

describe('finishing', () => {
  it('drops incomplete sets and computes totals and e1RM', () => {
    let w = sample();
    const bench = w.exercises[0]!;
    w = ok(toggleSetComplete(w, bench.key, bench.sets[0]!.id, 10));
    w = ok(toggleSetComplete(w, bench.key, bench.sets[1]!.id, 20));
    const finished = finishWorkout(w, 60_000);
    expect(finished.exercises).toHaveLength(1);
    expect(finished.exercises[0]!.sets).toHaveLength(2);
    expect(finished.totalSets).toBe(2);
    expect(finished.totalVolume).toBe(185 * 5 * 2);
    expect(finished.exercises[0]!.sets[0]!.e1rm).toBeCloseTo(185 * (1 + 5 / 30));
    expect(finished.endedAt).toBe(60_000);
  });

  it('gives warm-ups no e1RM', () => {
    let w = sample();
    const bench = w.exercises[0]!;
    w = addWarmupSets(w, bench.key, [{ weight: 95, reps: 5 }]);
    const warm = w.exercises[0]!.sets[0]!;
    w = ok(toggleSetComplete(w, bench.key, warm.id, 1));
    expect(finishWorkout(w, 2).exercises[0]!.sets[0]!.e1rm).toBe(0);
  });
});
