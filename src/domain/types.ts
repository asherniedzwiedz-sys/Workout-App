// Core domain types shared by the database layer, state stores and screens.
// Weights are always stored in pounds, distances in meters, durations in seconds,
// and timestamps as epoch milliseconds.

export const MUSCLE_GROUPS = [
  'chest',
  'shoulders',
  'triceps',
  'biceps',
  'forearms',
  'lats',
  'upper back',
  'traps',
  'lower back',
  'abs',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'adductors',
  'full body',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell'] as const;
export type Equipment = (typeof EQUIPMENT)[number];

/** Movement pattern. The routine generator fills workout "slots" by pattern. */
export const PATTERNS = [
  'horizontal_press',
  'incline_press',
  'vertical_press',
  'chest_fly',
  'lateral_raise',
  'triceps',
  'vertical_pull',
  'horizontal_row',
  'rear_delt',
  'biceps',
  'shrug',
  'squat',
  'hinge',
  'lunge',
  'knee_extension',
  'knee_flexion',
  'glute',
  'calf',
  'core',
  'grip',
] as const;
export type Pattern = (typeof PATTERNS)[number];

export type ExerciseCategory = 'compound' | 'isolation';

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  category: ExerciseCategory;
  pattern: Pattern;
  /** 1-3; how "foundational" the lift is. The generator prefers higher tiers for main lifts. */
  tier: number;
  /** True when weight is optional (push-ups, pull-ups, planks). */
  bodyweight: boolean;
  defaultRestSec: number;
  isCustom: boolean;
  /** Deleted custom exercises that still have history are archived, not removed. */
  archived?: boolean;
}

export type SetType = 'warmup' | 'normal' | 'drop' | 'failure';

export const SET_TYPE_LABEL: Record<SetType, string> = {
  warmup: 'Warm-up',
  normal: 'Working',
  drop: 'Drop set',
  failure: 'Failure',
};

export type PrKind = 'e1rm' | 'weight' | 'volume' | 'reps';

export const PR_LABEL: Record<PrKind, string> = {
  e1rm: 'Est. 1RM',
  weight: 'Heaviest',
  volume: 'Best set volume',
  reps: 'Most reps',
};

export interface Routine {
  id: number;
  name: string;
  notes: string | null;
  source: 'manual' | 'ai';
  createdAt: number;
  updatedAt: number;
  exercises: RoutineExercise[];
}

export interface RoutineExercise {
  id?: number;
  exerciseId: string;
  sets: number;
  reps: number;
  weight: number;
  restSec: number;
}

export interface WorkoutSummary {
  id: number;
  name: string;
  routineId: number | null;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  totalVolume: number;
  totalSets: number;
  prCount: number;
  notes: string | null;
  healthSynced: boolean;
  /** "3 × Bench Press" style lines for list display. */
  exerciseLines: { name: string; sets: number; best: string }[];
}

export interface LoggedSet {
  id: number;
  workoutId: number;
  exerciseId: string;
  position: number;
  type: SetType;
  weight: number;
  reps: number;
  e1rm: number;
  completedAt: number;
  prs: PrKind[];
}

export interface WorkoutDetail extends Omit<WorkoutSummary, 'exerciseLines'> {
  exercises: {
    exerciseId: string;
    name: string;
    notes: string | null;
    sets: LoggedSet[];
  }[];
}

export interface Run {
  id: number;
  source: 'strava' | 'manual';
  externalId: string | null;
  name: string;
  startedAt: number;
  distanceM: number;
  movingTimeSec: number;
  elapsedTimeSec: number;
  elevationGainM: number | null;
  avgHeartrate: number | null;
  sportType: string;
  notes: string | null;
  healthSynced: boolean;
}

export interface Reminder {
  id: number;
  routineId: number | null;
  routineName: string | null;
  /** JavaScript weekdays: 0 = Sunday ... 6 = Saturday. */
  weekdays: number[];
  hour: number;
  minute: number;
  enabled: boolean;
  notificationIds: string[];
}
