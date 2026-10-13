import type { RunInput } from '@/domain/strava';
import type { Run } from '@/domain/types';

import { getDb } from './client';

interface RunRow {
  id: number;
  source: string;
  external_id: string | null;
  name: string;
  started_at: number;
  distance_m: number;
  moving_time_sec: number;
  elapsed_time_sec: number;
  elevation_gain_m: number | null;
  avg_heartrate: number | null;
  sport_type: string;
  notes: string | null;
  health_synced: number;
}

function toRun(r: RunRow): Run {
  return {
    id: r.id,
    source: r.source === 'strava' ? 'strava' : 'manual',
    externalId: r.external_id,
    name: r.name,
    startedAt: r.started_at,
    distanceM: r.distance_m,
    movingTimeSec: r.moving_time_sec,
    elapsedTimeSec: r.elapsed_time_sec,
    elevationGainM: r.elevation_gain_m,
    avgHeartrate: r.avg_heartrate,
    sportType: r.sport_type,
    notes: r.notes,
    healthSynced: r.health_synced === 1,
  };
}

export async function listRuns(limit = 500): Promise<Run[]> {
  const rows = await getDb().getAllAsync<RunRow>('SELECT * FROM runs ORDER BY started_at DESC LIMIT ?', limit);
  return rows.map(toRun);
}

export async function getRun(id: number): Promise<Run | null> {
  const row = await getDb().getFirstAsync<RunRow>('SELECT * FROM runs WHERE id = ?', id);
  return row ? toRun(row) : null;
}

export async function addManualRun(input: Omit<RunInput, 'source' | 'externalId'>): Promise<number> {
  const result = await getDb().runAsync(
    `INSERT INTO runs (source, external_id, name, started_at, distance_m, moving_time_sec, elapsed_time_sec,
                       elevation_gain_m, avg_heartrate, sport_type, notes)
     VALUES ('manual', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.name.trim() || 'Run',
    input.startedAt,
    input.distanceM,
    input.movingTimeSec,
    input.elapsedTimeSec,
    input.elevationGainM,
    input.avgHeartrate,
    input.sportType,
    input.notes?.trim() || null,
  );
  return result.lastInsertRowId;
}

export async function updateManualRun(id: number, input: Omit<RunInput, 'source' | 'externalId'>): Promise<void> {
  await getDb().runAsync(
    `UPDATE runs SET name = ?, started_at = ?, distance_m = ?, moving_time_sec = ?, elapsed_time_sec = ?, notes = ?
     WHERE id = ? AND source = 'manual'`,
    input.name.trim() || 'Run',
    input.startedAt,
    input.distanceM,
    input.movingTimeSec,
    input.elapsedTimeSec,
    input.notes?.trim() || null,
    id,
  );
}

/** Inserts new Strava runs and refreshes ones already imported. Returns how many were new. */
export async function upsertStravaRuns(runs: RunInput[]): Promise<number> {
  if (runs.length === 0) return 0;
  const db = getDb();
  const before = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM runs WHERE source = 'strava'");
  await db.withTransactionAsync(async () => {
    for (const r of runs) {
      await db.runAsync(
        `INSERT INTO runs (source, external_id, name, started_at, distance_m, moving_time_sec, elapsed_time_sec,
                           elevation_gain_m, avg_heartrate, sport_type)
         VALUES ('strava', ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(source, external_id) DO UPDATE SET
           name = excluded.name,
           started_at = excluded.started_at,
           distance_m = excluded.distance_m,
           moving_time_sec = excluded.moving_time_sec,
           elapsed_time_sec = excluded.elapsed_time_sec,
           elevation_gain_m = excluded.elevation_gain_m,
           avg_heartrate = excluded.avg_heartrate,
           sport_type = excluded.sport_type`,
        r.externalId,
        r.name,
        r.startedAt,
        r.distanceM,
        r.movingTimeSec,
        r.elapsedTimeSec,
        r.elevationGainM,
        r.avgHeartrate,
        r.sportType,
      );
    }
  });
  const after = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM runs WHERE source = 'strava'");
  return (after?.n ?? 0) - (before?.n ?? 0);
}

export async function deleteRun(id: number): Promise<void> {
  await getDb().runAsync('DELETE FROM runs WHERE id = ?', id);
}

export async function markRunHealthSynced(id: number): Promise<void> {
  await getDb().runAsync('UPDATE runs SET health_synced = 1 WHERE id = ?', id);
}

export async function latestStravaStart(): Promise<number | null> {
  const row = await getDb().getFirstAsync<{ t: number | null }>("SELECT MAX(started_at) AS t FROM runs WHERE source = 'strava'");
  return row?.t ?? null;
}
