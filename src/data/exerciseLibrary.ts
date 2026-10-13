import type { Equipment, Exercise, ExerciseCategory, MuscleGroup, Pattern } from '@/domain/types';

// Preloaded exercise library. Rows are compact tuples so the list stays scannable:
// [id, name, primary muscle, secondary muscles, equipment, category, pattern, tier, bodyweight?]
// Tier 3 = foundational barbell/cable lifts, 2 = common staples, 1 = variations.
type Row = [
  string,
  string,
  MuscleGroup,
  MuscleGroup[],
  Equipment,
  ExerciseCategory,
  Pattern,
  number,
  boolean?,
];

const ROWS: Row[] = [
  // Chest: horizontal presses
  ['barbell-bench-press', 'Bench Press (Barbell)', 'chest', ['triceps', 'shoulders'], 'barbell', 'compound', 'horizontal_press', 3],
  ['dumbbell-bench-press', 'Bench Press (Dumbbell)', 'chest', ['triceps', 'shoulders'], 'dumbbell', 'compound', 'horizontal_press', 2],
  ['machine-chest-press', 'Chest Press (Machine)', 'chest', ['triceps', 'shoulders'], 'machine', 'compound', 'horizontal_press', 2],
  ['smith-bench-press', 'Bench Press (Smith Machine)', 'chest', ['triceps', 'shoulders'], 'machine', 'compound', 'horizontal_press', 1],
  ['cable-chest-press', 'Chest Press (Cable)', 'chest', ['triceps', 'shoulders'], 'cable', 'compound', 'horizontal_press', 1],
  ['decline-bench-press', 'Decline Bench Press (Barbell)', 'chest', ['triceps'], 'barbell', 'compound', 'horizontal_press', 1],
  ['kettlebell-floor-press', 'Floor Press (Kettlebell)', 'chest', ['triceps'], 'kettlebell', 'compound', 'horizontal_press', 1],
  ['push-up', 'Push-Up', 'chest', ['triceps', 'shoulders'], 'bodyweight', 'compound', 'horizontal_press', 2, true],
  ['chest-dip', 'Chest Dip', 'chest', ['triceps', 'shoulders'], 'bodyweight', 'compound', 'horizontal_press', 1, true],

  // Chest: incline presses
  ['incline-bench-press', 'Incline Bench Press (Barbell)', 'chest', ['shoulders', 'triceps'], 'barbell', 'compound', 'incline_press', 3],
  ['incline-dumbbell-press', 'Incline Bench Press (Dumbbell)', 'chest', ['shoulders', 'triceps'], 'dumbbell', 'compound', 'incline_press', 2],
  ['incline-machine-press', 'Incline Chest Press (Machine)', 'chest', ['shoulders', 'triceps'], 'machine', 'compound', 'incline_press', 2],
  ['incline-cable-press', 'Incline Chest Press (Cable)', 'chest', ['shoulders', 'triceps'], 'cable', 'compound', 'incline_press', 1],
  ['decline-push-up', 'Decline Push-Up', 'chest', ['shoulders', 'triceps'], 'bodyweight', 'compound', 'incline_press', 1, true],

  // Chest: flyes
  ['cable-fly', 'Cable Fly', 'chest', ['shoulders'], 'cable', 'isolation', 'chest_fly', 2],
  ['low-to-high-cable-fly', 'Cable Fly (Low to High)', 'chest', ['shoulders'], 'cable', 'isolation', 'chest_fly', 1],
  ['pec-deck', 'Pec Deck (Machine)', 'chest', [], 'machine', 'isolation', 'chest_fly', 2],
  ['dumbbell-fly', 'Fly (Dumbbell)', 'chest', ['shoulders'], 'dumbbell', 'isolation', 'chest_fly', 1],

  // Shoulders: vertical presses
  ['overhead-press', 'Overhead Press (Barbell)', 'shoulders', ['triceps', 'upper back'], 'barbell', 'compound', 'vertical_press', 3],
  ['push-press', 'Push Press (Barbell)', 'shoulders', ['triceps', 'quads'], 'barbell', 'compound', 'vertical_press', 1],
  ['dumbbell-shoulder-press', 'Shoulder Press (Dumbbell)', 'shoulders', ['triceps'], 'dumbbell', 'compound', 'vertical_press', 2],
  ['arnold-press', 'Arnold Press (Dumbbell)', 'shoulders', ['triceps'], 'dumbbell', 'compound', 'vertical_press', 1],
  ['machine-shoulder-press', 'Shoulder Press (Machine)', 'shoulders', ['triceps'], 'machine', 'compound', 'vertical_press', 2],
  ['kettlebell-press', 'Overhead Press (Kettlebell)', 'shoulders', ['triceps'], 'kettlebell', 'compound', 'vertical_press', 2],
  ['pike-push-up', 'Pike Push-Up', 'shoulders', ['triceps'], 'bodyweight', 'compound', 'vertical_press', 1, true],

  // Shoulders: raises
  ['dumbbell-lateral-raise', 'Lateral Raise (Dumbbell)', 'shoulders', [], 'dumbbell', 'isolation', 'lateral_raise', 2],
  ['cable-lateral-raise', 'Lateral Raise (Cable)', 'shoulders', [], 'cable', 'isolation', 'lateral_raise', 2],
  ['machine-lateral-raise', 'Lateral Raise (Machine)', 'shoulders', [], 'machine', 'isolation', 'lateral_raise', 1],
  ['front-raise', 'Front Raise (Dumbbell)', 'shoulders', [], 'dumbbell', 'isolation', 'lateral_raise', 1],
  ['upright-row', 'Upright Row (Barbell)', 'shoulders', ['traps'], 'barbell', 'compound', 'lateral_raise', 1],
  ['kettlebell-halo', 'Halo (Kettlebell)', 'shoulders', ['abs'], 'kettlebell', 'isolation', 'lateral_raise', 1],

  // Triceps
  ['triceps-pushdown', 'Triceps Pushdown (Cable)', 'triceps', [], 'cable', 'isolation', 'triceps', 2],
  ['overhead-cable-extension', 'Overhead Triceps Extension (Cable)', 'triceps', [], 'cable', 'isolation', 'triceps', 2],
  ['skull-crusher', 'Skull Crusher (Barbell)', 'triceps', [], 'barbell', 'isolation', 'triceps', 2],
  ['close-grip-bench-press', 'Close-Grip Bench Press (Barbell)', 'triceps', ['chest', 'shoulders'], 'barbell', 'compound', 'triceps', 2],
  ['dumbbell-overhead-extension', 'Overhead Triceps Extension (Dumbbell)', 'triceps', [], 'dumbbell', 'isolation', 'triceps', 2],
  ['dumbbell-kickback', 'Triceps Kickback (Dumbbell)', 'triceps', [], 'dumbbell', 'isolation', 'triceps', 1],
  ['machine-triceps-extension', 'Triceps Extension (Machine)', 'triceps', [], 'machine', 'isolation', 'triceps', 1],
  ['kettlebell-overhead-extension', 'Overhead Triceps Extension (Kettlebell)', 'triceps', [], 'kettlebell', 'isolation', 'triceps', 1],
  ['dip', 'Triceps Dip', 'triceps', ['chest', 'shoulders'], 'bodyweight', 'compound', 'triceps', 2, true],
  ['bench-dip', 'Bench Dip', 'triceps', ['shoulders'], 'bodyweight', 'isolation', 'triceps', 1, true],
  ['diamond-push-up', 'Diamond Push-Up', 'triceps', ['chest'], 'bodyweight', 'compound', 'triceps', 1, true],

  // Back: vertical pulls
  ['pull-up', 'Pull-Up', 'lats', ['biceps', 'upper back'], 'bodyweight', 'compound', 'vertical_pull', 3, true],
  ['chin-up', 'Chin-Up', 'lats', ['biceps'], 'bodyweight', 'compound', 'vertical_pull', 2, true],
  ['lat-pulldown', 'Lat Pulldown (Cable)', 'lats', ['biceps', 'upper back'], 'cable', 'compound', 'vertical_pull', 3],
  ['close-grip-pulldown', 'Close-Grip Lat Pulldown (Cable)', 'lats', ['biceps'], 'cable', 'compound', 'vertical_pull', 2],
  ['machine-pulldown', 'Lat Pulldown (Machine)', 'lats', ['biceps'], 'machine', 'compound', 'vertical_pull', 2],
  ['assisted-pull-up', 'Assisted Pull-Up (Machine)', 'lats', ['biceps'], 'machine', 'compound', 'vertical_pull', 1],
  ['straight-arm-pulldown', 'Straight-Arm Pulldown (Cable)', 'lats', [], 'cable', 'isolation', 'vertical_pull', 1],
  ['dumbbell-pullover', 'Pullover (Dumbbell)', 'lats', ['chest'], 'dumbbell', 'isolation', 'vertical_pull', 1],

  // Back: rows
  ['barbell-row', 'Bent-Over Row (Barbell)', 'upper back', ['lats', 'biceps'], 'barbell', 'compound', 'horizontal_row', 3],
  ['pendlay-row', 'Pendlay Row (Barbell)', 'upper back', ['lats', 'biceps'], 'barbell', 'compound', 'horizontal_row', 2],
  ['t-bar-row', 'T-Bar Row', 'upper back', ['lats', 'biceps'], 'barbell', 'compound', 'horizontal_row', 2],
  ['dumbbell-row', 'One-Arm Row (Dumbbell)', 'upper back', ['lats', 'biceps'], 'dumbbell', 'compound', 'horizontal_row', 2],
  ['chest-supported-dumbbell-row', 'Chest-Supported Row (Dumbbell)', 'upper back', ['lats', 'biceps'], 'dumbbell', 'compound', 'horizontal_row', 2],
  ['seated-cable-row', 'Seated Row (Cable)', 'upper back', ['lats', 'biceps'], 'cable', 'compound', 'horizontal_row', 3],
  ['machine-row', 'Chest-Supported Row (Machine)', 'upper back', ['lats', 'biceps'], 'machine', 'compound', 'horizontal_row', 2],
  ['kettlebell-row', 'Row (Kettlebell)', 'upper back', ['lats', 'biceps'], 'kettlebell', 'compound', 'horizontal_row', 2],
  ['inverted-row', 'Inverted Row', 'upper back', ['lats', 'biceps'], 'bodyweight', 'compound', 'horizontal_row', 2, true],

  // Back: rear delts / upper back isolation
  ['face-pull', 'Face Pull (Cable)', 'upper back', ['shoulders', 'traps'], 'cable', 'isolation', 'rear_delt', 2],
  ['reverse-pec-deck', 'Reverse Fly (Machine)', 'upper back', ['shoulders'], 'machine', 'isolation', 'rear_delt', 2],
  ['dumbbell-reverse-fly', 'Reverse Fly (Dumbbell)', 'upper back', ['shoulders'], 'dumbbell', 'isolation', 'rear_delt', 1],
  ['cable-reverse-fly', 'Reverse Fly (Cable)', 'upper back', ['shoulders'], 'cable', 'isolation', 'rear_delt', 1],
  ['ytw-raise', 'Y-T-W Raise', 'upper back', ['shoulders'], 'bodyweight', 'isolation', 'rear_delt', 1, true],

  // Biceps
  ['barbell-curl', 'Curl (Barbell)', 'biceps', ['forearms'], 'barbell', 'isolation', 'biceps', 2],
  ['preacher-curl', 'Preacher Curl (Barbell)', 'biceps', [], 'barbell', 'isolation', 'biceps', 1],
  ['dumbbell-curl', 'Curl (Dumbbell)', 'biceps', ['forearms'], 'dumbbell', 'isolation', 'biceps', 2],
  ['hammer-curl', 'Hammer Curl (Dumbbell)', 'biceps', ['forearms'], 'dumbbell', 'isolation', 'biceps', 2],
  ['incline-dumbbell-curl', 'Incline Curl (Dumbbell)', 'biceps', [], 'dumbbell', 'isolation', 'biceps', 1],
  ['cable-curl', 'Curl (Cable)', 'biceps', ['forearms'], 'cable', 'isolation', 'biceps', 2],
  ['machine-preacher-curl', 'Preacher Curl (Machine)', 'biceps', [], 'machine', 'isolation', 'biceps', 1],
  ['kettlebell-curl', 'Curl (Kettlebell)', 'biceps', ['forearms'], 'kettlebell', 'isolation', 'biceps', 1],

  // Traps and grip
  ['barbell-shrug', 'Shrug (Barbell)', 'traps', [], 'barbell', 'isolation', 'shrug', 2],
  ['dumbbell-shrug', 'Shrug (Dumbbell)', 'traps', [], 'dumbbell', 'isolation', 'shrug', 2],
  ['machine-shrug', 'Shrug (Machine)', 'traps', [], 'machine', 'isolation', 'shrug', 1],
  ['wrist-curl', 'Wrist Curl (Dumbbell)', 'forearms', [], 'dumbbell', 'isolation', 'grip', 1],
  ['reverse-curl', 'Reverse Curl (Barbell)', 'forearms', ['biceps'], 'barbell', 'isolation', 'grip', 1],

  // Legs: squats
  ['back-squat', 'Squat (Barbell)', 'quads', ['glutes', 'hamstrings', 'lower back'], 'barbell', 'compound', 'squat', 3],
  ['front-squat', 'Front Squat (Barbell)', 'quads', ['glutes', 'abs'], 'barbell', 'compound', 'squat', 2],
  ['leg-press', 'Leg Press (Machine)', 'quads', ['glutes'], 'machine', 'compound', 'squat', 2],
  ['hack-squat', 'Hack Squat (Machine)', 'quads', ['glutes'], 'machine', 'compound', 'squat', 2],
  ['smith-squat', 'Squat (Smith Machine)', 'quads', ['glutes'], 'machine', 'compound', 'squat', 1],
  ['goblet-squat', 'Goblet Squat (Dumbbell)', 'quads', ['glutes'], 'dumbbell', 'compound', 'squat', 2],
  ['kettlebell-goblet-squat', 'Goblet Squat (Kettlebell)', 'quads', ['glutes'], 'kettlebell', 'compound', 'squat', 2],
  ['air-squat', 'Air Squat', 'quads', ['glutes'], 'bodyweight', 'compound', 'squat', 1, true],

  // Legs: hinges
  ['deadlift', 'Deadlift (Barbell)', 'lower back', ['glutes', 'hamstrings', 'traps', 'forearms'], 'barbell', 'compound', 'hinge', 3],
  ['sumo-deadlift', 'Sumo Deadlift (Barbell)', 'glutes', ['quads', 'hamstrings', 'adductors'], 'barbell', 'compound', 'hinge', 1],
  ['trap-bar-deadlift', 'Trap Bar Deadlift', 'glutes', ['quads', 'hamstrings', 'traps'], 'barbell', 'compound', 'hinge', 1],
  ['romanian-deadlift', 'Romanian Deadlift (Barbell)', 'hamstrings', ['glutes', 'lower back'], 'barbell', 'compound', 'hinge', 2],
  ['dumbbell-rdl', 'Romanian Deadlift (Dumbbell)', 'hamstrings', ['glutes', 'lower back'], 'dumbbell', 'compound', 'hinge', 2],
  ['good-morning', 'Good Morning (Barbell)', 'hamstrings', ['lower back', 'glutes'], 'barbell', 'compound', 'hinge', 1],
  ['power-clean', 'Power Clean (Barbell)', 'full body', ['traps', 'quads', 'glutes', 'hamstrings'], 'barbell', 'compound', 'hinge', 1],
  ['kettlebell-swing', 'Kettlebell Swing', 'glutes', ['hamstrings', 'lower back'], 'kettlebell', 'compound', 'hinge', 2],
  ['kettlebell-deadlift', 'Deadlift (Kettlebell)', 'hamstrings', ['glutes', 'lower back'], 'kettlebell', 'compound', 'hinge', 1],
  ['cable-pull-through', 'Pull-Through (Cable)', 'glutes', ['hamstrings'], 'cable', 'compound', 'hinge', 1],
  ['back-extension', 'Back Extension', 'lower back', ['glutes', 'hamstrings'], 'bodyweight', 'isolation', 'hinge', 1, true],
  ['single-leg-rdl', 'Single-Leg Romanian Deadlift', 'hamstrings', ['glutes'], 'bodyweight', 'compound', 'hinge', 1, true],

  // Legs: lunges and split squats
  ['bulgarian-split-squat', 'Bulgarian Split Squat (Dumbbell)', 'quads', ['glutes'], 'dumbbell', 'compound', 'lunge', 2],
  ['walking-lunge', 'Walking Lunge (Dumbbell)', 'quads', ['glutes'], 'dumbbell', 'compound', 'lunge', 2],
  ['step-up', 'Step-Up (Dumbbell)', 'quads', ['glutes'], 'dumbbell', 'compound', 'lunge', 1],
  ['barbell-reverse-lunge', 'Reverse Lunge (Barbell)', 'quads', ['glutes'], 'barbell', 'compound', 'lunge', 1],
  ['kettlebell-reverse-lunge', 'Goblet Reverse Lunge (Kettlebell)', 'quads', ['glutes'], 'kettlebell', 'compound', 'lunge', 1],
  ['lunge', 'Lunge', 'quads', ['glutes'], 'bodyweight', 'compound', 'lunge', 1, true],
  ['bodyweight-split-squat', 'Bulgarian Split Squat (Bodyweight)', 'quads', ['glutes'], 'bodyweight', 'compound', 'lunge', 1, true],

  // Legs: isolation
  ['leg-extension', 'Leg Extension (Machine)', 'quads', [], 'machine', 'isolation', 'knee_extension', 2],
  ['sissy-squat', 'Sissy Squat', 'quads', [], 'bodyweight', 'isolation', 'knee_extension', 1, true],
  ['lying-leg-curl', 'Lying Leg Curl (Machine)', 'hamstrings', [], 'machine', 'isolation', 'knee_flexion', 2],
  ['seated-leg-curl', 'Seated Leg Curl (Machine)', 'hamstrings', [], 'machine', 'isolation', 'knee_flexion', 2],
  ['cable-leg-curl', 'Standing Leg Curl (Cable)', 'hamstrings', [], 'cable', 'isolation', 'knee_flexion', 1],
  ['dumbbell-leg-curl', 'Leg Curl (Dumbbell)', 'hamstrings', [], 'dumbbell', 'isolation', 'knee_flexion', 1],
  ['nordic-curl', 'Nordic Hamstring Curl', 'hamstrings', [], 'bodyweight', 'isolation', 'knee_flexion', 1, true],
  ['hip-thrust', 'Hip Thrust (Barbell)', 'glutes', ['hamstrings'], 'barbell', 'compound', 'glute', 2],
  ['dumbbell-hip-thrust', 'Hip Thrust (Dumbbell)', 'glutes', ['hamstrings'], 'dumbbell', 'compound', 'glute', 1],
  ['machine-hip-thrust', 'Hip Thrust (Machine)', 'glutes', ['hamstrings'], 'machine', 'compound', 'glute', 1],
  ['cable-kickback', 'Glute Kickback (Cable)', 'glutes', [], 'cable', 'isolation', 'glute', 1],
  ['hip-abduction', 'Hip Abduction (Machine)', 'glutes', [], 'machine', 'isolation', 'glute', 1],
  ['hip-adduction', 'Hip Adduction (Machine)', 'adductors', [], 'machine', 'isolation', 'glute', 1],
  ['glute-bridge', 'Glute Bridge', 'glutes', ['hamstrings'], 'bodyweight', 'isolation', 'glute', 1, true],
  ['standing-calf-raise', 'Standing Calf Raise (Machine)', 'calves', [], 'machine', 'isolation', 'calf', 2],
  ['seated-calf-raise', 'Seated Calf Raise (Machine)', 'calves', [], 'machine', 'isolation', 'calf', 2],
  ['leg-press-calf-raise', 'Calf Press (Leg Press)', 'calves', [], 'machine', 'isolation', 'calf', 1],
  ['barbell-calf-raise', 'Calf Raise (Barbell)', 'calves', [], 'barbell', 'isolation', 'calf', 1],
  ['dumbbell-calf-raise', 'Calf Raise (Dumbbell)', 'calves', [], 'dumbbell', 'isolation', 'calf', 1],
  ['bodyweight-calf-raise', 'Calf Raise (Bodyweight)', 'calves', [], 'bodyweight', 'isolation', 'calf', 1, true],

  // Core
  ['hanging-leg-raise', 'Hanging Leg Raise', 'abs', [], 'bodyweight', 'isolation', 'core', 2, true],
  ['ab-wheel', 'Ab Wheel Rollout', 'abs', [], 'bodyweight', 'isolation', 'core', 2, true],
  ['crunch', 'Crunch', 'abs', [], 'bodyweight', 'isolation', 'core', 1, true],
  ['dead-bug', 'Dead Bug', 'abs', [], 'bodyweight', 'isolation', 'core', 1, true],
  ['cable-crunch', 'Cable Crunch', 'abs', [], 'cable', 'isolation', 'core', 2],
  ['cable-woodchop', 'Woodchop (Cable)', 'abs', [], 'cable', 'isolation', 'core', 1],
  ['pallof-press', 'Pallof Press (Cable)', 'abs', [], 'cable', 'isolation', 'core', 1],
  ['machine-crunch', 'Ab Crunch (Machine)', 'abs', [], 'machine', 'isolation', 'core', 1],
  ['weighted-sit-up', 'Weighted Sit-Up (Dumbbell)', 'abs', [], 'dumbbell', 'isolation', 'core', 1],
  ['kettlebell-russian-twist', 'Russian Twist (Kettlebell)', 'abs', [], 'kettlebell', 'isolation', 'core', 1],
];

function defaultRest(category: ExerciseCategory, tier: number, primary: MuscleGroup): number {
  if (primary === 'abs') return 60;
  if (category === 'isolation') return 90;
  return tier >= 3 ? 180 : 120;
}

export const EXERCISE_LIBRARY: Exercise[] = ROWS.map(
  ([id, name, primaryMuscle, secondaryMuscles, equipment, category, pattern, tier, bodyweight]) => ({
    id,
    name,
    primaryMuscle,
    secondaryMuscles,
    equipment,
    category,
    pattern,
    tier,
    bodyweight: bodyweight ?? false,
    defaultRestSec: defaultRest(category, tier, primaryMuscle),
    isCustom: false,
  }),
);
