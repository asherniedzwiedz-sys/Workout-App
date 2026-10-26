export const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell'] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const MUSCLES = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'traps',
  'quads', 'hamstrings', 'glutes', 'calves', 'core',
] as const;
export type Muscle = (typeof MUSCLES)[number];

/** Movement pattern drives push/pull/legs splits. Core work is scheduled on leg days. */
export type Pattern = 'push' | 'pull' | 'legs' | 'core';

/**
 * Apple Watch motion support.
 * wrist  = in the v1 seed list the watch classifier is trained on.
 * manual = lower-body lift: the wrist barely moves, so motion detection can't see it reliably.
 * undefined = upper-body lift not in the v1 seed list yet (log manually).
 */
export type Motion = 'wrist' | 'manual';

export type ExerciseDef = {
  id: string;
  name: string;
  muscle: Muscle;
  secondary: Muscle[];
  equipment: Equipment;
  pattern: Pattern;
  compound: boolean;
  restSec: number;
  motion?: Motion;
};

type Row = [id: string, name: string, muscle: Muscle, equipment: Equipment, pattern: Pattern, compound: 0 | 1, secondary?: Muscle[], motion?: Motion];

// prettier-ignore
const ROWS: Row[] = [
  // Chest
  ['barbell-bench-press', 'Barbell Bench Press', 'chest', 'barbell', 'push', 1, ['triceps', 'shoulders'], 'wrist'],
  ['incline-barbell-bench-press', 'Incline Barbell Bench Press', 'chest', 'barbell', 'push', 1, ['shoulders', 'triceps']],
  ['dumbbell-bench-press', 'Dumbbell Bench Press', 'chest', 'dumbbell', 'push', 1, ['triceps', 'shoulders'], 'wrist'],
  ['incline-dumbbell-press', 'Incline Dumbbell Press', 'chest', 'dumbbell', 'push', 1, ['shoulders', 'triceps']],
  ['chest-fly', 'Dumbbell Chest Fly', 'chest', 'dumbbell', 'push', 0, [], 'wrist'],
  ['cable-fly', 'Cable Fly', 'chest', 'cable', 'push', 0],
  ['machine-chest-press', 'Machine Chest Press', 'chest', 'machine', 'push', 1, ['triceps']],
  ['pec-deck', 'Pec Deck', 'chest', 'machine', 'push', 0],
  ['push-up', 'Push-Up', 'chest', 'bodyweight', 'push', 1, ['triceps', 'shoulders'], 'wrist'],
  ['dip', 'Dip', 'chest', 'bodyweight', 'push', 1, ['triceps']],
  // Shoulders
  ['overhead-press', 'Overhead Press', 'shoulders', 'barbell', 'push', 1, ['triceps'], 'wrist'],
  ['dumbbell-shoulder-press', 'Dumbbell Shoulder Press', 'shoulders', 'dumbbell', 'push', 1, ['triceps'], 'wrist'],
  ['arnold-press', 'Arnold Press', 'shoulders', 'dumbbell', 'push', 1, ['triceps']],
  ['machine-shoulder-press', 'Machine Shoulder Press', 'shoulders', 'machine', 'push', 1, ['triceps']],
  ['kettlebell-press', 'Kettlebell Overhead Press', 'shoulders', 'kettlebell', 'push', 1, ['triceps']],
  ['lateral-raise', 'Lateral Raise', 'shoulders', 'dumbbell', 'push', 0, [], 'wrist'],
  ['cable-lateral-raise', 'Cable Lateral Raise', 'shoulders', 'cable', 'push', 0],
  ['front-raise', 'Front Raise', 'shoulders', 'dumbbell', 'push', 0, [], 'wrist'],
  ['face-pull', 'Face Pull', 'shoulders', 'cable', 'pull', 0, ['traps']],
  ['rear-delt-fly', 'Rear Delt Fly', 'shoulders', 'dumbbell', 'pull', 0, ['traps']],
  // Triceps
  ['tricep-extension', 'Dumbbell Overhead Tricep Extension', 'triceps', 'dumbbell', 'push', 0, [], 'wrist'],
  ['tricep-pushdown', 'Cable Tricep Pushdown', 'triceps', 'cable', 'push', 0],
  ['overhead-cable-extension', 'Overhead Cable Extension', 'triceps', 'cable', 'push', 0],
  ['skull-crusher', 'Skull Crusher', 'triceps', 'barbell', 'push', 0],
  ['close-grip-bench-press', 'Close-Grip Bench Press', 'triceps', 'barbell', 'push', 1, ['chest']],
  ['bench-dip', 'Bench Dip', 'triceps', 'bodyweight', 'push', 0],
  // Back
  ['barbell-row', 'Barbell Row', 'back', 'barbell', 'pull', 1, ['biceps'], 'wrist'],
  ['dumbbell-row', 'One-Arm Dumbbell Row', 'back', 'dumbbell', 'pull', 1, ['biceps'], 'wrist'],
  ['pull-up', 'Pull-Up', 'back', 'bodyweight', 'pull', 1, ['biceps']],
  ['chin-up', 'Chin-Up', 'back', 'bodyweight', 'pull', 1, ['biceps']],
  ['inverted-row', 'Inverted Row', 'back', 'bodyweight', 'pull', 1, ['biceps']],
  ['lat-pulldown', 'Lat Pulldown', 'back', 'cable', 'pull', 1, ['biceps']],
  ['seated-cable-row', 'Seated Cable Row', 'back', 'cable', 'pull', 1, ['biceps']],
  ['straight-arm-pulldown', 'Straight-Arm Pulldown', 'back', 'cable', 'pull', 0],
  ['t-bar-row', 'T-Bar Row', 'back', 'machine', 'pull', 1, ['biceps']],
  ['machine-row', 'Machine Row', 'back', 'machine', 'pull', 1, ['biceps']],
  ['kettlebell-row', 'Kettlebell Row', 'back', 'kettlebell', 'pull', 1, ['biceps']],
  ['shrug', 'Dumbbell Shrug', 'traps', 'dumbbell', 'pull', 0],
  // Biceps & forearms
  ['dumbbell-curl', 'Dumbbell Curl', 'biceps', 'dumbbell', 'pull', 0, [], 'wrist'],
  ['hammer-curl', 'Hammer Curl', 'biceps', 'dumbbell', 'pull', 0, ['forearms'], 'wrist'],
  ['barbell-curl', 'Barbell Curl', 'biceps', 'barbell', 'pull', 0],
  ['incline-dumbbell-curl', 'Incline Dumbbell Curl', 'biceps', 'dumbbell', 'pull', 0],
  ['concentration-curl', 'Concentration Curl', 'biceps', 'dumbbell', 'pull', 0],
  ['cable-curl', 'Cable Curl', 'biceps', 'cable', 'pull', 0],
  ['preacher-curl', 'Machine Preacher Curl', 'biceps', 'machine', 'pull', 0],
  ['wrist-curl', 'Wrist Curl', 'forearms', 'dumbbell', 'pull', 0],
  ['farmers-carry', "Farmer's Carry", 'forearms', 'dumbbell', 'pull', 0, ['traps']],
  // Legs (manual only on the watch)
  ['barbell-squat', 'Barbell Back Squat', 'quads', 'barbell', 'legs', 1, ['glutes', 'hamstrings'], 'manual'],
  ['front-squat', 'Front Squat', 'quads', 'barbell', 'legs', 1, ['glutes'], 'manual'],
  ['goblet-squat', 'Goblet Squat', 'quads', 'dumbbell', 'legs', 1, ['glutes'], 'manual'],
  ['kettlebell-goblet-squat', 'Kettlebell Goblet Squat', 'quads', 'kettlebell', 'legs', 1, ['glutes'], 'manual'],
  ['bodyweight-squat', 'Bodyweight Squat', 'quads', 'bodyweight', 'legs', 1, ['glutes'], 'manual'],
  ['leg-press', 'Leg Press', 'quads', 'machine', 'legs', 1, ['glutes'], 'manual'],
  ['hack-squat', 'Hack Squat', 'quads', 'machine', 'legs', 1, ['glutes'], 'manual'],
  ['bulgarian-split-squat', 'Bulgarian Split Squat', 'quads', 'dumbbell', 'legs', 1, ['glutes'], 'manual'],
  ['walking-lunge', 'Walking Lunge', 'quads', 'dumbbell', 'legs', 1, ['glutes'], 'manual'],
  ['leg-extension', 'Leg Extension', 'quads', 'machine', 'legs', 0, [], 'manual'],
  ['deadlift', 'Deadlift', 'hamstrings', 'barbell', 'legs', 1, ['glutes', 'back', 'traps'], 'manual'],
  ['romanian-deadlift', 'Romanian Deadlift', 'hamstrings', 'barbell', 'legs', 1, ['glutes'], 'manual'],
  ['dumbbell-rdl', 'Dumbbell Romanian Deadlift', 'hamstrings', 'dumbbell', 'legs', 1, ['glutes'], 'manual'],
  ['leg-curl', 'Lying Leg Curl', 'hamstrings', 'machine', 'legs', 0, [], 'manual'],
  ['seated-leg-curl', 'Seated Leg Curl', 'hamstrings', 'machine', 'legs', 0, [], 'manual'],
  ['hip-thrust', 'Barbell Hip Thrust', 'glutes', 'barbell', 'legs', 1, ['hamstrings'], 'manual'],
  ['glute-bridge', 'Glute Bridge', 'glutes', 'bodyweight', 'legs', 0, ['hamstrings'], 'manual'],
  ['cable-kickback', 'Cable Glute Kickback', 'glutes', 'cable', 'legs', 0, [], 'manual'],
  ['kettlebell-swing', 'Kettlebell Swing', 'glutes', 'kettlebell', 'legs', 1, ['hamstrings'], 'manual'],
  ['standing-calf-raise', 'Standing Calf Raise', 'calves', 'machine', 'legs', 0, [], 'manual'],
  ['seated-calf-raise', 'Seated Calf Raise', 'calves', 'machine', 'legs', 0, [], 'manual'],
  ['bodyweight-calf-raise', 'Bodyweight Calf Raise', 'calves', 'bodyweight', 'legs', 0, [], 'manual'],
  // Core
  ['hanging-leg-raise', 'Hanging Leg Raise', 'core', 'bodyweight', 'core', 0],
  ['ab-wheel', 'Ab Wheel Rollout', 'core', 'bodyweight', 'core', 0],
  ['crunch', 'Crunch', 'core', 'bodyweight', 'core', 0],
  ['cable-crunch', 'Cable Crunch', 'core', 'cable', 'core', 0],
  ['russian-twist', 'Kettlebell Russian Twist', 'core', 'kettlebell', 'core', 0],
];

export const EXERCISES: ExerciseDef[] = ROWS.map(([id, name, muscle, equipment, pattern, compound, secondary = [], motion]) => ({
  id, name, muscle, secondary, equipment, pattern,
  compound: compound === 1,
  restSec: compound === 1 ? (pattern === 'legs' ? 180 : 150) : 90,
  ...(motion ? { motion } : {}),
}));

export const EXERCISE_BY_ID: ReadonlyMap<string, ExerciseDef> = new Map(EXERCISES.map((e) => [e.id, e]));

/** The 13 wrist-visible lifts the v1 watch classifier knows. Must match the watch's seed list and training labels. */
export const WRIST_SEED_IDS = EXERCISES.filter((e) => e.motion === 'wrist').map((e) => e.id);

/** Display name for an exercise id or the classifier's "other" class. */
export const labelName = (id: string) => (id === 'other' ? 'Other / Rest' : EXERCISE_BY_ID.get(id)?.name ?? id);

export const MANUAL_ONLY_REASON =
  'Manual only on Apple Watch: your wrist barely moves (or moves the same way) in lower-body lifts, so motion detection can’t tell reps or the exercise apart reliably.';
