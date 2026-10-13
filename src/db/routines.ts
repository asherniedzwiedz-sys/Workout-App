import type { Routine, RoutineExercise } from '@/domain/types';
import type { FinishedWorkout } from '@/domain/workout';

import { getDb } from './client';

interface RoutineRow {
  id: number;
  name: string;
  notes: string | null;
  source: string;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

interface RoutineExerciseRow {
  id: number;
  routine_id: number;
  exercise_id: string;
  position: number;
  sets: number;
  reps: number;
  weight: number;
  rest_sec: number;
}

function toRoutine(row: RoutineRow, exercises: RoutineExerciseRow[]): Routine {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    source: row.source === 'ai' ? 'ai' : 'manual',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    exercises: exercises
      .filter((e) => e.routine_id === row.id)
      .sort((a, b) => a.position - b.position)
      .map((e) => ({
        id: e.id,
        exerciseId: e.exercise_id,
        sets: e.sets,
        reps: e.reps,
        weight: e.weight,
        restSec: e.rest_sec,
      })),
  };
}

export async function listRoutines(): Promise<Routine[]> {
  const db = getDb();
  const rows = await db.getAllAsync<RoutineRow>('SELECT * FROM routines ORDER BY sort_order, created_at');
  const exercises = await db.getAllAsync<RoutineExerciseRow>('SELECT * FROM routine_exercises');
  return rows.map((r) => toRoutine(r, exercises));
}

export async function getRoutine(id: number): Promise<Routine | null> {
  const db = getDb();
  const row = await db.getFirstAsync<RoutineRow>('SELECT * FROM routines WHERE id = ?', id);
  if (!row) return null;
  const exercises = await db.getAllAsync<RoutineExerciseRow>(
    'SELECT * FROM routine_exercises WHERE routine_id = ?',
    id,
  );
  return toRoutine(row, exercises);
}

export interface RoutineInput {
  id?: number;
  name: string;
  notes?: string | null;
  source?: 'manual' | 'ai';
  exercises: RoutineExercise[];
}

export async function saveRoutine(input: RoutineInput): Promise<number> {
  const db = getDb();
  const now = Date.now();
  let id = input.id ?? 0;
  await db.withTransactionAsync(async () => {
    if (input.id) {
      await db.runAsync(
        'UPDATE routines SET name = ?, notes = ?, updated_at = ? WHERE id = ?',
        input.name.trim(),
        input.notes?.trim() || null,
        now,
        input.id,
      );
      await db.runAsync('DELETE FROM routine_exercises WHERE routine_id = ?', input.id);
    } else {
      const order = await db.getFirstAsync<{ n: number }>('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM routines');
      const result = await db.runAsync(
        'INSERT INTO routines (name, notes, source, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        input.name.trim(),
        input.notes?.trim() || null,
        input.source ?? 'manual',
        order?.n ?? 1,
        now,
        now,
      );
      id = result.lastInsertRowId;
    }
    for (const [position, e] of input.exercises.entries()) {
      await db.runAsync(
        `INSERT INTO routine_exercises (routine_id, exercise_id, position, sets, reps, weight, rest_sec)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        id,
        e.exerciseId,
        position,
        Math.max(1, Math.round(e.sets)),
        Math.max(1, Math.round(e.reps)),
        Math.max(0, e.weight),
        Math.max(0, Math.round(e.restSec)),
      );
    }
  });
  return id;
}

export async function deleteRoutine(id: number): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM routine_exercises WHERE routine_id = ?', id);
    await db.runAsync('UPDATE workouts SET routine_id = NULL WHERE routine_id = ?', id);
    await db.runAsync('DELETE FROM routines WHERE id = ?', id);
  });
}

export async function duplicateRoutine(id: number): Promise<number | null> {
  const routine = await getRoutine(id);
  if (!routine) return null;
  return saveRoutine({
    name: `${routine.name} (copy)`,
    notes: routine.notes,
    source: routine.source,
    exercises: routine.exercises.map(({ id: _id, ...rest }) => rest),
  });
}

export async function moveRoutine(id: number, direction: -1 | 1): Promise<void> {
  const db = getDb();
  const rows = await db.getAllAsync<{ id: number }>('SELECT id FROM routines ORDER BY sort_order, created_at');
  const index = rows.findIndex((r) => r.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= rows.length) return;
  const ordered = [...rows];
  const [item] = ordered.splice(index, 1);
  if (!item) return;
  ordered.splice(target, 0, item);
  await db.withTransactionAsync(async () => {
    for (const [i, r] of ordered.entries()) {
      await db.runAsync('UPDATE routines SET sort_order = ? WHERE id = ?', i + 1, r.id);
    }
  });
}

/**
 * Updates a routine's targets from a finished workout: each exercise's weight and reps
 * become that day's top working set (Strong's "update template" prompt).
 */
export async function updateRoutineFromWorkout(routineId: number, workout: FinishedWorkout): Promise<boolean> {
  const routine = await getRoutine(routineId);
  if (!routine) return false;
  let changed = false;
  const exercises = routine.exercises.map((re) => {
    const done = workout.exercises.find((e) => e.exerciseId === re.exerciseId);
    const working = done?.sets.filter((s) => s.type !== 'warmup') ?? [];
    if (working.length === 0) return re;
    const top = working.reduce((best, s) => (s.e1rm > best.e1rm || (s.e1rm === best.e1rm && s.reps > best.reps) ? s : best));
    if (top.weight !== re.weight || top.reps !== re.reps) changed = true;
    return { ...re, weight: top.weight, reps: top.reps };
  });
  if (!changed) return false;
  await saveRoutine({ ...routine, exercises: exercises.map(({ id: _id, ...rest }) => rest) });
  return true;
}
