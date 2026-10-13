import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary';

import {
  adjustExercise,
  alternativesFor,
  estimateMinutes,
  findBackToBackConflicts,
  generateProgram,
  regenerateDay,
  splitOptions,
  swapExerciseInProgram,
  type GeneratorContext,
  type GeneratorInput,
  type Program,
} from '../generator';
import { EQUIPMENT, type Equipment, type MuscleGroup } from '../types';

const ctx: GeneratorContext = { library: EXERCISE_LIBRARY, recentE1rm: {} };
const byId = new Map(EXERCISE_LIBRARY.map((e) => [e.id, e]));

const EQUIPMENT_SETS: Equipment[][] = [
  [...EQUIPMENT],
  ['dumbbell', 'bodyweight'],
  ['bodyweight'],
  ['barbell', 'bodyweight'],
  ['machine', 'cable'],
  ['kettlebell', 'bodyweight'],
];

function everyCombo(fn: (input: GeneratorInput, seed: number) => void) {
  for (let days = 1; days <= 6; days++) {
    for (const split of splitOptions(days)) {
      for (const equipment of EQUIPMENT_SETS) {
        for (const goal of ['strength', 'hypertrophy'] as const) {
          for (const sessionMinutes of [30, 60, 90]) {
            for (let seed = 1; seed <= 4; seed++) fn({ goal, daysPerWeek: days, equipment, sessionMinutes, split }, seed);
          }
        }
      }
    }
  }
}

const PUSH: MuscleGroup[] = ['chest', 'shoulders', 'triceps'];
const PULL: MuscleGroup[] = ['lats', 'upper back', 'biceps', 'traps', 'forearms'];
const LEGS: MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'calves', 'abs', 'lower back', 'adductors', 'full body'];

function muscles(program: Program, day: number): MuscleGroup[] {
  return program.days[day]!.exercises.map((e) => byId.get(e.exerciseId)!.primaryMuscle);
}

describe('generateProgram', () => {
  it('never trains the same primary muscle on back-to-back days', () => {
    let programs = 0;
    everyCombo((input, seed) => {
      const program = generateProgram(input, ctx, seed);
      programs++;
      expect(findBackToBackConflicts(program, EXERCISE_LIBRARY)).toEqual([]);
    });
    expect(programs).toBeGreaterThan(500);
  });

  it('only uses selected equipment, never repeats an exercise within a day, and fits the session', () => {
    everyCombo((input, seed) => {
      const program = generateProgram(input, ctx, seed);
      expect(program.days).toHaveLength(input.daysPerWeek);
      for (const day of program.days) {
        expect(day.exercises.length).toBeGreaterThan(0);
        const ids = day.exercises.map((e) => e.exerciseId);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) expect(input.equipment).toContain(byId.get(id)!.equipment);
        expect(estimateMinutes(day.exercises)).toBeLessThanOrEqual(input.sessionMinutes);
      }
    });
  });

  it('fills a full session when equipment allows', () => {
    const program = generateProgram({ goal: 'hypertrophy', daysPerWeek: 4, equipment: [...EQUIPMENT], sessionMinutes: 60, split: 'upper_lower' }, ctx, 7);
    for (const day of program.days) expect(day.exercises.length).toBeGreaterThanOrEqual(5);
  });

  it('respects push/pull/legs splits', () => {
    const program = generateProgram({ goal: 'hypertrophy', daysPerWeek: 6, equipment: [...EQUIPMENT], sessionMinutes: 75, split: 'ppl' }, ctx, 3);
    expect(program.days.map((d) => d.type)).toEqual(['push', 'pull', 'legs', 'push', 'pull', 'legs']);
    expect(program.days.map((d) => d.name)).toEqual(['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B']);
    program.days.forEach((day, i) => {
      const allowed = day.type === 'push' ? PUSH : day.type === 'pull' ? PULL : LEGS;
      for (const m of muscles(program, i)) expect(allowed).toContain(m);
    });
  });

  it('varies exercises across the week', () => {
    const program = generateProgram({ goal: 'hypertrophy', daysPerWeek: 6, equipment: [...EQUIPMENT], sessionMinutes: 60, split: 'ppl' }, ctx, 11);
    for (const [a, b] of [
      [0, 3],
      [1, 4],
      [2, 5],
    ] as const) {
      const first = new Set(program.days[a]!.exercises.map((e) => e.exerciseId));
      const shared = program.days[b]!.exercises.filter((e) => first.has(e.exerciseId));
      expect(shared.length).toBeLessThanOrEqual(1);
    }
  });

  it('uses heavier, lower-rep schemes for strength', () => {
    const strength = generateProgram({ goal: 'strength', daysPerWeek: 3, equipment: [...EQUIPMENT], sessionMinutes: 60, split: 'ppl' }, ctx, 1);
    const hyper = generateProgram({ goal: 'hypertrophy', daysPerWeek: 3, equipment: [...EQUIPMENT], sessionMinutes: 60, split: 'ppl' }, ctx, 1);
    expect(strength.days[0]!.exercises[0]!.reps).toBeLessThan(hyper.days[0]!.exercises[0]!.reps);
    expect(strength.days[0]!.exercises[0]!.restSec).toBeGreaterThan(hyper.days[0]!.exercises[0]!.restSec);
    // Strength main lifts favor the foundational barbell movements.
    expect(strength.days[0]!.exercises[0]!.exerciseId).toBe('barbell-bench-press');
    expect(strength.days[2]!.exercises[0]!.exerciseId).toBe('back-squat');
  });

  it('spreads training days so rest falls between them', () => {
    const three = generateProgram({ goal: 'strength', daysPerWeek: 3, equipment: [...EQUIPMENT], sessionMinutes: 60, split: 'full_body' }, ctx, 1);
    expect(three.days.map((d) => d.weekday)).toEqual([1, 3, 5]);
  });

  it('is deterministic per seed', () => {
    const input: GeneratorInput = { goal: 'hypertrophy', daysPerWeek: 4, equipment: [...EQUIPMENT], sessionMinutes: 60, split: 'upper_lower' };
    expect(generateProgram(input, ctx, 42)).toEqual(generateProgram(input, ctx, 42));
    const variants = new Set(Array.from({ length: 10 }, (_, s) => JSON.stringify(generateProgram(input, ctx, s + 1).days)));
    expect(variants.size).toBeGreaterThan(1);
  });

  it('suggests weights from recent history', () => {
    const withHistory: GeneratorContext = { library: EXERCISE_LIBRARY, recentE1rm: { 'barbell-bench-press': 250 } };
    const program = generateProgram({ goal: 'strength', daysPerWeek: 3, equipment: [...EQUIPMENT], sessionMinutes: 60, split: 'ppl' }, withHistory, 1);
    const bench = program.days[0]!.exercises[0]!;
    expect(bench.exerciseId).toBe('barbell-bench-press');
    // 250 e1RM → ~214 for 5 reps → ×0.92 ≈ 197 → rounded down to 195.
    expect(bench.weight).toBe(195);
    expect(program.days[0]!.exercises[1]!.weight).toBe(0);
  });
});

describe('findBackToBackConflicts', () => {
  it('detects shared muscles on consecutive days, including Sunday to Monday', () => {
    const base = generateProgram({ goal: 'hypertrophy', daysPerWeek: 2, equipment: [...EQUIPMENT], sessionMinutes: 60, split: 'full_body' }, ctx, 1);
    const bench = { exerciseId: 'barbell-bench-press', slot: { pattern: 'horizontal_press' as const, role: 'main' as const }, sets: 3, reps: 8, restSec: 90, weight: 0 };
    const make = (a: number, b: number): Program => ({
      ...base,
      days: [
        { weekday: a, type: 'push', name: 'A', exercises: [bench] },
        { weekday: b, type: 'push', name: 'B', exercises: [bench] },
      ],
    });
    expect(findBackToBackConflicts(make(1, 2), EXERCISE_LIBRARY)).toEqual([{ first: 0, second: 1, muscles: ['chest'] }]);
    expect(findBackToBackConflicts(make(0, 6), EXERCISE_LIBRARY)).toHaveLength(1);
    expect(findBackToBackConflicts(make(1, 3), EXERCISE_LIBRARY)).toEqual([]);
  });
});

describe('tweaking', () => {
  const input: GeneratorInput = { goal: 'hypertrophy', daysPerWeek: 5, equipment: [...EQUIPMENT], sessionMinutes: 60, split: 'ppl_ul' };
  const program = generateProgram(input, ctx, 5);

  it('offers alternatives for the same movement pattern, excluding the current day', () => {
    const alts = alternativesFor(program, 0, 0, ctx);
    const current = program.days[0]!.exercises[0]!;
    const dayIds = program.days[0]!.exercises.map((e) => e.exerciseId);
    expect(alts.length).toBeGreaterThan(2);
    for (const a of alts) {
      expect(a.pattern).toBe(current.slot.pattern);
      expect(dayIds).not.toContain(a.id);
    }
  });

  it('swaps an exercise and keeps the program conflict-free', () => {
    const alt = alternativesFor(program, 1, 0, ctx)[0]!;
    const swapped = swapExerciseInProgram(program, 1, 0, alt.id, ctx);
    expect(swapped.days[1]!.exercises[0]!.exerciseId).toBe(alt.id);
    expect(findBackToBackConflicts(swapped, EXERCISE_LIBRARY)).toEqual([]);
  });

  it('regenerates a single day', () => {
    const next = regenerateDay(program, 2, ctx, 999);
    expect(next.days[0]).toEqual(program.days[0]);
    const before = program.days[2]!.exercises.map((e) => e.exerciseId);
    const after = next.days[2]!.exercises.map((e) => e.exerciseId);
    expect(after).not.toEqual(before);
    expect(findBackToBackConflicts(next, EXERCISE_LIBRARY)).toEqual([]);
  });

  it('adjusts sets and reps within bounds', () => {
    const next = adjustExercise(program, 0, 0, { sets: 99, reps: 0 }, ctx);
    expect(next.days[0]!.exercises[0]).toMatchObject({ sets: 10, reps: 1 });
  });
});
