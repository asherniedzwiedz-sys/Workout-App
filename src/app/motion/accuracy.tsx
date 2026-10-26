import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { listPredictions } from '@/db';
import { useQuery } from '@/hooks';
import { isUsable, predictionStats, repStats, type Stat } from '@/logic/accuracy';
import { labelName } from '@/logic/exercises';
import { listRecordings, type Recording } from '@/motion';
import { C } from '@/theme';
import { Card, H, Muted, Screen } from '@/ui';

const pct = (a: number, n: number) => (n ? `${Math.round((a / n) * 100)}%` : '–');

/** The exercises Phase 9 must work for on your own Watch before it counts as done. */
const GATE = [
  { name: 'Curls', ids: ['dumbbell-curl', 'hammer-curl'] },
  { name: 'Dumbbell press', ids: ['dumbbell-bench-press', 'dumbbell-shoulder-press'] },
  { name: 'Row', ids: ['dumbbell-row', 'barbell-row'] },
];

export default function AccuracyReport() {
  const preds = useQuery(listPredictions);
  const [recs, setRecs] = useState<Recording[]>([]);
  useFocusEffect(useCallback(() => setRecs(listRecordings()), []));

  // Rep counting: labeled recordings (actual vs counted) + live sets (confirmed vs counted). Corrections are already in preds.
  const reps = repStats([
    ...recs.filter((r) => r.exerciseId !== 'other' && r.kind !== 'correction').map((r) => ({ key: r.exerciseId, actual: r.actualReps, counted: r.countedReps })),
    ...preds.filter((p) => p.reps_counted !== null).map((p) => ({ key: p.confirmed_exercise_id, actual: p.reps_confirmed, counted: p.reps_counted! })),
  ]);
  const ex = predictionStats(preds.map((p) => ({ predicted: p.predicted_exercise_id, confidence: p.confidence, confirmed: p.confirmed_exercise_id })));
  const repFor = (ids: string[]) => reps.filter((r) => ids.includes(r.key));
  const exFor = (ids: string[]) => ex.perExercise.filter((r) => ids.includes(r.key));

  return (
    <>
      <Stack.Screen options={{ title: 'Accuracy Report' }} />
      <Screen>
        <H>Phase 9 checklist</H>
        <Card>
          {GATE.map((g) => {
            const r = repFor(g.ids);
            const e = exFor(g.ids);
            const repOk = r.some(isUsable);
            const n = e.reduce((a, x) => a + x.n, 0);
            const correct = e.reduce((a, x) => a + x.correct, 0);
            return (
              <View key={g.name} style={{ gap: 2 }}>
                <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>{repOk ? '✅' : '⬜️'} {g.name}</Text>
                <Muted>
                  Reps ±1: {r.length ? r.map((x) => `${labelName(x.key)} ${pct(x.within1, x.n)} (n=${x.n})`).join(', ') : 'no data'} · Exercise right: {pct(correct, n)} of {n} confirmed sets
                </Muted>
              </View>
            );
          })}
          <Muted>✅ = rep count within ±1 on ≥90% of 6+ sets. You decide when predict-and-confirm feels right; this only shows the numbers.</Muted>
        </Card>

        <H>Rep counting (9B)</H>
        <Card>
          {reps.length === 0 && <Muted>No labeled sets yet. Use Collect Data or Calibrate.</Muted>}
          {reps.map((r) => <StatRow key={r.key} s={r} />)}
        </Card>

        <H>Exercise prediction (9D)</H>
        <Card>
          {ex.n === 0 ? (
            <Muted>Every set you confirm on the Watch is logged here: predicted vs confirmed exercise, confidence, counted vs confirmed reps.</Muted>
          ) : (
            <>
              <Text style={{ color: C.text, fontSize: 16 }}>
                Right {pct(ex.correct, ex.n)} · “Not sure” {pct(ex.unsure, ex.n)} · {ex.n} sets
              </Text>
              {ex.perExercise.map((p) => <Muted key={p.key}>{labelName(p.key)}: {pct(p.correct, p.n)} right of {p.n}{p.unsure ? `, ${p.unsure} not sure` : ''}</Muted>)}
              {ex.confusions.length > 0 && <Text style={{ color: C.text, fontWeight: '700', marginTop: 6 }}>Most confused</Text>}
              {ex.confusions.slice(0, 5).map((c) => {
                const [a = '', b = ''] = c.pair.split(' → ');
                return <Muted key={c.pair}>{labelName(a)} predicted for {labelName(b)} · {c.n}×</Muted>;
              })}
            </>
          )}
        </Card>
      </Screen>
    </>
  );
}

const StatRow = ({ s }: { s: Stat }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
    <Text style={{ color: isUsable(s) ? C.success : C.text, flex: 1 }}>{labelName(s.key)}</Text>
    <Muted>exact {pct(s.exact, s.n)} · ±1 {pct(s.within1, s.n)} · MAE {s.mae.toFixed(1)} · n={s.n}</Muted>
  </View>
);
