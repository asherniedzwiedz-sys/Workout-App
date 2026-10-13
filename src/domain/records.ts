import { estimateOneRepMax } from './oneRepMax';
import type { PrKind, SetType } from './types';

export interface RecordSet {
  /** Any stable key; returned in the result map. */
  key: number | string;
  workoutId: number;
  /** Used to order workouts chronologically. */
  completedAt: number;
  type: SetType;
  weight: number;
  reps: number;
}

function metric(kind: PrKind, s: RecordSet): number {
  switch (kind) {
    case 'e1rm':
      return estimateOneRepMax(s.weight, s.reps);
    case 'weight':
      return s.weight;
    case 'volume':
      return s.weight * s.reps;
    case 'reps':
      return s.reps;
  }
}

/** Bodyweight-only sets (weight 0) are judged on reps; loaded sets on load metrics. */
function kindsFor(s: RecordSet): PrKind[] {
  return s.weight > 0 ? ['e1rm', 'weight', 'volume'] : ['reps'];
}

/**
 * Flags personal records for one exercise's full set history.
 *
 * Rules (mirroring how Strong/Hevy badge PRs):
 * - Warm-up sets never count.
 * - The first workout an exercise appears in is the baseline, so nothing is flagged there.
 * - In each later workout, for each PR kind, the single best set is flagged if it strictly
 *   beats the best value from all earlier workouts.
 *
 * Returns a map from set key to the PR kinds it earned.
 */
export function computePrFlags(sets: RecordSet[]): Map<RecordSet['key'], PrKind[]> {
  const result = new Map<RecordSet['key'], PrKind[]>();
  const working = sets.filter((s) => s.type !== 'warmup' && s.reps > 0);

  // Group by workout, ordered by when the workout happened.
  const byWorkout = new Map<number, RecordSet[]>();
  for (const s of working) {
    const list = byWorkout.get(s.workoutId);
    if (list) list.push(s);
    else byWorkout.set(s.workoutId, [s]);
  }
  const workouts = [...byWorkout.values()].sort(
    (a, b) => Math.min(...a.map((s) => s.completedAt)) - Math.min(...b.map((s) => s.completedAt)),
  );

  const best: Record<PrKind, number> = { e1rm: 0, weight: 0, volume: 0, reps: 0 };
  const seen: Record<PrKind, boolean> = { e1rm: false, weight: false, volume: false, reps: false };

  for (const workoutSets of workouts) {
    const sessionBest = new Map<PrKind, RecordSet>();
    for (const s of workoutSets) {
      for (const kind of kindsFor(s)) {
        const current = sessionBest.get(kind);
        if (!current || metric(kind, s) > metric(kind, current)) sessionBest.set(kind, s);
      }
    }
    for (const [kind, s] of sessionBest) {
      const value = metric(kind, s);
      if (seen[kind] && value > best[kind] + 1e-9) {
        const flags = result.get(s.key) ?? [];
        flags.push(kind);
        result.set(s.key, flags);
      }
      if (value > best[kind]) best[kind] = value;
      seen[kind] = true;
    }
  }
  return result;
}

export interface ExerciseRecords {
  bestE1rm: { value: number; weight: number; reps: number; at: number } | null;
  heaviest: { weight: number; reps: number; at: number } | null;
  bestVolumeSet: { value: number; weight: number; reps: number; at: number } | null;
  mostReps: { reps: number; weight: number; at: number } | null;
  /**
   * Rep maxes for each rep count you've actually done (up to 12): the heaviest weight
   * lifted for at least that many reps, so 210 × 6 also counts as your 5-rep best.
   */
  repRecords: { reps: number; weight: number; at: number }[];
}

export function computeRecords(sets: RecordSet[]): ExerciseRecords {
  const working = sets.filter((s) => s.type !== 'warmup' && s.reps > 0);
  const records: ExerciseRecords = {
    bestE1rm: null,
    heaviest: null,
    bestVolumeSet: null,
    mostReps: null,
    repRecords: [],
  };
  const repCounts = new Set<number>();
  for (const s of working) {
    const e1rm = estimateOneRepMax(s.weight, s.reps);
    if (s.weight > 0 && (!records.bestE1rm || e1rm > records.bestE1rm.value)) {
      records.bestE1rm = { value: e1rm, weight: s.weight, reps: s.reps, at: s.completedAt };
    }
    if (s.weight > 0 && (!records.heaviest || s.weight > records.heaviest.weight)) {
      records.heaviest = { weight: s.weight, reps: s.reps, at: s.completedAt };
    }
    const volume = s.weight * s.reps;
    if (s.weight > 0 && (!records.bestVolumeSet || volume > records.bestVolumeSet.value)) {
      records.bestVolumeSet = { value: volume, weight: s.weight, reps: s.reps, at: s.completedAt };
    }
    if (!records.mostReps || s.reps > records.mostReps.reps) {
      records.mostReps = { reps: s.reps, weight: s.weight, at: s.completedAt };
    }
    if (s.weight > 0 && s.reps <= 12) repCounts.add(s.reps);
  }
  const loaded = working.filter((s) => s.weight > 0);
  records.repRecords = [...repCounts]
    .sort((a, b) => a - b)
    .map((reps) => {
      let best: RecordSet | null = null;
      for (const s of loaded) {
        if (s.reps >= reps && (!best || s.weight > best.weight)) best = s;
      }
      return { reps, weight: best?.weight ?? 0, at: best?.completedAt ?? 0 };
    });
  return records;
}
