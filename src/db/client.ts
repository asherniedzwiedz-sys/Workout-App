import * as SQLite from 'expo-sqlite';

import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary';

import { MIGRATIONS } from './schema';

const DATABASE_NAME = 'ironlog.db';
/** Bump when EXERCISE_LIBRARY changes so existing installs pick up new/renamed exercises. */
const LIBRARY_VERSION = '2';

let database: SQLite.SQLiteDatabase | null = null;
let opening: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!database) throw new Error('Database not initialized; call initDatabase() first.');
  return database;
}

export function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) return Promise.resolve(database);
  if (!opening) {
    opening = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await migrate(db);
      await seedLibrary(db);
      database = db;
      return db;
    })().catch((error: unknown) => {
      opening = null;
      throw error;
    });
  }
  return opening;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    if (sql === undefined) break;
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
    });
    version++;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}

/**
 * Upserts the built-in exercises. Names and tags follow the code; the user's
 * per-exercise rest timer default is preserved.
 */
async function seedLibrary(db: SQLite.SQLiteDatabase): Promise<void> {
  const current = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM kv WHERE key = 'library_version'",
  );
  if (current?.value === LIBRARY_VERSION) return;

  await db.withTransactionAsync(async () => {
    const statement = await db.prepareAsync(
      `INSERT INTO exercises
        (id, name, primary_muscle, secondary_muscles, equipment, category, pattern, tier, bodyweight, default_rest_sec, is_custom, archived)
       VALUES ($id, $name, $primary, $secondary, $equipment, $category, $pattern, $tier, $bodyweight, $rest, 0, 0)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         primary_muscle = excluded.primary_muscle,
         secondary_muscles = excluded.secondary_muscles,
         equipment = excluded.equipment,
         category = excluded.category,
         pattern = excluded.pattern,
         tier = excluded.tier,
         bodyweight = excluded.bodyweight`,
    );
    try {
      for (const e of EXERCISE_LIBRARY) {
        await statement.executeAsync({
          $id: e.id,
          $name: e.name,
          $primary: e.primaryMuscle,
          $secondary: JSON.stringify(e.secondaryMuscles),
          $equipment: e.equipment,
          $category: e.category,
          $pattern: e.pattern,
          $tier: e.tier,
          $bodyweight: e.bodyweight ? 1 : 0,
          $rest: e.defaultRestSec,
        });
      }
    } finally {
      await statement.finalizeAsync();
    }
    await db.runAsync(
      "INSERT INTO kv (key, value) VALUES ('library_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      LIBRARY_VERSION,
    );
  });
}

/** Parses a JSON column, falling back when the stored value is malformed. */
export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
