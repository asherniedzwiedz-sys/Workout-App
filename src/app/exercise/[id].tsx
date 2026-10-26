import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { LineChart } from '@/Chart';
import { getExercise, loggedSets } from '@/db';
import { useQuery } from '@/hooks';
import { MANUAL_ONLY_REASON } from '@/logic/exercises';
import { e1rm, fmtDate, fmtWeight, progression, prSetIds } from '@/logic/stats';
import { C } from '@/theme';
import { Card, H, Ionicons, Muted, Screen } from '@/ui';

const cap = (t: string) => t.replace(/(^|,)(\w)/g, (_m, sep: string, c: string) => `${sep ? ', ' : ''}${c.toUpperCase()}`);

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ex = useQuery(() => getExercise(id));
  const sets = useQuery(() => loggedSets(id));
  if (!ex) return <Screen><Muted>Exercise not found.</Muted></Screen>;

  const points = progression(sets);
  const prs = prSetIds(sets);
  const best = sets.reduce<(typeof sets)[number] | null>((b, s) => (!b || e1rm(s.weight, s.reps) > e1rm(b.weight, b.reps) ? s : b), null);
  const heaviest = sets.reduce((m, s) => Math.max(m, s.weight), 0);
  const recentPrs = sets.filter((s) => prs.has(s.id)).slice(-5).reverse();

  return (
    <>
      <Stack.Screen options={{ title: ex.name }} />
      <Screen>
        <Card>
          <Muted>{cap(ex.muscle)}{ex.secondary ? ` · also ${cap(ex.secondary)}` : ''} · {cap(ex.equipment)}</Muted>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <Ionicons name="watch-outline" size={18} color={ex.motion === 'wrist' ? C.success : C.warn} />
            <Text style={{ color: C.text, flex: 1 }}>
              {ex.motion === 'wrist'
                ? 'Apple Watch can detect this exercise and count reps (predict-and-confirm).'
                : ex.motion === 'manual'
                  ? `MANUAL ONLY. ${MANUAL_ONLY_REASON}`
                  : 'Not in the Watch motion seed list yet — log it manually on the Watch.'}
            </Text>
          </View>
        </Card>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Muted>Best est. 1RM</Muted>
              <Text style={{ color: C.text, fontSize: 22, fontWeight: '800' }}>{best ? `${Math.round(e1rm(best.weight, best.reps))} lbs` : '—'}</Text>
              {best && <Muted>{fmtWeight(best.weight)} × {best.reps}</Muted>}
            </View>
            <View>
              <Muted>Heaviest</Muted>
              <Text style={{ color: C.text, fontSize: 22, fontWeight: '800' }}>{heaviest ? `${fmtWeight(heaviest)} lbs` : '—'}</Text>
            </View>
            <View>
              <Muted>Sets logged</Muted>
              <Text style={{ color: C.text, fontSize: 22, fontWeight: '800' }}>{sets.length}</Text>
            </View>
          </View>
        </Card>
        <H>Estimated 1RM</H>
        <Card><LineChart points={points.map((p) => ({ at: p.at, y: p.e1rm }))} /></Card>
        <H>Top set weight</H>
        <Card><LineChart points={points.map((p) => ({ at: p.at, y: p.topWeight }))} color={C.success} /></Card>
        <H>Recent PRs</H>
        <Card>
          {recentPrs.length === 0 && <Muted>PRs are flagged automatically when you beat your best weight or estimated 1RM.</Muted>}
          {recentPrs.map((s) => (
            <View key={s.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Ionicons name="trophy" size={16} color={C.pr} />
              <Text style={{ color: C.text, flex: 1 }}>{fmtWeight(s.weight)} lbs × {s.reps}</Text>
              <Muted>{fmtDate(s.at)}</Muted>
            </View>
          ))}
        </Card>
      </Screen>
    </>
  );
}
