import type { Run } from './types';

export interface RunSummary {
  count: number;
  distanceM: number;
  movingTimeSec: number;
  longest: Run | null;
  /** Fastest average pace among runs of at least 5 km. */
  fastest5k: Run | null;
}

export function summarizeRuns(runs: Run[]): RunSummary {
  let distanceM = 0;
  let movingTimeSec = 0;
  let longest: Run | null = null;
  let fastest5k: Run | null = null;
  for (const r of runs) {
    distanceM += r.distanceM;
    movingTimeSec += r.movingTimeSec;
    if (!longest || r.distanceM > longest.distanceM) longest = r;
    if (r.distanceM >= 5000 && r.movingTimeSec > 0) {
      if (!fastest5k || r.movingTimeSec / r.distanceM < fastest5k.movingTimeSec / fastest5k.distanceM) fastest5k = r;
    }
  }
  return { count: runs.length, distanceM, movingTimeSec, longest, fastest5k };
}

/** Validates a manual run entry. Returns an error message or null. */
export function validateManualRun(distanceM: number, movingTimeSec: number): string | null {
  if (!(distanceM > 0)) return 'Enter the distance you ran.';
  if (!(movingTimeSec > 0)) return 'Enter how long the run took.';
  const secPerKm = movingTimeSec / (distanceM / 1000);
  if (secPerKm < 150) return 'That pace is faster than a world record. Check the distance and time.';
  if (distanceM > 400_000) return 'That distance looks too long for a single run.';
  return null;
}
