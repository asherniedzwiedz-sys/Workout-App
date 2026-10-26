import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Text, View } from 'react-native';
import { deleteWorkout, loadWorkout, loggedSets } from '@/db';
import { healthAvailable, saveWorkoutToHealth } from '@/health';
import { useQuery } from '@/hooks';
import { e1rm, fmtDate, fmtDuration, fmtVolume, fmtWeight, prSetIds, volume } from '@/logic/stats';
import { C } from '@/theme';
import { Button, Card, Ionicons, Muted, Screen } from '@/ui';

export default function WorkoutDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useQuery(() => loadWorkout(Number(id)));
  const prs = new Set(data?.exercises.flatMap((we) => [...prSetIds(loggedSets(we.exercise_id))]) ?? []);
  if (!data) return <Screen><Muted>Workout not found.</Muted></Screen>;
  const { workout, exercises } = data;
  const allSets = exercises.flatMap((e) => e.sets.filter((x) => x.done));
  const prCount = allSets.filter((x) => prs.has(x.id)).length;

  return (
    <>
      <Stack.Screen options={{ title: workout.name }} />
      <Screen>
        <Card>
          <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>{fmtDate(workout.started_at)}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Stat label="Duration" value={fmtDuration((workout.ended_at ?? workout.started_at) - workout.started_at)} />
            <Stat label="Volume" value={`${fmtVolume(volume(allSets))} lbs`} />
            <Stat label="Sets" value={String(allSets.length)} />
            <Stat label="PRs" value={String(prCount)} />
          </View>
          {healthAvailable() && (
            workout.health_synced
              ? <Muted>✓ Saved to Apple Health</Muted>
              : <Button title="Save to Apple Health" variant="secondary" icon="heart" onPress={() => void saveWorkoutToHealth(workout.id)} />
          )}
        </Card>
        {exercises.map((we) => (
          <Card key={we.id}>
            <Text style={{ color: C.accent, fontSize: 17, fontWeight: '800' }} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: we.exercise_id } })}>
              {we.name}
            </Text>
            {we.sets.filter((x) => x.done).map((x, i) => (
              <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ color: C.muted, width: 22 }}>{i + 1}</Text>
                <Text style={{ color: C.text, fontSize: 16, flex: 1 }}>
                  {fmtWeight(x.weight)} lbs × {x.reps}{x.source === 'watch' ? '  ⌚︎' : ''}
                </Text>
                <Muted>e1RM {Math.round(e1rm(x.weight, x.reps))}</Muted>
                {prs.has(x.id) && <Ionicons name="trophy" size={16} color={C.pr} accessibilityLabel="Personal record" />}
              </View>
            ))}
          </Card>
        ))}
        <Button
          title="Delete Workout"
          variant="ghost"
          onPress={() =>
            Alert.alert('Delete workout?', 'This removes it from history (not from Apple Health).', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => (deleteWorkout(workout.id), router.back()) },
            ])
          }
        />
      </Screen>
    </>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <View>
    <Muted>{label}</Muted>
    <Text style={{ color: C.text, fontSize: 18, fontWeight: '800' }}>{value}</Text>
  </View>
);
