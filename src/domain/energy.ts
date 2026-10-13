// Calorie estimates sent to Apple Health. These are deliberately simple: without heart
// rate we can only approximate from body weight and duration/distance.

const LB_PER_KG = 2.20462;

/**
 * Active (above-resting) energy for resistance training: (MET − 1) × kg × hours with
 * MET 5 (mixed resistance training, moderate–vigorous).
 */
export function strengthActiveKcal(bodyWeightLbs: number, durationSec: number): number {
  if (!(bodyWeightLbs > 0) || !(durationSec > 0)) return 0;
  return Math.round(4 * (bodyWeightLbs / LB_PER_KG) * (durationSec / 3600));
}

/** Running costs roughly 1 kcal per kg per km regardless of pace. */
export function runningActiveKcal(bodyWeightLbs: number, distanceM: number): number {
  if (!(bodyWeightLbs > 0) || !(distanceM > 0)) return 0;
  return Math.round((bodyWeightLbs / LB_PER_KG) * (distanceM / 1000));
}
