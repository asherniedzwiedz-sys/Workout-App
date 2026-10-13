export const DEFAULT_PLATES = [45, 35, 25, 10, 5, 2.5];

export interface PlateLoad {
  /** Plates for one side of the bar, heaviest first. */
  perSide: number[];
  /** Weight actually loaded (bar + 2 × plates). */
  loaded: number;
  /** Target minus loaded; non-zero when the target isn't reachable with the plates. */
  remainder: number;
}

/** Greedy plate breakdown for a barbell. Assumes unlimited pairs of each plate. */
export function plateBreakdown(target: number, barWeight = 45, plates = DEFAULT_PLATES): PlateLoad {
  const sorted = [...plates].filter((p) => p > 0).sort((a, b) => b - a);
  let perSideRemaining = Math.max(0, (target - barWeight) / 2);
  const perSide: number[] = [];
  for (const plate of sorted) {
    while (perSideRemaining + 1e-9 >= plate) {
      perSide.push(plate);
      perSideRemaining -= plate;
    }
  }
  const loaded = barWeight + 2 * perSide.reduce((a, b) => a + b, 0);
  return { perSide, loaded, remainder: Math.round((target - loaded) * 100) / 100 };
}

/** Standard warm-up ramp toward a working weight (Strong's warm-up calculator). */
export function warmupSets(working: number, barWeight = 45): { weight: number; reps: number }[] {
  if (working <= barWeight) return [];
  const steps: [number, number][] = [
    [0, 10],
    [0.5, 5],
    [0.7, 3],
    [0.85, 1],
  ];
  const result: { weight: number; reps: number }[] = [];
  for (const [pct, reps] of steps) {
    const raw = pct === 0 ? barWeight : Math.max(barWeight, Math.round((working * pct) / 5) * 5);
    if (raw >= working) continue;
    if (result.some((r) => r.weight === raw)) continue;
    result.push({ weight: raw, reps });
  }
  return result;
}
