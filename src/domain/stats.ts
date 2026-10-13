import { estimateOneRepMax } from './oneRepMax';
import type { SetType } from './types';

export type ExerciseMetric = 'e1rm' | 'topWeight' | 'volume' | 'bestReps';

export const METRIC_LABEL: Record<ExerciseMetric, string> = {
  e1rm: 'Est. 1RM',
  topWeight: 'Top set weight',
  volume: 'Session volume',
  bestReps: 'Best set reps',
};

export interface SessionSets {
  startedAt: number;
  sets: { type: SetType; weight: number; reps: number }[];
}

export interface SeriesPoint {
  x: number;
  y: number;
  /** True when this point set a new all-time high for the metric. */
  record: boolean;
}

function sessionValue(session: SessionSets, metric: ExerciseMetric): number | null {
  const working = session.sets.filter((s) => s.type !== 'warmup' && s.reps > 0);
  if (working.length === 0) return null;
  switch (metric) {
    case 'e1rm':
      return Math.max(...working.map((s) => estimateOneRepMax(s.weight, s.reps)));
    case 'topWeight':
      return Math.max(...working.map((s) => s.weight));
    case 'volume':
      return working.reduce((sum, s) => sum + s.weight * s.reps, 0);
    case 'bestReps':
      return Math.max(...working.map((s) => s.reps));
  }
}

/**
 * One point per session, oldest first. `record` marks sessions that beat every
 * earlier session (the first session is the baseline and is never a record).
 */
export function buildSeries(sessions: SessionSets[], metric: ExerciseMetric): SeriesPoint[] {
  const ordered = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
  const points: SeriesPoint[] = [];
  let best = -Infinity;
  for (const session of ordered) {
    const y = sessionValue(session, metric);
    if (y === null) continue;
    const record = points.length > 0 && y > best + 1e-9;
    if (y > best) best = y;
    points.push({ x: session.startedAt, y, record });
  }
  return points;
}

/** Which metrics make sense: bodyweight-only history is charted by reps. */
export function metricsFor(sessions: SessionSets[]): ExerciseMetric[] {
  const loaded = sessions.some((s) => s.sets.some((set) => set.weight > 0 && set.type !== 'warmup'));
  return loaded ? ['e1rm', 'topWeight', 'volume', 'bestReps'] : ['bestReps', 'volume'];
}

export type RangeKey = '1M' | '3M' | '6M' | '1Y' | 'ALL';

const RANGE_DAYS: Record<RangeKey, number | null> = { '1M': 31, '3M': 92, '6M': 183, '1Y': 366, ALL: null };

export function filterRange<T extends { x: number }>(points: T[], range: RangeKey, now: number): T[] {
  const days = RANGE_DAYS[range];
  if (days === null) return points;
  const from = now - days * 86_400_000;
  return points.filter((p) => p.x >= from);
}

/**
 * Buckets timestamps into the last `weeks` Monday-based weeks, oldest first.
 * `weekStart` maps a timestamp to the start of its week (local time).
 */
export function weeklyBuckets<T>(
  items: T[],
  getTime: (item: T) => number,
  getValue: (item: T) => number,
  weeks: number,
  now: number,
  weekStart: (ts: number) => number,
): { weekStart: number; value: number }[] {
  const current = weekStart(now);
  const buckets: { weekStart: number; value: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    // Step back by 7 days, then snap to the week start to absorb DST shifts.
    buckets.push({ weekStart: weekStart(current - i * 7 * 86_400_000 + 12 * 3_600_000), value: 0 });
  }
  const index = new Map(buckets.map((b, i) => [b.weekStart, i]));
  for (const item of items) {
    const i = index.get(weekStart(getTime(item)));
    if (i !== undefined) {
      const bucket = buckets[i];
      if (bucket) bucket.value += getValue(item);
    }
  }
  return buckets;
}

/** Consecutive weeks (ending this week or last week) with at least one workout. */
export function weekStreak(times: number[], now: number, weekStart: (ts: number) => number): number {
  const weeks = new Set(times.map(weekStart));
  let cursor = weekStart(now);
  if (!weeks.has(cursor)) cursor = weekStart(cursor - 3 * 86_400_000);
  let streak = 0;
  while (weeks.has(cursor)) {
    streak++;
    cursor = weekStart(cursor - 3 * 86_400_000);
  }
  return streak;
}

/** "Nice" axis ticks covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.1);
    min -= pad;
    max += pad;
  }
  const span = max - min;
  const rawStep = span / Math.max(1, count - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const step = (residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1) * magnitude;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

export function compactNumber(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1000) return `${(v / 1000).toFixed(abs >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return String(Math.round(v * 10) / 10);
}
