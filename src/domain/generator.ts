import { roundToIncrement, weightForReps } from './oneRepMax';
import type { Equipment, Exercise, MuscleGroup, Pattern } from './types';

// On-device routine generator (Fitbod-style, no network). It fills split-specific
// day templates with exercises from the library, respecting equipment, session
// length, variety across the week, and a hard rule that no primary muscle group
// is trained on two consecutive calendar days.

export type Goal = 'strength' | 'hypertrophy';
export type SplitKind = 'full_body' | 'upper_lower' | 'ppl' | 'ppl_upper' | 'ppl_ul';
export type DayType = 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full';
export type SlotRole = 'main' | 'secondary' | 'accessory';

export interface GeneratorInput {
  goal: Goal;
  daysPerWeek: number;
  equipment: Equipment[];
  sessionMinutes: number;
  split: SplitKind;
}

export interface SlotSpec {
  pattern: Pattern;
  role: SlotRole;
  /** Caps exercise tier, e.g. keeps conventional deadlifts out of a squat day's hinge slot. */
  maxTier?: number;
}

export interface GeneratedExercise {
  exerciseId: string;
  slot: SlotSpec;
  sets: number;
  reps: number;
  restSec: number;
  /** Suggested working weight from recent history; 0 = no history (log what you lift). */
  weight: number;
}

export interface GeneratedDay {
  /** JavaScript weekday, 0 = Sunday. */
  weekday: number;
  type: DayType;
  name: string;
  exercises: GeneratedExercise[];
}

export interface Program {
  input: GeneratorInput;
  seed: number;
  days: GeneratedDay[];
}

export interface GeneratorContext {
  library: Exercise[];
  /** Best recent estimated 1RM per exercise id, for weight suggestions. */
  recentE1rm: Record<string, number>;
}

export const SPLIT_LABEL: Record<SplitKind, string> = {
  full_body: 'Full body',
  upper_lower: 'Upper / Lower',
  ppl: 'Push / Pull / Legs',
  ppl_upper: 'Push / Pull / Legs + Upper',
  ppl_ul: 'Push / Pull / Legs + Upper / Lower',
};

const DAY_LABEL: Record<DayType, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  upper: 'Upper',
  lower: 'Lower',
  full: 'Full Body',
};

export function splitOptions(daysPerWeek: number): SplitKind[] {
  switch (daysPerWeek) {
    case 1:
      return ['full_body'];
    case 2:
      return ['full_body', 'upper_lower'];
    case 3:
      return ['ppl', 'full_body'];
    case 4:
      return ['upper_lower', 'ppl_upper'];
    case 5:
      return ['ppl_ul'];
    default:
      return ['ppl'];
  }
}

/** Training weekdays per frequency, spaced so rest days fall between similar sessions. */
const SCHEDULE: Record<number, number[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};

export function scheduleFor(daysPerWeek: number): number[] {
  return SCHEDULE[Math.min(6, Math.max(1, Math.round(daysPerWeek)))] ?? [1, 3, 5];
}

export function dayTypesFor(split: SplitKind, daysPerWeek: number): DayType[] {
  const n = Math.min(6, Math.max(1, Math.round(daysPerWeek)));
  switch (split) {
    case 'full_body':
      return Array.from({ length: n }, () => 'full' as const);
    case 'upper_lower':
      return Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 'upper' : 'lower'));
    case 'ppl':
      return Array.from({ length: n }, (_, i) => (['push', 'pull', 'legs'] as const)[i % 3] ?? 'push');
    case 'ppl_upper':
      return ['push', 'pull', 'legs', 'upper'].slice(0, n) as DayType[];
    case 'ppl_ul':
      return ['push', 'pull', 'legs', 'upper', 'lower'].slice(0, n) as DayType[];
  }
}

const M = (pattern: Pattern, maxTier?: number): SlotSpec => ({ pattern, role: 'main', maxTier });
const S = (pattern: Pattern, maxTier?: number): SlotSpec => ({ pattern, role: 'secondary', maxTier });
const A = (pattern: Pattern): SlotSpec => ({ pattern, role: 'accessory' });

/** Slot lists in priority order; the session-length budget decides how many get used. */
const TEMPLATES: Record<DayType, SlotSpec[][]> = {
  push: [
    [M('horizontal_press'), S('vertical_press'), S('incline_press'), A('lateral_raise'), A('triceps'), A('chest_fly'), A('triceps')],
    [M('vertical_press'), S('incline_press'), S('horizontal_press'), A('triceps'), A('lateral_raise'), A('chest_fly'), A('triceps')],
  ],
  pull: [
    [M('vertical_pull'), S('horizontal_row'), A('rear_delt'), A('biceps'), A('horizontal_row'), A('biceps'), A('shrug')],
    [M('horizontal_row'), S('vertical_pull'), A('biceps'), A('rear_delt'), A('vertical_pull'), A('shrug'), A('biceps')],
  ],
  legs: [
    [M('squat'), S('hinge', 2), S('lunge'), A('knee_flexion'), A('calf'), A('core'), A('knee_extension'), A('glute')],
    [M('hinge'), S('squat'), S('lunge'), A('knee_extension'), A('calf'), A('core'), A('knee_flexion'), A('glute')],
  ],
  upper: [
    [M('horizontal_press'), M('horizontal_row'), S('vertical_press'), S('vertical_pull'), A('lateral_raise'), A('biceps'), A('triceps'), A('rear_delt')],
    [M('vertical_press'), M('vertical_pull'), S('incline_press'), S('horizontal_row'), A('triceps'), A('biceps'), A('lateral_raise'), A('rear_delt')],
  ],
  lower: [
    [M('squat'), S('hinge', 2), S('lunge'), A('knee_flexion'), A('calf'), A('core'), A('glute')],
    [M('hinge'), S('squat'), S('lunge'), A('knee_extension'), A('calf'), A('core'), A('knee_flexion')],
  ],
  full: [
    [M('squat'), M('horizontal_press'), S('horizontal_row'), S('hinge', 2), A('vertical_press'), A('vertical_pull'), A('core'), A('biceps')],
    [M('hinge'), M('vertical_press'), S('vertical_pull'), S('lunge'), A('incline_press'), A('horizontal_row'), A('core'), A('triceps')],
    [M('squat'), M('incline_press'), S('horizontal_row'), S('hinge', 2), A('lateral_raise'), A('vertical_pull'), A('core'), A('knee_flexion')],
  ],
};

interface Scheme {
  sets: number;
  reps: number;
  restSec: number;
}

const SCHEMES: Record<Goal, Record<SlotRole, Scheme>> = {
  strength: {
    main: { sets: 5, reps: 5, restSec: 150 },
    secondary: { sets: 3, reps: 6, restSec: 120 },
    accessory: { sets: 3, reps: 10, restSec: 75 },
  },
  hypertrophy: {
    main: { sets: 4, reps: 8, restSec: 120 },
    secondary: { sets: 3, reps: 10, restSec: 90 },
    accessory: { sets: 3, reps: 12, restSec: 60 },
  },
};

function schemeFor(goal: Goal, slot: SlotSpec, exercise: Exercise): Scheme {
  const base = SCHEMES[goal][slot.role];
  if (exercise.primaryMuscle === 'abs' || exercise.pattern === 'calf') {
    return { sets: 3, reps: goal === 'strength' ? 12 : 15, restSec: 60 };
  }
  // Bodyweight moves (other than pull-ups/dips style pulls and presses) need more reps to be a stimulus.
  if (exercise.bodyweight && exercise.pattern !== 'vertical_pull' && exercise.pattern !== 'triceps') {
    return { ...base, reps: Math.max(base.reps, goal === 'strength' ? 8 : 12) };
  }
  return base;
}

/** Rough session length: 5 min warm-up, ~45 s per set plus rest, 1 min between exercises. */
export function estimateMinutes(exercises: Pick<GeneratedExercise, 'sets' | 'restSec'>[]): number {
  const seconds = exercises.reduce((sum, e) => sum + e.sets * (45 + e.restSec) + 60, 300);
  return Math.round(seconds / 60);
}

/** Deterministic PRNG so a seed always regenerates the same program. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function areAdjacent(a: number, b: number): boolean {
  const diff = Math.abs(a - b) % 7;
  return diff === 1 || diff === 6;
}

/** Primary muscles trained on the days adjacent to `weekday`, excluding day `selfIndex`. */
function blockedMuscles(days: (GeneratedDay | undefined)[], weekday: number, selfIndex: number, byId: Map<string, Exercise>): Set<MuscleGroup> {
  const blocked = new Set<MuscleGroup>();
  days.forEach((day, i) => {
    if (!day || i === selfIndex || !areAdjacent(day.weekday, weekday)) return;
    for (const e of day.exercises) {
      const muscle = byId.get(e.exerciseId)?.primaryMuscle;
      if (muscle) blocked.add(muscle);
    }
  });
  return blocked;
}

function suggestWeight(exercise: Exercise, reps: number, recentE1rm: Record<string, number>): number {
  const e1rm = recentE1rm[exercise.id];
  if (!e1rm || exercise.bodyweight) return 0;
  // Aim a couple of reps short of failure.
  const target = weightForReps(e1rm, reps) * 0.92;
  return roundToIncrement(target, target < 30 ? 2.5 : 5);
}

interface PickOptions {
  slot: SlotSpec;
  input: GeneratorInput;
  library: Exercise[];
  usage: Map<string, number>;
  usedToday: Set<string>;
  blocked: Set<MuscleGroup>;
  rng: () => number;
}

/** Candidates for a slot, best first. */
export function rankCandidates(options: Omit<PickOptions, 'rng'> & { rng?: () => number }): Exercise[] {
  const { slot, input, library, usage, usedToday, blocked } = options;
  const rng = options.rng ?? (() => 0.5);
  const allowed = (e: Exercise, respectTier: boolean) =>
    e.pattern === slot.pattern &&
    !e.isCustom &&
    !e.archived &&
    input.equipment.includes(e.equipment) &&
    !usedToday.has(e.id) &&
    !blocked.has(e.primaryMuscle) &&
    (!respectTier || slot.maxTier === undefined || e.tier <= slot.maxTier);

  let pool = library.filter((e) => allowed(e, true));
  if (pool.length === 0) pool = library.filter((e) => allowed(e, false));

  const strengthMain = input.goal === 'strength' && slot.role === 'main';
  const tierWeight = slot.role === 'main' ? (input.goal === 'strength' ? 3 : 1.5) : slot.role === 'secondary' ? 1.2 : 1;
  const reusePenalty = strengthMain ? 2 : 4;
  // Main lifts should be compounds when the equipment allows it.
  const compoundBonus = slot.role === 'accessory' ? 0 : 1;

  return pool
    .map((e) => ({
      e,
      score:
        tierWeight * e.tier +
        (e.category === 'compound' ? compoundBonus : 0) +
        rng() * 1.2 -
        (usage.get(e.id) ?? 0) * reusePenalty,
    }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.e);
}

function buildDay(
  index: number,
  days: (GeneratedDay | undefined)[],
  weekday: number,
  type: DayType,
  variant: number,
  name: string,
  input: GeneratorInput,
  ctx: GeneratorContext,
  usage: Map<string, number>,
  rng: () => number,
): GeneratedDay {
  const byId = new Map(ctx.library.map((e) => [e.id, e]));
  const templates = TEMPLATES[type];
  const slots = templates[variant % templates.length] ?? templates[0] ?? [];
  const blocked = blockedMuscles(days, weekday, index, byId);
  const usedToday = new Set<string>();
  const picked: GeneratedExercise[] = [];

  for (const slot of slots) {
    const [choice] = rankCandidates({ slot, input, library: ctx.library, usage, usedToday, blocked, rng });
    if (!choice) continue;
    const scheme = schemeFor(input.goal, slot, choice);
    const candidate: GeneratedExercise = {
      exerciseId: choice.id,
      slot,
      sets: scheme.sets,
      reps: scheme.reps,
      restSec: scheme.restSec,
      weight: suggestWeight(choice, scheme.reps, ctx.recentE1rm),
    };
    const fits = estimateMinutes([...picked, candidate]) <= input.sessionMinutes;
    if (!fits && picked.length >= 3) continue;
    picked.push(candidate);
    usedToday.add(choice.id);
  }

  fitToTime(picked, input.sessionMinutes);
  for (const e of picked) usage.set(e.exerciseId, (usage.get(e.exerciseId) ?? 0) + 1);
  return { weekday, type, name, exercises: picked };
}

/** Trims sets (accessories first, never below 2) until the estimate fits the session length. */
function fitToTime(exercises: GeneratedExercise[], minutes: number): void {
  const order: SlotRole[] = ['accessory', 'secondary', 'main'];
  let guard = 100;
  while (estimateMinutes(exercises) > minutes && guard-- > 0) {
    let trimmed = false;
    for (const role of order) {
      const target = [...exercises].reverse().find((e) => e.slot.role === role && e.sets > 2);
      if (target) {
        target.sets--;
        trimmed = true;
        break;
      }
    }
    if (!trimmed) break;
  }
}

function dayNames(types: DayType[]): string[] {
  const totals = new Map<DayType, number>();
  for (const t of types) totals.set(t, (totals.get(t) ?? 0) + 1);
  const seen = new Map<DayType, number>();
  return types.map((t) => {
    const n = seen.get(t) ?? 0;
    seen.set(t, n + 1);
    return (totals.get(t) ?? 0) > 1 ? `${DAY_LABEL[t]} ${String.fromCharCode(65 + n)}` : DAY_LABEL[t];
  });
}

export function generateProgram(input: GeneratorInput, ctx: GeneratorContext, seed: number): Program {
  const rng = mulberry32(seed);
  const weekdays = scheduleFor(input.daysPerWeek);
  const types = dayTypesFor(input.split, weekdays.length);
  const names = dayNames(types);
  const usage = new Map<string, number>();
  const variants = new Map<DayType, number>();
  const days: (GeneratedDay | undefined)[] = new Array(types.length).fill(undefined);
  types.forEach((type, i) => {
    const variant = variants.get(type) ?? 0;
    variants.set(type, variant + 1);
    days[i] = buildDay(i, days, weekdays[i] ?? 1, type, variant, names[i] ?? DAY_LABEL[type], input, ctx, usage, rng);
  });
  return { input, seed, days: days.filter((d): d is GeneratedDay => d !== undefined) };
}

/** Rebuilds one day with a new seed, keeping the rest of the week (and the adjacency rule). */
export function regenerateDay(program: Program, dayIndex: number, ctx: GeneratorContext, seed: number): Program {
  const target = program.days[dayIndex];
  if (!target) return program;
  const usage = new Map<string, number>();
  program.days.forEach((d, i) => {
    if (i === dayIndex) return;
    for (const e of d.exercises) usage.set(e.exerciseId, (usage.get(e.exerciseId) ?? 0) + 1);
  });
  // Penalize what the day had so a regenerate actually changes it.
  for (const e of target.exercises) usage.set(e.exerciseId, (usage.get(e.exerciseId) ?? 0) + 1);
  const variant = program.days.slice(0, dayIndex).filter((d) => d.type === target.type).length;
  const days: (GeneratedDay | undefined)[] = program.days.map((d, i) => (i === dayIndex ? undefined : d));
  const rebuilt = buildDay(dayIndex, days, target.weekday, target.type, variant, target.name, program.input, ctx, usage, mulberry32(seed));
  return { ...program, days: program.days.map((d, i) => (i === dayIndex ? rebuilt : d)) };
}

/** Ranked swap options for one exercise, honoring equipment and the adjacency rule. */
export function alternativesFor(program: Program, dayIndex: number, exerciseIndex: number, ctx: GeneratorContext): Exercise[] {
  const day = program.days[dayIndex];
  const current = day?.exercises[exerciseIndex];
  if (!day || !current) return [];
  const byId = new Map(ctx.library.map((e) => [e.id, e]));
  const usage = new Map<string, number>();
  for (const d of program.days) for (const e of d.exercises) usage.set(e.exerciseId, (usage.get(e.exerciseId) ?? 0) + 1);
  const usedToday = new Set(day.exercises.map((e) => e.exerciseId));
  const blocked = blockedMuscles(program.days, day.weekday, dayIndex, byId);
  return rankCandidates({ slot: current.slot, input: program.input, library: ctx.library, usage, usedToday, blocked });
}

export function swapExerciseInProgram(
  program: Program,
  dayIndex: number,
  exerciseIndex: number,
  exerciseId: string,
  ctx: GeneratorContext,
): Program {
  const exercise = ctx.library.find((e) => e.id === exerciseId);
  if (!exercise) return program;
  return mapExercise(program, dayIndex, exerciseIndex, (current) => {
    const scheme = schemeFor(program.input.goal, current.slot, exercise);
    return {
      ...current,
      exerciseId,
      sets: scheme.sets,
      reps: scheme.reps,
      restSec: scheme.restSec,
      weight: suggestWeight(exercise, scheme.reps, ctx.recentE1rm),
    };
  });
}

export function adjustExercise(
  program: Program,
  dayIndex: number,
  exerciseIndex: number,
  patch: { sets?: number; reps?: number },
  ctx: GeneratorContext,
): Program {
  return mapExercise(program, dayIndex, exerciseIndex, (current) => {
    const reps = Math.max(1, Math.min(30, patch.reps ?? current.reps));
    const exercise = ctx.library.find((e) => e.id === current.exerciseId);
    return {
      ...current,
      sets: Math.max(1, Math.min(10, patch.sets ?? current.sets)),
      reps,
      weight: exercise && reps !== current.reps ? suggestWeight(exercise, reps, ctx.recentE1rm) : current.weight,
    };
  });
}

export function removeExerciseFromProgram(program: Program, dayIndex: number, exerciseIndex: number): Program {
  return {
    ...program,
    days: program.days.map((d, i) => (i === dayIndex ? { ...d, exercises: d.exercises.filter((_, j) => j !== exerciseIndex) } : d)),
  };
}

function mapExercise(
  program: Program,
  dayIndex: number,
  exerciseIndex: number,
  fn: (e: GeneratedExercise) => GeneratedExercise,
): Program {
  return {
    ...program,
    days: program.days.map((d, i) =>
      i === dayIndex ? { ...d, exercises: d.exercises.map((e, j) => (j === exerciseIndex ? fn(e) : e)) } : d,
    ),
  };
}

export interface Conflict {
  first: number;
  second: number;
  muscles: MuscleGroup[];
}

/** Pairs of consecutive training days that share a primary muscle group. */
export function findBackToBackConflicts(program: Program, library: Exercise[]): Conflict[] {
  const byId = new Map(library.map((e) => [e.id, e]));
  const muscles = program.days.map(
    (d) => new Set(d.exercises.map((e) => byId.get(e.exerciseId)?.primaryMuscle).filter((m): m is MuscleGroup => !!m)),
  );
  const conflicts: Conflict[] = [];
  for (let i = 0; i < program.days.length; i++) {
    for (let j = i + 1; j < program.days.length; j++) {
      const a = program.days[i];
      const b = program.days[j];
      if (!a || !b || !areAdjacent(a.weekday, b.weekday)) continue;
      const shared = [...(muscles[i] ?? [])].filter((m) => muscles[j]?.has(m));
      if (shared.length) conflicts.push({ first: i, second: j, muscles: shared });
    }
  }
  return conflicts;
}
