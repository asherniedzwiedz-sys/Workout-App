/** Epley estimated one-rep max. A single is its own 1RM. */
export function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

export type LoggedSet = { id: number; workoutId: number; at: number; weight: number; reps: number };

const chrono = (a: LoggedSet, b: LoggedSet) => a.at - b.at || a.id - b.id;

/**
 * Sets that beat every earlier set of the same exercise on weight or estimated 1RM.
 * The first workout of an exercise only sets the baseline, so it is never flagged.
 */
export function prSetIds(sets: LoggedSet[]): Set<number> {
  const prs = new Set<number>();
  const sorted = [...sets].sort(chrono);
  const firstWorkout = sorted[0]?.workoutId;
  let bestWeight = 0;
  let bestE1rm = 0;
  for (const s of sorted) {
    const est = e1rm(s.weight, s.reps);
    if (s.workoutId !== firstWorkout && (s.weight > bestWeight || est > bestE1rm)) prs.add(s.id);
    bestWeight = Math.max(bestWeight, s.weight);
    bestE1rm = Math.max(bestE1rm, est);
  }
  return prs;
}

export type ProgressPoint = { workoutId: number; at: number; e1rm: number; topWeight: number };

/** One point per workout: best estimated 1RM and heaviest set. */
export function progression(sets: LoggedSet[]): ProgressPoint[] {
  const byWorkout = new Map<number, ProgressPoint>();
  for (const s of [...sets].sort(chrono)) {
    const p = byWorkout.get(s.workoutId) ?? { workoutId: s.workoutId, at: s.at, e1rm: 0, topWeight: 0 };
    p.e1rm = Math.max(p.e1rm, e1rm(s.weight, s.reps));
    p.topWeight = Math.max(p.topWeight, s.weight);
    byWorkout.set(s.workoutId, p);
  }
  return [...byWorkout.values()];
}

export const volume = (sets: { weight: number; reps: number }[]) => sets.reduce((v, s) => v + s.weight * s.reps, 0);

export function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

export const fmtDate = (t: number) => new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

export const fmtWeight = (lbs: number) => `${Number.isInteger(lbs) ? lbs : lbs.toFixed(1)}`;

export const fmtVolume = (lbs: number) => (lbs >= 10000 ? `${(lbs / 1000).toFixed(1)}k` : Math.round(lbs).toLocaleString('en-US'));

export const METERS_PER_MILE = 1609.344;

/** "8:05 /mi" from meters + seconds. */
export function fmtPace(meters: number, seconds: number): string {
  if (meters <= 0 || seconds <= 0) return '–';
  const secPerMile = seconds / (meters / METERS_PER_MILE);
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return s === 60 ? `${m + 1}:00 /mi` : `${m}:${String(s).padStart(2, '0')} /mi`;
}

/** Parses "45:30", "1:02:03" or "40" (minutes) into seconds; NaN when invalid. */
export function parseDuration(text: string): number {
  const parts = text.trim().split(':').map((p) => (/^\d+$/.test(p) ? Number(p) : NaN));
  if (parts.length === 1) return (parts[0] ?? NaN) * 60;
  if (parts.length > 3 || parts.some((p, i) => i > 0 && p >= 60)) return NaN;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}
