import type { Equipment, Exercise, ExerciseCategory, MuscleGroup, Pattern } from '@/domain/types';
import { makeId } from '@/domain/workout';

import { getDb, parseJson } from './client';

interface ExerciseRow {
  id: string;
  name: string;
  primary_muscle: string;
  secondary_muscles: string;
  equipment: string;
  category: string;
  pattern: string;
  tier: number;
  bodyweight: number;
  default_rest_sec: number;
  is_custom: number;
  archived: number;
}

function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    primaryMuscle: row.primary_muscle as MuscleGroup,
    secondaryMuscles: parseJson<MuscleGroup[]>(row.secondary_muscles, []),
    equipment: row.equipment as Equipment,
    category: row.category as ExerciseCategory,
    pattern: row.pattern as Pattern,
    tier: row.tier,
    bodyweight: row.bodyweight === 1,
    defaultRestSec: row.default_rest_sec,
    isCustom: row.is_custom === 1,
    archived: row.archived === 1,
  };
}

export async function listExercises(): Promise<Exercise[]> {
  const rows = await getDb().getAllAsync<ExerciseRow>(
    'SELECT * FROM exercises WHERE archived = 0 ORDER BY name COLLATE NOCASE',
  );
  return rows.map(toExercise);
}

/** Includes archived exercises so old history still resolves names. */
export async function listAllExercises(): Promise<Exercise[]> {
  const rows = await getDb().getAllAsync<ExerciseRow>('SELECT * FROM exercises');
  return rows.map(toExercise);
}

export async function setExerciseRest(id: string, restSec: number): Promise<void> {
  await getDb().runAsync('UPDATE exercises SET default_rest_sec = ? WHERE id = ?', Math.round(restSec), id);
}

/** Best guess at a movement pattern so custom exercises still group sensibly. */
const PATTERN_FOR_MUSCLE: Record<MuscleGroup, Pattern> = {
  chest: 'horizontal_press',
  shoulders: 'vertical_press',
  triceps: 'triceps',
  biceps: 'biceps',
  forearms: 'grip',
  lats: 'vertical_pull',
  'upper back': 'horizontal_row',
  traps: 'shrug',
  'lower back': 'hinge',
  abs: 'core',
  quads: 'squat',
  hamstrings: 'knee_flexion',
  glutes: 'glute',
  calves: 'calf',
  adductors: 'glute',
  'full body': 'hinge',
};

export async function createCustomExercise(input: {
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  category: ExerciseCategory;
}): Promise<string> {
  const id = makeId('custom');
  const rest = input.category === 'compound' ? 120 : 90;
  await getDb().runAsync(
    `INSERT INTO exercises
      (id, name, primary_muscle, secondary_muscles, equipment, category, pattern, tier, bodyweight, default_rest_sec, is_custom, archived)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1, 0)`,
    id,
    input.name.trim(),
    input.primaryMuscle,
    JSON.stringify(input.secondaryMuscles),
    input.equipment,
    input.category,
    PATTERN_FOR_MUSCLE[input.primaryMuscle],
    input.equipment === 'bodyweight' ? 1 : 0,
    rest,
  );
  return id;
}

/** Deletes a custom exercise, or archives it when history or routines still reference it. */
export async function deleteCustomExercise(id: string): Promise<'deleted' | 'archived'> {
  const db = getDb();
  const used = await db.getFirstAsync<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM workout_exercises WHERE exercise_id = $id)
          + (SELECT COUNT(*) FROM routine_exercises WHERE exercise_id = $id) AS n`,
    { $id: id },
  );
  if ((used?.n ?? 0) > 0) {
    await db.runAsync('UPDATE exercises SET archived = 1 WHERE id = ? AND is_custom = 1', id);
    return 'archived';
  }
  await db.runAsync('DELETE FROM exercises WHERE id = ? AND is_custom = 1', id);
  return 'deleted';
}
