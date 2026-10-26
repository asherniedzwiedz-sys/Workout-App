/** Accuracy math for Settings > Motion Detection > Accuracy Report (9B rep counting, 9D predictions). */

export type Stat = { key: string; n: number; exact: number; within1: number; mae: number };

/** "Usable" bar for moving past 9B: within ±1 rep on at least 90% of 6+ sets. */
export const isUsable = (s: Stat) => s.n >= 6 && s.within1 / s.n >= 0.9;

export function repStats(rows: { key: string; actual: number; counted: number }[]): Stat[] {
  const by = new Map<string, { n: number; exact: number; within1: number; err: number }>();
  for (const r of rows) {
    const s = by.get(r.key) ?? { n: 0, exact: 0, within1: 0, err: 0 };
    const d = Math.abs(r.counted - r.actual);
    s.n++;
    s.exact += d === 0 ? 1 : 0;
    s.within1 += d <= 1 ? 1 : 0;
    s.err += d;
    by.set(r.key, s);
  }
  return [...by].map(([key, s]) => ({ key, n: s.n, exact: s.exact, within1: s.within1, mae: s.err / s.n })).sort((a, b) => b.n - a.n);
}

export type Prediction = { predicted: string | null; confidence: number | null; confirmed: string };

export function predictionStats(rows: Prediction[]) {
  const per = new Map<string, { n: number; correct: number; unsure: number }>();
  const confusions = new Map<string, number>();
  let correct = 0;
  let unsure = 0;
  for (const r of rows) {
    const s = per.get(r.confirmed) ?? { n: 0, correct: 0, unsure: 0 };
    s.n++;
    if (r.predicted === null) {
      s.unsure++;
      unsure++;
    } else if (r.predicted === r.confirmed) {
      s.correct++;
      correct++;
    } else {
      const k = `${r.predicted} → ${r.confirmed}`;
      confusions.set(k, (confusions.get(k) ?? 0) + 1);
    }
    per.set(r.confirmed, s);
  }
  return {
    n: rows.length,
    correct,
    unsure,
    perExercise: [...per].map(([key, s]) => ({ key, ...s })).sort((a, b) => b.n - a.n),
    confusions: [...confusions].map(([pair, n]) => ({ pair, n })).sort((a, b) => b.n - a.n),
  };
}
