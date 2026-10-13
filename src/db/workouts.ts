import { formatSet } from '@/domain/format';
import { computePrFlags, type RecordSet } from '@/domain/records';
import type { LoggedSet, PrKind, SetType, WorkoutDetail, WorkoutSummary } from '@/domain/types';
import type { FinishedWorkout, PreviousSet } from '@/domain/workout';

import { getDb, parseJson } from './client';

interface WorkoutRow {
  id: number;
  name: string;
  routine_id: number | null;
  started_at: number;
  ended_at: number;
  duration_sec: number;
  total_volume: number;
  total_sets: number;
  notes: string | null;
  health_synced: number;
}

interface SetRow {
  id: number;
  workout_id: number;
  workout_exercise_id: number;
  exercise_id: string;
  position: number;
  set_type: string;
  weight: number;
  reps: number;
  e1rm: number;
  completed_at: number;
  pr_flags: string;
}

function toLoggedSet(row: SetRow): LoggedSet {
  return {
    id: row.id,
    workoutId: row.workout_id,
    exerciseId: row.exercise_id,
    position: row.position,
    type: row.set_type as SetType,
    weight: row.weight,
    reps: row.reps,
    e1rm: row.e1rm,
    completedAt: row.completed_at,
    prs: parseJson<PrKind[]>(row.pr_flags, []),
  };
}

function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(', ');
}

export async function saveFinishedWorkout(workout: FinishedWorkout): Promise<number> {
  const db = getDb();
  let workoutId = 0;
  await db.withTransactionAsync(async () => {
    let routineId = workout.routineId;
    if (routineId !== null) {
      const exists = await db.getFirstAsync<{ id: number }>('SELECT id FROM routines WHERE id = ?', routineId);
      if (!exists) routineId = null;
    }
    const result = await db.runAsync(
      `INSERT INTO workouts (name, routine_id, started_at, ended_at, duration_sec, total_volume, total_sets, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      workout.name,
      routineId,
      workout.startedAt,
      workout.endedAt,
      Math.max(0, Math.round((workout.endedAt - workout.startedAt) / 1000)),
      workout.totalVolume,
      workout.totalSets,
      workout.notes.trim() || null,
    );
    workoutId = result.lastInsertRowId;
    for (const [index, exercise] of workout.exercises.entries()) {
      const we = await db.runAsync(
        'INSERT INTO workout_exercises (workout_id, exercise_id, position, notes) VALUES (?, ?, ?, ?)',
        workoutId,
        exercise.exerciseId,
        index,
        exercise.notes.trim() || null,
      );
      for (const [setIndex, set] of exercise.sets.entries()) {
        await db.runAsync(
          `INSERT INTO workout_sets
            (workout_exercise_id, workout_id, exercise_id, position, set_type, weight, reps, e1rm, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          we.lastInsertRowId,
          workoutId,
          exercise.exerciseId,
          setIndex,
          set.type,
          set.weight,
          set.reps,
          set.e1rm,
          set.completedAt,
        );
      }
    }
  });
  await recomputePrFlags([...new Set(workout.exercises.map((e) => e.exerciseId))]);
  return workoutId;
}

/** Re-derives PR badges for the given exercises from their full history. */
export async function recomputePrFlags(exerciseIds: string[]): Promise<void> {
  const db = getDb();
  for (const exerciseId of exerciseIds) {
    const rows = await db.getAllAsync<SetRow & { started_at: number }>(
      `SELECT ws.*, w.started_at FROM workout_sets ws
       JOIN workouts w ON w.id = ws.workout_id
       WHERE ws.exercise_id = ?`,
      exerciseId,
    );
    const input: RecordSet[] = rows.map((r) => ({
      key: r.id,
      workoutId: r.workout_id,
      // Order workouts by when they started so edits to completed_at can't reorder sessions.
      completedAt: r.started_at,
      type: r.set_type as SetType,
      weight: r.weight,
      reps: r.reps,
    }));
    const flags = computePrFlags(input);
    const changed = rows.filter((r) => r.pr_flags !== JSON.stringify(flags.get(r.id) ?? []));
    if (changed.length === 0) continue;
    await db.withTransactionAsync(async () => {
      for (const r of changed) {
        await db.runAsync(
          'UPDATE workout_sets SET pr_flags = ? WHERE id = ?',
          JSON.stringify(flags.get(r.id) ?? []),
          r.id,
        );
      }
    });
  }
}

export async function listWorkoutSummaries(limit = 50, offset = 0): Promise<WorkoutSummary[]> {
  const db = getDb();
  const workouts = await db.getAllAsync<WorkoutRow>(
    'SELECT * FROM workouts ORDER BY started_at DESC LIMIT ? OFFSET ?',
    limit,
    offset,
  );
  return summarize(workouts);
}

export async function listWorkoutSummariesBetween(from: number, to: number): Promise<WorkoutSummary[]> {
  const workouts = await getDb().getAllAsync<WorkoutRow>(
    'SELECT * FROM workouts WHERE started_at >= ? AND started_at < ? ORDER BY started_at DESC',
    from,
    to,
  );
  return summarize(workouts);
}

async function summarize(workouts: WorkoutRow[]): Promise<WorkoutSummary[]> {
  if (workouts.length === 0) return [];
  const ids = workouts.map((w) => w.id);
  const sets = await getDb().getAllAsync<SetRow & { name: string; ex_position: number }>(
    `SELECT ws.*, e.name, we.position AS ex_position FROM workout_sets ws
     JOIN workout_exercises we ON we.id = ws.workout_exercise_id
     JOIN exercises e ON e.id = ws.exercise_id
     WHERE ws.workout_id IN (${placeholders(ids.length)})
     ORDER BY we.position, ws.position`,
    ids,
  );

  const byWorkout = new Map<number, typeof sets>();
  for (const s of sets) {
    const list = byWorkout.get(s.workout_id);
    if (list) list.push(s);
    else byWorkout.set(s.workout_id, [s]);
  }

  return workouts.map((w) => {
    const workoutSets = byWorkout.get(w.id) ?? [];
    const lines = new Map<number, { name: string; sets: number; bestScore: number; best: string }>();
    let prCount = 0;
    for (const s of workoutSets) {
      prCount += parseJson<PrKind[]>(s.pr_flags, []).length;
      const line = lines.get(s.workout_exercise_id) ?? { name: s.name, sets: 0, bestScore: -1, best: '' };
      line.sets++;
      const score = s.weight > 0 ? s.e1rm : s.reps / 1000;
      if (s.set_type !== 'warmup' && score > line.bestScore) {
        line.bestScore = score;
        line.best = formatSet(s.weight, s.reps);
      }
      lines.set(s.workout_exercise_id, line);
    }
    return {
      id: w.id,
      name: w.name,
      routineId: w.routine_id,
      startedAt: w.started_at,
      endedAt: w.ended_at,
      durationSec: w.duration_sec,
      totalVolume: w.total_volume,
      totalSets: w.total_sets,
      prCount,
      notes: w.notes,
      healthSynced: w.health_synced === 1,
      exerciseLines: [...lines.values()].map((l) => ({ name: l.name, sets: l.sets, best: l.best })),
    };
  });
}

export async function getWorkoutDetail(id: number): Promise<WorkoutDetail | null> {
  const db = getDb();
  const w = await db.getFirstAsync<WorkoutRow>('SELECT * FROM workouts WHERE id = ?', id);
  if (!w) return null;
  const exercises = await db.getAllAsync<{ id: number; exercise_id: string; notes: string | null; name: string }>(
    `SELECT we.id, we.exercise_id, we.notes, e.name FROM workout_exercises we
     JOIN exercises e ON e.id = we.exercise_id
     WHERE we.workout_id = ? ORDER BY we.position`,
    id,
  );
  const sets = await db.getAllAsync<SetRow>(
    'SELECT * FROM workout_sets WHERE workout_id = ? ORDER BY position',
    id,
  );
  let prCount = 0;
  const detailExercises = exercises.map((e) => {
    const exSets = sets.filter((s) => s.workout_exercise_id === e.id).map(toLoggedSet);
    prCount += exSets.reduce((n, s) => n + s.prs.length, 0);
    return { exerciseId: e.exercise_id, name: e.name, notes: e.notes, sets: exSets };
  });
  return {
    id: w.id,
    name: w.name,
    routineId: w.routine_id,
    startedAt: w.started_at,
    endedAt: w.ended_at,
    durationSec: w.duration_sec,
    totalVolume: w.total_volume,
    totalSets: w.total_sets,
    prCount,
    notes: w.notes,
    healthSynced: w.health_synced === 1,
    exercises: detailExercises,
  };
}

export async function updateWorkoutMeta(id: number, patch: { name?: string; notes?: string }): Promise<void> {
  const db = getDb();
  if (patch.name !== undefined) await db.runAsync('UPDATE workouts SET name = ? WHERE id = ?', patch.name.trim(), id);
  if (patch.notes !== undefined) {
    await db.runAsync('UPDATE workouts SET notes = ? WHERE id = ?', patch.notes.trim() || null, id);
  }
}

export async function deleteWorkout(id: number): Promise<void> {
  const db = getDb();
  const exerciseIds = await db.getAllAsync<{ exercise_id: string }>(
    'SELECT DISTINCT exercise_id FROM workout_exercises WHERE workout_id = ?',
    id,
  );
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM workout_sets WHERE workout_id = ?', id);
    await db.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?', id);
    await db.runAsync('DELETE FROM workouts WHERE id = ?', id);
  });
  await recomputePrFlags(exerciseIds.map((r) => r.exercise_id));
}

/** Sets from the most recent workout containing each exercise (Strong's "Previous" column). */
export async function getPreviousSets(exerciseIds: string[]): Promise<Record<string, PreviousSet[]>> {
  const db = getDb();
  const result: Record<string, PreviousSet[]> = {};
  for (const exerciseId of new Set(exerciseIds)) {
    const last = await db.getFirstAsync<{ workout_exercise_id: number }>(
      `SELECT ws.workout_exercise_id FROM workout_sets ws
       JOIN workouts w ON w.id = ws.workout_id
       WHERE ws.exercise_id = ?
       ORDER BY w.started_at DESC, ws.workout_exercise_id DESC LIMIT 1`,
      exerciseId,
    );
    if (!last) continue;
    const rows = await db.getAllAsync<SetRow>(
      'SELECT * FROM workout_sets WHERE workout_exercise_id = ? ORDER BY position',
      last.workout_exercise_id,
    );
    result[exerciseId] = rows.map((r) => ({ type: r.set_type as SetType, weight: r.weight, reps: r.reps }));
  }
  return result;
}

export interface ExerciseSession {
  workoutId: number;
  workoutName: string;
  startedAt: number;
  sets: LoggedSet[];
}

/** All logged sessions for an exercise, newest first. */
export async function getExerciseSessions(exerciseId: string): Promise<ExerciseSession[]> {
  const rows = await getDb().getAllAsync<SetRow & { started_at: number; workout_name: string }>(
    `SELECT ws.*, w.started_at, w.name AS workout_name FROM workout_sets ws
     JOIN workouts w ON w.id = ws.workout_id
     WHERE ws.exercise_id = ?
     ORDER BY w.started_at DESC, ws.workout_exercise_id, ws.position`,
    exerciseId,
  );
  const sessions: ExerciseSession[] = [];
  const index = new Map<number, ExerciseSession>();
  for (const r of rows) {
    let session = index.get(r.workout_id);
    if (!session) {
      session = { workoutId: r.workout_id, workoutName: r.workout_name, startedAt: r.started_at, sets: [] };
      index.set(r.workout_id, session);
      sessions.push(session);
    }
    session.sets.push(toLoggedSet(r));
  }
  return sessions;
}

/** Best estimated 1RM per exercise since `since` (used for weight suggestions). */
export async function getRecentBestE1rm(since: number): Promise<Record<string, number>> {
  const rows = await getDb().getAllAsync<{ exercise_id: string; e1rm: number }>(
    `SELECT exercise_id, MAX(e1rm) AS e1rm FROM workout_sets
     WHERE completed_at >= ? AND set_type != 'warmup' AND weight > 0
     GROUP BY exercise_id`,
    since,
  );
  const result: Record<string, number> = {};
  for (const r of rows) result[r.exercise_id] = r.e1rm;
  return result;
}

/** Working sets per primary muscle since `since`. */
export async function getMuscleSetCounts(since: number): Promise<{ muscle: string; sets: number }[]> {
  return getDb().getAllAsync<{ muscle: string; sets: number }>(
    `SELECT e.primary_muscle AS muscle, COUNT(*) AS sets FROM workout_sets ws
     JOIN exercises e ON e.id = ws.exercise_id
     WHERE ws.completed_at >= ? AND ws.set_type != 'warmup'
     GROUP BY e.primary_muscle ORDER BY sets DESC`,
    since,
  );
}

export async function getWorkoutStartTimes(since: number): Promise<number[]> {
  const rows = await getDb().getAllAsync<{ started_at: number }>(
    'SELECT started_at FROM workouts WHERE started_at >= ? ORDER BY started_at',
    since,
  );
  return rows.map((r) => r.started_at);
}

export async function countWorkouts(): Promise<number> {
  const row = await getDb().getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM workouts');
  return row?.n ?? 0;
}

export async function listUnsyncedWorkouts(): Promise<WorkoutRow[]> {
  return getDb().getAllAsync<WorkoutRow>('SELECT * FROM workouts WHERE health_synced = 0 ORDER BY started_at');
}

export async function markWorkoutHealthSynced(id: number): Promise<void> {
  await getDb().runAsync('UPDATE workouts SET health_synced = 1 WHERE id = ?', id);
}
