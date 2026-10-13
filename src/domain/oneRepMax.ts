/**
 * Estimated one-rep max using the Epley formula: w × (1 + reps / 30).
 * A single rep is treated as an actual 1RM. Returns 0 for empty sets.
 */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (!(weight > 0) || !(reps > 0)) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Inverse Epley: the weight you could lift for `reps` given an estimated 1RM. */
export function weightForReps(oneRepMax: number, reps: number): number {
  if (!(oneRepMax > 0) || !(reps > 0)) return 0;
  if (reps === 1) return oneRepMax;
  return oneRepMax / (1 + reps / 30);
}

/** Round down to the nearest loadable increment (5 lb by default). */
export function roundToIncrement(weight: number, increment = 5): number {
  if (!(weight > 0)) return 0;
  return Math.floor(weight / increment) * increment;
}
