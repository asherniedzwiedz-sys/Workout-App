/**
 * On-device routine builder (Fitbod-style, no API). Deterministic for a given seed so
 * "Regenerate" = new seed and "tweak" = swap one slot without touching the rest.
 */
import { EXERCISE_BY_ID, EXERCISES, type Equipment, type ExerciseDef, type Muscle } from './exercises.ts';

export type Goal = 'strength' | 'hypertrophy';
export type GenInput = { goal: Goal; days: number; equipment: Equipment[]; minutes: number; seed: number };
export type DayKind = 'push' | 'pull' | 'legs' | 'upper' | 'full';
export type PlanExercise = { exerciseId: string; sets: number; reps: number; restSec: number };
export type PlanDay = { name: string; kind: DayKind; weekday: number; exercises: PlanExercise[] };

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Push/pull/legs-based splits on a fixed weekly calendar (0 = Monday). */
const SPLITS: Record<number, [DayKind, number][]> = {
  1: [['full', 0]],
  2: [['full', 0], ['full', 3]],
  3: [['push', 0], ['pull', 2], ['legs', 4]],
  4: [['push', 0], ['pull', 1], ['legs', 3], ['upper', 4]],
  5: [['push', 0], ['pull', 1], ['legs', 2], ['push', 4], ['pull', 5]],
  6: [['push', 0], ['pull', 1], ['legs', 2], ['push', 3], ['pull', 4], ['legs', 5]],
};

type Slot = { muscles: Muscle[]; compound?: boolean };
const SLOTS: Record<DayKind, Slot[]> = {
  push: [{ muscles: ['chest'], compound: true }, { muscles: ['shoulders'], compound: true }, { muscles: ['chest'] }, { muscles: ['triceps'] }, { muscles: ['shoulders'] }, { muscles: ['triceps'] }, { muscles: ['chest'] }],
  pull: [{ muscles: ['back'], compound: true }, { muscles: ['back'], compound: true }, { muscles: ['biceps'] }, { muscles: ['back'] }, { muscles: ['biceps'] }, { muscles: ['traps', 'forearms'] }],
  legs: [{ muscles: ['quads'], compound: true }, { muscles: ['hamstrings', 'glutes'], compound: true }, { muscles: ['quads'] }, { muscles: ['hamstrings'] }, { muscles: ['calves'] }, { muscles: ['core'] }, { muscles: ['glutes'] }],
  upper: [{ muscles: ['chest'], compound: true }, { muscles: ['back'], compound: true }, { muscles: ['shoulders'], compound: true }, { muscles: ['back'] }, { muscles: ['biceps'] }, { muscles: ['triceps'] }],
  full: [{ muscles: ['quads'], compound: true }, { muscles: ['chest'], compound: true }, { muscles: ['back'], compound: true }, { muscles: ['hamstrings', 'glutes'], compound: true }, { muscles: ['shoulders'] }, { muscles: ['biceps'] }, { muscles: ['triceps'] }, { muscles: ['core'] }],
};

const PATTERNS: Record<DayKind, string[]> = {
  push: ['push'], pull: ['pull'], legs: ['legs', 'core'], upper: ['push', 'pull'], full: ['push', 'pull', 'legs', 'core'],
};

const DOSE: Record<Goal, { compound: Omit<PlanExercise, 'exerciseId'>; accessory: Omit<PlanExercise, 'exerciseId'> }> = {
  strength: { compound: { sets: 5, reps: 5, restSec: 180 }, accessory: { sets: 3, reps: 8, restSec: 90 } },
  hypertrophy: { compound: { sets: 4, reps: 8, restSec: 120 }, accessory: { sets: 3, reps: 12, restSec: 60 } },
};

/** Minutes an exercise takes: ~45 s per working set + rest, plus setup/warm-up. */
export const exerciseMinutes = (e: PlanExercise, compound: boolean) => (e.sets * (45 + e.restSec)) / 60 + (compound ? 2 : 1);

export const dayMinutes = (d: PlanDay) =>
  d.exercises.reduce((m, e) => m + exerciseMinutes(e, EXERCISE_BY_ID.get(e.exerciseId)?.compound ?? false), 0);

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const adjacent = (a: number, b: number) => (a - b + 7) % 7 === 1 || (b - a + 7) % 7 === 1;

/** Primary muscles trained on calendar-adjacent days: these are off-limits for this day. */
function blockedMuscles(plan: PlanDay[], weekday: number, except?: PlanDay) {
  const blocked = new Set<Muscle>();
  for (const d of plan) {
    if (d === except || !adjacent(d.weekday, weekday)) continue;
    for (const e of d.exercises) {
      const def = EXERCISE_BY_ID.get(e.exerciseId);
      if (def) blocked.add(def.muscle);
    }
  }
  return blocked;
}

function candidates(slot: Slot, kind: DayKind, input: GenInput, used: Set<string>, blocked: Set<Muscle>) {
  const gear = new Set<Equipment>([...input.equipment, 'bodyweight']);
  return EXERCISES.filter(
    (e) =>
      slot.muscles.includes(e.muscle) && (!slot.compound || e.compound) && PATTERNS[kind].includes(e.pattern) &&
      gear.has(e.equipment) && !used.has(e.id) && !blocked.has(e.muscle),
  );
}

const MAIN_LIFT_GEAR: Equipment[] = ['barbell', 'dumbbell', 'machine', 'kettlebell', 'cable', 'bodyweight'];

/**
 * Bodyweight is only the fallback when none of the selected gear fits; a day's first lift goes
 * barbell > dumbbell > ...; then the least-used exercise this week wins (variety), ties broken at random.
 */
function choose(list: ExerciseDef[], input: GenInput, main: boolean, weekUse: Map<string, number>, rand: () => number) {
  const selected = list.filter((e) => input.equipment.includes(e.equipment));
  let pool = selected.length ? selected : list;
  if (main) {
    const rank = Math.min(...pool.map((e) => MAIN_LIFT_GEAR.indexOf(e.equipment)));
    pool = pool.filter((e) => MAIN_LIFT_GEAR.indexOf(e.equipment) === rank);
  }
  if (!pool.length) return undefined;
  const least = Math.min(...pool.map((e) => weekUse.get(e.id) ?? 0));
  pool = pool.filter((e) => (weekUse.get(e.id) ?? 0) === least);
  return pool[Math.floor(rand() * pool.length)];
}

const dose = (def: ExerciseDef, goal: Goal): PlanExercise => ({ exerciseId: def.id, ...DOSE[goal][def.compound ? 'compound' : 'accessory'] });

const NAMES: Record<DayKind, string> = { push: 'Push', pull: 'Pull', legs: 'Legs', upper: 'Upper', full: 'Full Body' };

export function generatePlan(input: GenInput): PlanDay[] {
  const rand = rng(input.seed);
  const split = SPLITS[Math.min(6, Math.max(1, Math.round(input.days)))]!;
  const weekUse = new Map<string, number>();
  const kindCount = new Map<DayKind, number>();
  const plan: PlanDay[] = [];

  for (const [kind, weekday] of split) {
    const n = (kindCount.get(kind) ?? 0) + 1;
    kindCount.set(kind, n);
    const repeats = split.filter(([k]) => k === kind).length > 1;
    const day: PlanDay = { name: `${NAMES[kind]}${repeats ? ` ${'ABC'[n - 1]}` : ''}`, kind, weekday, exercises: [] };
    const used = new Set<string>();
    const blocked = blockedMuscles(plan, weekday);
    let minutes = 0;
    for (const [i, slot] of SLOTS[kind].entries()) {
      const def = choose(candidates(slot, kind, input, used, blocked), input, i === 0, weekUse, rand);
      if (!def) continue;
      const ex = dose(def, input.goal);
      const cost = exerciseMinutes(ex, def.compound);
      if (minutes + cost > input.minutes && day.exercises.length >= 2) continue;
      day.exercises.push(ex);
      used.add(def.id);
      weekUse.set(def.id, (weekUse.get(def.id) ?? 0) + 1);
      minutes += cost;
    }
    plan.push(day);
  }
  return plan;
}

/** Same-muscle replacements for one exercise that keep the day's split and the back-to-back rule intact. */
export function alternatives(plan: PlanDay[], dayIndex: number, exIndex: number, input: GenInput): ExerciseDef[] {
  const day = plan[dayIndex];
  const current = day && EXERCISE_BY_ID.get(day.exercises[exIndex]?.exerciseId ?? '');
  if (!day || !current) return [];
  const used = new Set(day.exercises.map((e) => e.exerciseId));
  return candidates({ muscles: [current.muscle] }, day.kind, input, used, blockedMuscles(plan, day.weekday, day));
}

export function replaceExercise(plan: PlanDay[], dayIndex: number, exIndex: number, exerciseId: string, goal: Goal): PlanDay[] {
  const def = EXERCISE_BY_ID.get(exerciseId);
  if (!def) return plan;
  return plan.map((d, i) => (i !== dayIndex ? d : { ...d, exercises: d.exercises.map((e, j) => (j === exIndex ? dose(def, goal) : e)) }));
}
