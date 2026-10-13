// Ordered migrations. The database's PRAGMA user_version records how many have run.
// Never edit a shipped migration; append a new one instead.
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS exercises (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    primary_muscle TEXT NOT NULL,
    secondary_muscles TEXT NOT NULL DEFAULT '[]',
    equipment TEXT NOT NULL,
    category TEXT NOT NULL,
    pattern TEXT NOT NULL,
    tier INTEGER NOT NULL DEFAULT 1,
    bodyweight INTEGER NOT NULL DEFAULT 0,
    default_rest_sec INTEGER NOT NULL DEFAULT 120,
    is_custom INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS routines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    notes TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS routine_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES exercises(id),
    position INTEGER NOT NULL,
    sets INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    weight REAL NOT NULL DEFAULT 0,
    rest_sec INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine ON routine_exercises(routine_id, position);

  CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    routine_id INTEGER REFERENCES routines(id) ON DELETE SET NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    duration_sec INTEGER NOT NULL,
    total_volume REAL NOT NULL,
    total_sets INTEGER NOT NULL,
    notes TEXT,
    health_synced INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_workouts_started ON workouts(started_at);

  CREATE TABLE IF NOT EXISTS workout_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES exercises(id),
    position INTEGER NOT NULL,
    notes TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout ON workout_exercises(workout_id, position);

  CREATE TABLE IF NOT EXISTS workout_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
    workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    set_type TEXT NOT NULL DEFAULT 'normal',
    weight REAL NOT NULL,
    reps INTEGER NOT NULL,
    e1rm REAL NOT NULL,
    completed_at INTEGER NOT NULL,
    pr_flags TEXT NOT NULL DEFAULT '[]'
  );
  CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise ON workout_sets(exercise_id, completed_at);
  CREATE INDEX IF NOT EXISTS idx_workout_sets_workout ON workout_sets(workout_id);

  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    external_id TEXT,
    name TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    distance_m REAL NOT NULL,
    moving_time_sec INTEGER NOT NULL,
    elapsed_time_sec INTEGER NOT NULL,
    elevation_gain_m REAL,
    avg_heartrate REAL,
    sport_type TEXT NOT NULL DEFAULT 'Run',
    notes TEXT,
    health_synced INTEGER NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_external ON runs(source, external_id);
  CREATE INDEX IF NOT EXISTS idx_runs_started ON runs(started_at);

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_id INTEGER REFERENCES routines(id) ON DELETE SET NULL,
    weekdays TEXT NOT NULL,
    hour INTEGER NOT NULL,
    minute INTEGER NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    notification_ids TEXT NOT NULL DEFAULT '[]'
  );
  `,
];
