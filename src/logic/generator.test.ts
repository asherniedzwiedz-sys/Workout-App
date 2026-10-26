/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISE_BY_ID, EQUIPMENT, type Equipment } from './exercises.ts';
import { alternatives, dayMinutes, generatePlan, replaceExercise, type GenInput, type PlanDay } from './generator.ts';

const muscles = (d: PlanDay) => new Set(d.exercises.map((e) => EXERCISE_BY_ID.get(e.exerciseId)!.muscle));
const adjacent = (a: number, b: number) => (a - b + 7) % 7 === 1 || (b - a + 7) % 7 === 1;
const GEAR: Equipment[][] = [[...EQUIPMENT], ['dumbbell'], ['barbell', 'dumbbell'], ['kettlebell'], ['machine', 'cable']];

function* inputs(): Generator<GenInput> {
  for (const days of [1, 2, 3, 4, 5, 6])
    for (const goal of ['strength', 'hypertrophy'] as const)
      for (const equipment of GEAR)
        for (const minutes of [30, 45, 60, 90])
          for (const seed of [1, 2, 3]) yield { days, goal, equipment, minutes, seed };
}

test('never trains the same primary muscle on back-to-back days', () => {
  for (const input of inputs()) {
    const plan = generatePlan(input);
    for (const a of plan)
      for (const b of plan) {
        if (a === b || !adjacent(a.weekday, b.weekday)) continue;
        const overlap = [...muscles(a)].filter((m) => muscles(b).has(m));
        assert.deepEqual(overlap, [], `${JSON.stringify(input)}: ${a.name} / ${b.name} share ${overlap}`);
      }
  }
});

test('respects equipment, day count, PPL split, and session length', () => {
  for (const input of inputs()) {
    const plan = generatePlan(input);
    assert.equal(plan.length, input.days);
    for (const d of plan) {
      for (const e of d.exercises) {
        const def = EXERCISE_BY_ID.get(e.exerciseId)!;
        assert.ok(def.equipment === 'bodyweight' || input.equipment.includes(def.equipment), `${def.id} not allowed`);
        const ok = { push: ['push'], pull: ['pull'], legs: ['legs', 'core'], upper: ['push', 'pull'], full: ['push', 'pull', 'legs', 'core'] }[d.kind];
        assert.ok(ok.includes(def.pattern), `${def.id} on ${d.kind} day`);
      }
      assert.equal(new Set(d.exercises.map((e) => e.exerciseId)).size, d.exercises.length, 'no duplicates in a day');
      if (d.exercises.length > 2) assert.ok(dayMinutes(d) <= input.minutes + 0.01, `${d.name} runs ${dayMinutes(d)} min > ${input.minutes}`);
    }
  }
  const full = { days: 3, goal: 'hypertrophy', equipment: [...EQUIPMENT], minutes: 60, seed: 7 } as const;
  assert.deepEqual(generatePlan({ ...full, equipment: [...full.equipment] }).map((d) => d.kind), ['push', 'pull', 'legs']);
  for (const d of generatePlan({ ...full, equipment: [...full.equipment] })) assert.ok(d.exercises.length >= 4, `${d.name} too short`);
});

test('varies exercises across same-type days and regenerates with a new seed', () => {
  const base: GenInput = { days: 6, goal: 'hypertrophy', equipment: [...EQUIPMENT], minutes: 60, seed: 1 };
  const plan = generatePlan(base);
  const ids = (d: PlanDay) => d.exercises.map((e) => e.exerciseId);
  assert.notDeepEqual(ids(plan[0]!), ids(plan[3]!), 'Push A and Push B should differ');
  assert.deepEqual(generatePlan(base), plan, 'same seed is deterministic');
  assert.notDeepEqual(generatePlan({ ...base, seed: 2 }), plan);
});

test('tweak: alternatives keep the muscle and swap leaves other days untouched', () => {
  const input: GenInput = { days: 3, goal: 'strength', equipment: [...EQUIPMENT], minutes: 60, seed: 4 };
  const plan = generatePlan(input);
  const target = EXERCISE_BY_ID.get(plan[0]!.exercises[0]!.exerciseId)!;
  const alts = alternatives(plan, 0, 0, input);
  assert.ok(alts.length > 0);
  assert.ok(alts.every((a) => a.muscle === target.muscle && a.id !== target.id));
  const next = replaceExercise(plan, 0, 0, alts[0]!.id, input.goal);
  assert.equal(next[0]!.exercises[0]!.exerciseId, alts[0]!.id);
  assert.deepEqual(next.slice(1), plan.slice(1));
});
