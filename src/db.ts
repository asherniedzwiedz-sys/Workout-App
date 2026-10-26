import * as SQLite from 'expo-sqlite';
import { EXERCISES, type Equipment, type Motion, type Muscle, type Pattern } from './logic/exercises';
import type { LoggedSet } from './logic/stats';

// shortcut: one connection + the sync API on the JS thread (sub-ms for this data size); move history queries to async if lists get slow.
export const db = SQLite.openDatabaseSync('liftlog.db', { enableChangeListener: true });

const SCHEMA = `
CREATE TABLE exercises (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  muscle TEXT NOT NULL,
  secondary TEXT NOT NULL DEFAULT '',
  equipment TEXT NOT NULL,
  pattern TEXT NOT NULL,
  compound INTEGER NOT NULL DEFAULT 0,
  rest_sec INTEGER NOT NULL DEFAULT 90,
  motion TEXT
);
CREATE TABLE routines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE routine_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  position INTEGER NOT NULL,
  sets INTEGER NOT NULL DEFAULT 3,
  reps INTEGER NOT NULL DEFAULT 10,
  weight REAL NOT NULL DEFAULT 0,
  rest_sec INTEGER
);
CREATE TABLE workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id INTEGER REFERENCES routines(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  health_synced INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX workouts_started ON workouts(started_at);
CREATE TABLE workout_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  position INTEGER NOT NULL,
  rest_sec INTEGER NOT NULL,
  skipped INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX we_workout ON workout_exercises(workout_id);
CREATE INDEX we_exercise ON workout_exercises(exercise_id);
CREATE TABLE sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  reps INTEGER NOT NULL DEFAULT 0,
  weight REAL NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER,
  completed_at INTEGER,
  uid TEXT UNIQUE,
  source TEXT NOT NULL DEFAULT 'phone'
);
CREATE INDEX sets_we ON sets(workout_exercise_id);
CREATE TABLE runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strava_id TEXT UNIQUE,
  name TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  distance_m REAL NOT NULL,
  duration_s INTEGER NOT NULL,
  source TEXT NOT NULL
);
CREATE INDEX runs_started ON runs(started_at);
CREATE TABLE reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id INTEGER REFERENCES routines(id) ON DELETE SET NULL,
  weekdays TEXT NOT NULL,
  hour INTEGER NOT NULL,
  minute INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  notif_ids TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE motion_predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  set_uid TEXT UNIQUE,
  mode TEXT NOT NULL,
  predicted_exercise_id TEXT,
  confidence REAL,
  top3 TEXT NOT NULL DEFAULT '[]',
  confirmed_exercise_id TEXT NOT NULL,
  reps_counted INTEGER,
  reps_confirmed INTEGER NOT NULL,
  weight REAL NOT NULL
);
`;

const MIGRATIONS = [SCHEMA];

export function migrate() {
  db.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const version = db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
  MIGRATIONS.slice(version).forEach((sql, i) =>
    db.withTransactionSync(() => {
      db.execSync(sql);
      db.execSync(`PRAGMA user_version = ${version + i + 1}`);
    }),
  );
  // Re-seed every launch so library fixes ship with app updates; ids are stable so history is untouched.
  const upsert = db.prepareSync(
    `INSERT INTO exercises (id, name, muscle, secondary, equipment, pattern, compound, rest_sec, motion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, muscle=excluded.muscle, secondary=excluded.secondary,
       equipment=excluded.equipment, pattern=excluded.pattern, compound=excluded.compound, motion=excluded.motion`,
  );
  try {
    db.withTransactionSync(() => {
      for (const e of EXERCISES) {
        upsert.executeSync([e.id, e.name, e.muscle, e.secondary.join(','), e.equipment, e.pattern, e.compound ? 1 : 0, e.restSec, e.motion ?? null]);
      }
    });
  } finally {
    upsert.finalizeSync();
  }
}

// ---------- Types ----------

export type Exercise = {
  id: string; name: string; muscle: Muscle; secondary: string; equipment: Equipment; pattern: Pattern;
  compound: number; rest_sec: number; motion: Motion | null;
};
export type Routine = { id: number; name: string; created_at: number; exercise_count: number; summary: string };
export type RoutineExercise = { exercise_id: string; name: string; sets: number; reps: number; weight: number; rest_sec: number | null };
export type Workout = { id: number; routine_id: number | null; name: string; started_at: number; ended_at: number | null; health_synced: number };
export type SetRow = {
  id: number; workout_exercise_id: number; position: number; reps: number; weight: number; done: number;
  completed_at: number | null; uid: string | null; source: string;
};
export type WorkoutExercise = {
  id: number; workout_id: number; exercise_id: string; position: number; rest_sec: number; skipped: number;
  name: string; motion: Motion | null; sets: SetRow[]; previous: { weight: number; reps: number }[];
};
export type WorkoutSummary = Workout & { volume: number; set_count: number; exercise_names: string };
export type Run = { id: number; strava_id: string | null; name: string; started_at: number; distance_m: number; duration_s: number; source: 'strava' | 'manual' };
export type Reminder = { id: number; routine_id: number | null; routine_name: string | null; weekdays: string; hour: number; minute: number; enabled: number; notif_ids: string };

// ---------- Exercises ----------

export const listExercises = () => db.getAllSync<Exercise>('SELECT * FROM exercises ORDER BY name');
export const getExercise = (id: string) => db.getFirstSync<Exercise>('SELECT * FROM exercises WHERE id = ?', id);

// ---------- Routines ----------

export const listRoutines = () =>
  db.getAllSync<Routine>(
    `SELECT r.*, COUNT(re.id) AS exercise_count, COALESCE(GROUP_CONCAT(e.name, ', '), '') AS summary
     FROM routines r LEFT JOIN routine_exercises re ON re.routine_id = r.id LEFT JOIN exercises e ON e.id = re.exercise_id
     GROUP BY r.id ORDER BY r.name COLLATE NOCASE`,
  );

export function getRoutine(id: number) {
  const routine = db.getFirstSync<{ id: number; name: string }>('SELECT id, name FROM routines WHERE id = ?', id);
  if (!routine) return null;
  const exercises = db.getAllSync<RoutineExercise>(
    `SELECT re.exercise_id, e.name, re.sets, re.reps, re.weight, re.rest_sec
     FROM routine_exercises re JOIN exercises e ON e.id = re.exercise_id WHERE re.routine_id = ? ORDER BY re.position`,
    id,
  );
  return { ...routine, exercises };
}

export function saveRoutine(routine: { id?: number; name: string; exercises: Omit<RoutineExercise, 'name'>[] }): number {
  let id = routine.id;
  db.withTransactionSync(() => {
    if (id) {
      db.runSync('UPDATE routines SET name = ? WHERE id = ?', routine.name, id);
      db.runSync('DELETE FROM routine_exercises WHERE routine_id = ?', id);
    } else {
      id = db.runSync('INSERT INTO routines (name, created_at) VALUES (?, ?)', routine.name, Date.now()).lastInsertRowId;
    }
    routine.exercises.forEach((e, i) =>
      db.runSync(
        'INSERT INTO routine_exercises (routine_id, exercise_id, position, sets, reps, weight, rest_sec) VALUES (?, ?, ?, ?, ?, ?, ?)',
        id!, e.exercise_id, i, e.sets, e.reps, e.weight, e.rest_sec,
      ),
    );
  });
  return id!;
}

export const deleteRoutine = (id: number) => db.runSync('DELETE FROM routines WHERE id = ?', id);

// ---------- Workouts ----------

export const activeWorkout = () => db.getFirstSync<Workout>('SELECT * FROM workouts WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1');

/** Most recent done weight for an exercise, used to pre-fill sets. */
export const lastWeight = (exerciseId: string) =>
  db.getFirstSync<{ weight: number }>(
    `SELECT s.weight FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
     WHERE we.exercise_id = ? AND s.done = 1 ORDER BY s.completed_at DESC LIMIT 1`,
    exerciseId,
  )?.weight ?? 0;

const exerciseRest = (exerciseId: string) =>
  db.getFirstSync<{ rest_sec: number }>('SELECT rest_sec FROM exercises WHERE id = ?', exerciseId)?.rest_sec ?? 90;

function insertWorkoutExercise(workoutId: number, exerciseId: string, restSec: number | null, sets: { reps: number; weight: number }[]) {
  const position = db.getFirstSync<{ p: number }>('SELECT COALESCE(MAX(position) + 1, 0) AS p FROM workout_exercises WHERE workout_id = ?', workoutId)?.p ?? 0;
  const weId = db.runSync(
    'INSERT INTO workout_exercises (workout_id, exercise_id, position, rest_sec) VALUES (?, ?, ?, ?)',
    workoutId, exerciseId, position, restSec ?? exerciseRest(exerciseId),
  ).lastInsertRowId;
  sets.forEach((s, i) => db.runSync('INSERT INTO sets (workout_exercise_id, position, reps, weight) VALUES (?, ?, ?, ?)', weId, i, s.reps, s.weight));
  return weId;
}

/** Starts a workout (or returns the one already in progress). Planned sets come pre-filled from the routine or last session. */
export function startWorkout(routineId: number | null, startedAt = Date.now()): number {
  const current = activeWorkout();
  if (current) return current.id;
  let id = 0;
  db.withTransactionSync(() => (id = createWorkout(routineId, startedAt)));
  return id;
}

/** Caller owns the transaction (SQLite has no nested transactions). */
function createWorkout(routineId: number | null, startedAt: number): number {
  const routine = routineId ? getRoutine(routineId) : null;
  const id = db.runSync('INSERT INTO workouts (routine_id, name, started_at) VALUES (?, ?, ?)', routine?.id ?? null, routine?.name ?? 'Workout', startedAt).lastInsertRowId;
  for (const e of routine?.exercises ?? []) {
    const weight = e.weight > 0 ? e.weight : lastWeight(e.exercise_id);
    insertWorkoutExercise(id, e.exercise_id, e.rest_sec, Array.from({ length: e.sets }, () => ({ reps: e.reps, weight })));
  }
  return id;
}

/** Sets from the most recent finished workout containing this exercise ("previous" column). */
function previousSets(exerciseId: string, beforeWorkoutId: number) {
  return db.getAllSync<{ weight: number; reps: number }>(
    `SELECT s.weight, s.reps FROM sets s WHERE s.done = 1 AND s.workout_exercise_id = (
       SELECT we.id FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
       WHERE we.exercise_id = ? AND w.ended_at IS NOT NULL AND w.id != ? ORDER BY w.started_at DESC LIMIT 1)
     ORDER BY s.position`,
    exerciseId, beforeWorkoutId,
  );
}

export function loadWorkout(id: number) {
  const workout = db.getFirstSync<Workout>('SELECT * FROM workouts WHERE id = ?', id);
  if (!workout) return null;
  const exercises = db
    .getAllSync<Omit<WorkoutExercise, 'sets' | 'previous'>>(
      `SELECT we.*, e.name, e.motion FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
       WHERE we.workout_id = ? ORDER BY we.position`,
      id,
    )
    .map((we) => ({
      ...we,
      sets: db.getAllSync<SetRow>('SELECT * FROM sets WHERE workout_exercise_id = ? ORDER BY position', we.id),
      previous: previousSets(we.exercise_id, id),
    }));
  return { workout, exercises };
}

export function addExerciseToWorkout(workoutId: number, exerciseId: string) {
  const weight = lastWeight(exerciseId);
  db.withTransactionSync(() => insertWorkoutExercise(workoutId, exerciseId, null, [1, 2, 3].map(() => ({ reps: 10, weight }))));
}

/** Swap keeps logged sets and re-fills planned ones from the new exercise's history. */
export function swapExercise(workoutExerciseId: number, exerciseId: string) {
  db.withTransactionSync(() => {
    db.runSync('UPDATE workout_exercises SET exercise_id = ?, rest_sec = ?, skipped = 0 WHERE id = ?', exerciseId, exerciseRest(exerciseId), workoutExerciseId);
    db.runSync('UPDATE sets SET weight = ? WHERE workout_exercise_id = ? AND done = 0', lastWeight(exerciseId), workoutExerciseId);
  });
}

export const setSkipped = (weId: number, skipped: boolean) => db.runSync('UPDATE workout_exercises SET skipped = ? WHERE id = ?', skipped ? 1 : 0, weId);
export const setRest = (weId: number, sec: number) => db.runSync('UPDATE workout_exercises SET rest_sec = ? WHERE id = ?', sec, weId);
export const removeWorkoutExercise = (weId: number) => db.runSync('DELETE FROM workout_exercises WHERE id = ?', weId);

export function addSet(weId: number) {
  const last = db.getFirstSync<SetRow>('SELECT * FROM sets WHERE workout_exercise_id = ? ORDER BY position DESC LIMIT 1', weId);
  db.runSync('INSERT INTO sets (workout_exercise_id, position, reps, weight) VALUES (?, ?, ?, ?)', weId, (last?.position ?? -1) + 1, last?.reps ?? 10, last?.weight ?? 0);
}

export const deleteSet = (id: number) => db.runSync('DELETE FROM sets WHERE id = ?', id);
export const updateSet = (id: number, field: 'reps' | 'weight', value: number) => db.runSync(`UPDATE sets SET ${field} = ? WHERE id = ?`, value, id);
export const setDone = (id: number, done: boolean) =>
  db.runSync('UPDATE sets SET done = ?, completed_at = ? WHERE id = ?', done ? 1 : 0, done ? Date.now() : null, id);

/** Drops planned-but-not-done sets and empty exercises. Returns null when nothing was logged (workout discarded). */
export function finishWorkout(id: number, endedAt = Date.now()): Workout | null {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM sets WHERE done = 0 AND workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?)', id);
    db.runSync('DELETE FROM workout_exercises WHERE workout_id = ? AND id NOT IN (SELECT workout_exercise_id FROM sets)', id);
    const left = db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM workout_exercises WHERE workout_id = ?', id)?.n ?? 0;
    if (left === 0) db.runSync('DELETE FROM workouts WHERE id = ?', id);
    else db.runSync('UPDATE workouts SET ended_at = ? WHERE id = ?', endedAt, id);
  });
  return db.getFirstSync<Workout>('SELECT * FROM workouts WHERE id = ?', id);
}

export const getWorkout = (id: number) => db.getFirstSync<Workout>('SELECT * FROM workouts WHERE id = ?', id);
export const deleteWorkout = (id: number) => db.runSync('DELETE FROM workouts WHERE id = ?', id);
export const markHealthSynced = (id: number) => db.runSync('UPDATE workouts SET health_synced = 1 WHERE id = ?', id);
export const unsyncedWorkoutIds = () =>
  db.getAllSync<{ id: number }>('SELECT id FROM workouts WHERE ended_at IS NOT NULL AND health_synced = 0 ORDER BY started_at').map((r) => r.id);

export const listWorkouts = () =>
  db.getAllSync<WorkoutSummary>(
    `SELECT w.*,
       (SELECT COALESCE(SUM(s.weight * s.reps), 0) FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id WHERE we.workout_id = w.id AND s.done = 1) AS volume,
       (SELECT COUNT(*) FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id WHERE we.workout_id = w.id AND s.done = 1) AS set_count,
       (SELECT GROUP_CONCAT(e.name, ', ') FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id WHERE we.workout_id = w.id) AS exercise_names
     FROM workouts w WHERE w.ended_at IS NOT NULL ORDER BY w.started_at DESC`,
  );

/** Every done set of an exercise, oldest first, for PRs and progression charts. */
export const loggedSets = (exerciseId: string) =>
  db.getAllSync<LoggedSet & { started_at: number }>(
    `SELECT s.id, w.id AS workoutId, COALESCE(s.completed_at, w.started_at) AS at, s.weight, s.reps, w.started_at
     FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id JOIN workouts w ON w.id = we.workout_id
     WHERE we.exercise_id = ? AND s.done = 1 ORDER BY at, s.id`,
    exerciseId,
  );

// ---------- Runs ----------

export const listRuns = () => db.getAllSync<Run>('SELECT * FROM runs ORDER BY started_at DESC');
export const addRun = (r: Omit<Run, 'id'>) =>
  db.runSync(
    `INSERT INTO runs (strava_id, name, started_at, distance_m, duration_s, source) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(strava_id) DO UPDATE SET name=excluded.name, distance_m=excluded.distance_m, duration_s=excluded.duration_s`,
    r.strava_id, r.name, r.started_at, r.distance_m, r.duration_s, r.source,
  );
export const deleteRun = (id: number) => db.runSync('DELETE FROM runs WHERE id = ?', id);
export const lastStravaRunAt = () => db.getFirstSync<{ t: number | null }>("SELECT MAX(started_at) AS t FROM runs WHERE source = 'strava'")?.t ?? null;

// ---------- Reminders ----------

export const listReminders = () =>
  db.getAllSync<Reminder>('SELECT r.*, ro.name AS routine_name FROM reminders r LEFT JOIN routines ro ON ro.id = r.routine_id ORDER BY r.hour, r.minute');
export const saveReminder = (r: Omit<Reminder, 'id' | 'routine_name'> & { id?: number }) =>
  r.id
    ? (db.runSync('UPDATE reminders SET routine_id=?, weekdays=?, hour=?, minute=?, enabled=?, notif_ids=? WHERE id=?', r.routine_id, r.weekdays, r.hour, r.minute, r.enabled, r.notif_ids, r.id), r.id)
    : db.runSync('INSERT INTO reminders (routine_id, weekdays, hour, minute, enabled, notif_ids) VALUES (?,?,?,?,?,?)', r.routine_id, r.weekdays, r.hour, r.minute, r.enabled, r.notif_ids).lastInsertRowId;
export const deleteReminder = (id: number) => db.runSync('DELETE FROM reminders WHERE id = ?', id);

// ---------- Apple Watch sets (Phase 9F) ----------

export type WatchSet = {
  uid: string; exerciseId: string; reps: number; weightLbs: number; startedAt: number; endedAt: number;
  routineId?: number; predictedExerciseId?: string; confidence?: number; repsCounted?: number; top3?: { id: string; p: number }[]; mode?: string;
};

/**
 * Inserts a watch-confirmed set into the same workouts / workout_exercises / sets tables a phone-logged set uses:
 * it fills the next planned set of that exercise in the active workout (creating either if missing).
 * Idempotent on uid, so resends after a lost ack are harmless. Returns the rest seconds to start, or null if duplicate.
 */
export function logWatchSet(p: WatchSet): number | null {
  if (!p.uid || !p.exerciseId || !(p.reps >= 0) || !(p.weightLbs >= 0) || !getExercise(p.exerciseId)) throw new Error('invalid watch set');
  if (db.getFirstSync('SELECT 1 FROM sets WHERE uid = ?', p.uid)) return null;
  let rest = 90;
  db.withTransactionSync(() => {
    const workoutId = activeWorkout()?.id ?? createWorkout(p.routineId && getRoutine(p.routineId) ? p.routineId : null, p.startedAt);
    let we = db.getFirstSync<{ id: number; rest_sec: number }>(
      'SELECT id, rest_sec FROM workout_exercises WHERE workout_id = ? AND exercise_id = ? ORDER BY skipped, position LIMIT 1',
      workoutId, p.exerciseId,
    );
    if (!we) {
      const id = insertWorkoutExercise(workoutId, p.exerciseId, null, []);
      we = { id, rest_sec: exerciseRest(p.exerciseId) };
    }
    rest = we.rest_sec;
    const planned = db.getFirstSync<{ id: number }>('SELECT id FROM sets WHERE workout_exercise_id = ? AND done = 0 ORDER BY position LIMIT 1', we.id);
    if (planned) {
      db.runSync(
        "UPDATE sets SET reps=?, weight=?, done=1, started_at=?, completed_at=?, uid=?, source='watch' WHERE id=?",
        p.reps, p.weightLbs, p.startedAt, p.endedAt, p.uid, planned.id,
      );
    } else {
      const pos = db.getFirstSync<{ p: number }>('SELECT COALESCE(MAX(position) + 1, 0) AS p FROM sets WHERE workout_exercise_id = ?', we.id)?.p ?? 0;
      db.runSync(
        "INSERT INTO sets (workout_exercise_id, position, reps, weight, done, started_at, completed_at, uid, source) VALUES (?, ?, ?, ?, 1, ?, ?, ?, 'watch')",
        we.id, pos, p.reps, p.weightLbs, p.startedAt, p.endedAt, p.uid,
      );
    }
    db.runSync('UPDATE workout_exercises SET skipped = 0 WHERE id = ?', we.id);
    if (p.mode) {
      db.runSync(
        `INSERT OR IGNORE INTO motion_predictions (created_at, set_uid, mode, predicted_exercise_id, confidence, top3, confirmed_exercise_id, reps_counted, reps_confirmed, weight)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p.endedAt, p.uid, p.mode, p.predictedExerciseId ?? null, p.confidence ?? null, JSON.stringify(p.top3 ?? []),
        p.exerciseId, p.repsCounted ?? null, p.reps, p.weightLbs,
      );
    }
  });
  return rest;
}

export type PredictionRow = {
  predicted_exercise_id: string | null; confidence: number | null; confirmed_exercise_id: string;
  reps_counted: number | null; reps_confirmed: number; mode: string; created_at: number;
};
export const listPredictions = () => db.getAllSync<PredictionRow>('SELECT * FROM motion_predictions ORDER BY created_at DESC');
