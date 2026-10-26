import { router } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';
import { activeWorkout, deleteRoutine, listRoutines } from '@/db';
import { useNow, useQuery } from '@/hooks';
import { fmtDuration } from '@/logic/stats';
import { C, TAP } from '@/theme';
import { Button, Card, H, Ionicons, Muted, Row, Screen } from '@/ui';

const startRoutine = (routineId?: number) =>
  router.push(routineId ? { pathname: '/workout', params: { routineId: String(routineId) } } : '/workout');

export default function WorkoutTab() {
  const active = useQuery(activeWorkout);
  const routines = useQuery(listRoutines);
  const now = useNow();

  const start = (routineId?: number) =>
    active
      ? Alert.alert('Workout in progress', 'Finish or discard the current workout first.', [{ text: 'Resume', onPress: () => startRoutine() }, { text: 'OK' }])
      : startRoutine(routineId);

  return (
    <Screen>
      {active && (
        <Card style={{ borderWidth: 1, borderColor: C.success }}>
          <Row title={active.name} subtitle={`In progress · ${fmtDuration(now - active.started_at)}`} icon="pulse" />
          <Button title="Resume Workout" variant="success" onPress={() => startRoutine()} />
        </Card>
      )}
      {!active && <Button title="Start Empty Workout" icon="add-circle" onPress={() => start()} />}
      <Button title="AI Workout Builder" icon="sparkles" variant="secondary" onPress={() => router.push('/generate')} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <H>Routines</H>
        <Button title="New" icon="add" variant="ghost" onPress={() => router.push({ pathname: '/routine/[id]', params: { id: 'new' } })} />
      </View>
      {routines.length === 0 && <Muted>No routines yet. Create one, or let the AI builder make a split for you.</Muted>}
      {routines.map((r) => (
        <Row
          key={r.id}
          title={r.name}
          subtitle={r.exercise_count ? `${r.exercise_count} exercises · ${r.summary}` : 'Empty'}
          onPress={() => router.push({ pathname: '/routine/[id]', params: { id: String(r.id) } })}
          onLongPress={() =>
            Alert.alert(r.name, undefined, [
              { text: 'Delete routine', style: 'destructive', onPress: () => deleteRoutine(r.id) },
              { text: 'Cancel', style: 'cancel' },
            ])
          }
          right={
            <Pressable
              accessibilityLabel={`Start ${r.name}`}
              onPress={() => start(r.id)}
              style={{ width: TAP, height: TAP, borderRadius: TAP / 2, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="play" size={24} color="#fff" />
            </Pressable>
          }
        />
      ))}
    </Screen>
  );
}
