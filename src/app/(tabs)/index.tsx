import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { showActionSheet } from '@/components/ActionSheet';
import { confirm } from '@/components/dialogs';
import { Button, Card, EmptyState, SectionTitle } from '@/components/ui';
import { duplicateRoutine, listRoutines, moveRoutine } from '@/db/routines';
import { listWorkoutSummaries } from '@/db/workouts';
import { formatDate } from '@/domain/format';
import type { Routine } from '@/domain/types';
import { useData } from '@/hooks/useData';
import { removeRoutine } from '@/services/reminders';
import { startRoutineWorkout, startEmptyWorkout } from '@/services/workoutActions';
import { notifyDataChanged } from '@/state/dataVersion';
import { exerciseName } from '@/state/exercises';
import { colors, font, radius, space } from '@/theme';

export default function WorkoutHome() {
  const { data } = useData(async () => {
    const [routines, recent] = await Promise.all([listRoutines(), listWorkoutSummaries(200)]);
    const lastDone: Record<number, number> = {};
    for (const w of recent) {
      if (w.routineId !== null && lastDone[w.routineId] === undefined) lastDone[w.routineId] = w.startedAt;
    }
    return { routines, lastDone };
  });
  const routines = data?.routines ?? [];

  const routineMenu = (routine: Routine, index: number) =>
    showActionSheet({
      title: routine.name,
      options: [
        { label: 'Edit routine', icon: 'create-outline', onPress: () => router.push(`/routine/${routine.id}`) },
        {
          label: 'Duplicate',
          icon: 'copy-outline',
          onPress: async () => {
            await duplicateRoutine(routine.id);
            notifyDataChanged();
          },
        },
        ...(index > 0
          ? [{ label: 'Move up', icon: 'arrow-up' as const, onPress: async () => { await moveRoutine(routine.id, -1); notifyDataChanged(); } }]
          : []),
        ...(index < routines.length - 1
          ? [{ label: 'Move down', icon: 'arrow-down' as const, onPress: async () => { await moveRoutine(routine.id, 1); notifyDataChanged(); } }]
          : []),
        {
          label: 'Delete routine',
          icon: 'trash-outline',
          destructive: true,
          onPress: async () => {
            if (await confirm({ title: `Delete "${routine.name}"?`, message: 'Your workout history is kept.', confirmText: 'Delete', destructive: true })) {
              await removeRoutine(routine.id);
              notifyDataChanged();
            }
          },
        },
      ],
    });

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.scroll}>
      <Button title="Start empty workout" icon="add" size="lg" onPress={() => void startEmptyWorkout()} testID="start-empty" />

      <Card style={styles.aiCard} onPress={() => router.push('/ai-builder')} testID="open-ai-builder">
        <View style={styles.aiIcon}>
          <Ionicons name="sparkles" size={22} color={colors.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={font.subheading}>AI workout builder</Text>
          <Text style={font.small}>Generate a weekly plan from your goal, schedule and equipment.</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
      </Card>

      <SectionTitle
        right={<Button title="New routine" icon="add" variant="ghost" size="sm" onPress={() => router.push('/routine/new')} testID="new-routine" />}
      >
        {`Routines (${routines.length})`}
      </SectionTitle>

      {routines.length === 0 && data ? (
        <Card>
          <EmptyState
            icon="clipboard-outline"
            title="No routines yet"
            body="Build one from the exercise library, or let the AI builder make a full week for you."
          />
        </Card>
      ) : null}

      <View style={{ gap: space.md }}>
        {routines.map((routine, index) => (
          <Card key={routine.id} onPress={() => router.push(`/routine/${routine.id}`)} testID={`routine-${index}`}>
            <View style={styles.routineHeader}>
              <Text style={[font.heading, { flex: 1 }]} numberOfLines={1}>
                {routine.name}
              </Text>
              {routine.source === 'ai' ? <Ionicons name="sparkles" size={16} color={colors.gold} /> : null}
              <Pressable onPress={() => routineMenu(routine, index)} hitSlop={10} style={styles.menuButton} testID={`routine-menu-${index}`}>
                <Ionicons name="ellipsis-horizontal" size={22} color={colors.textDim} />
              </Pressable>
            </View>
            <Text style={styles.routineExercises} numberOfLines={3}>
              {routine.exercises.length === 0
                ? 'No exercises'
                : routine.exercises.map((e) => `${e.sets}× ${exerciseName(e.exerciseId)}`).join(', ')}
            </Text>
            <View style={styles.routineFooter}>
              <Text style={font.tiny}>
                {data?.lastDone[routine.id] ? `Last done ${formatDate(data.lastDone[routine.id] ?? 0)}` : 'Not done yet'}
              </Text>
              <Button
                title="Start"
                icon="play"
                size="sm"
                disabled={routine.exercises.length === 0}
                onPress={() => void startRoutineWorkout(routine)}
                testID={`start-routine-${index}`}
              />
            </View>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, paddingBottom: 120 },
  aiCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  aiIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.goldDim, alignItems: 'center', justifyContent: 'center' },
  routineHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  menuButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  routineExercises: { ...font.small, marginTop: space.xs, lineHeight: 20 },
  routineFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md },
});
