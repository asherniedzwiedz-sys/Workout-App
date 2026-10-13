import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { confirm, notify } from '@/components/dialogs';
import { Badge, Button, Card, EmptyState, SectionTitle, Stat } from '@/components/ui';
import { getRoutine, saveRoutine, updateRoutineFromWorkout } from '@/db/routines';
import { countWorkouts, deleteWorkout, getWorkoutDetail, updateWorkoutMeta } from '@/db/workouts';
import { formatDateLong, formatDuration, formatSet, formatTimeOfDay, formatVolume, formatWeight } from '@/domain/format';
import { PR_LABEL, type LoggedSet, type PrKind, type WorkoutDetail } from '@/domain/types';
import { useData } from '@/hooks/useData';
import { healthSupport, syncWorkoutToHealth } from '@/services/health';
import { useSettings } from '@/state/settings';
import { notifyDataChanged } from '@/state/dataVersion';
import { getExercise } from '@/state/exercises';
import { colors, font, radius, SET_TYPE_COLOR, space } from '@/theme';

function prValue(kind: PrKind, set: LoggedSet): string {
  switch (kind) {
    case 'e1rm':
      return `${formatWeight(set.e1rm)} lb`;
    case 'weight':
      return `${formatWeight(set.weight)} lb`;
    case 'volume':
      return `${formatWeight(set.weight * set.reps)} lb`;
    case 'reps':
      return `${set.reps} reps`;
  }
}

function setLabels(sets: LoggedSet[]): string[] {
  let n = 0;
  return sets.map((s) => {
    if (s.type === 'warmup') return 'W';
    if (s.type === 'drop') return 'D';
    if (s.type === 'failure') return 'F';
    n++;
    return String(n);
  });
}

export default function WorkoutDetailScreen() {
  const { id, finished } = useLocalSearchParams<{ id: string; finished?: string }>();
  const workoutId = Number(id);
  const { data, loading } = useData(async () => {
    const detail = await getWorkoutDetail(workoutId);
    const routine = detail?.routineId ? await getRoutine(detail.routineId) : null;
    const total = await countWorkouts();
    return { detail, routine, total };
  }, [workoutId]);
  const detail = data?.detail;
  const [notes, setNotes] = useState('');
  const [routineUpdated, setRoutineUpdated] = useState(false);
  const healthOn = useSettings((s) => s.settings.healthSync) && healthSupport() === 'available';

  useEffect(() => {
    setNotes(detail?.notes ?? '');
  }, [detail?.notes]);

  if (!detail) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ title: 'Workout' }} />
        {!loading ? <EmptyState icon="alert-circle-outline" title="Workout not found" /> : null}
      </View>
    );
  }

  const prs = detail.exercises.flatMap((e) => e.sets.flatMap((s) => s.prs.map((kind) => ({ kind, set: s, name: e.name }))));
  const isFinished = finished === '1';
  const routine = data?.routine ?? null;
  const started = new Date(detail.startedAt);

  const saveAsRoutine = async () => {
    const id = await saveRoutine({ name: detail.name, exercises: routineFromWorkout(detail) });
    notifyDataChanged();
    router.push(`/routine/${id}`);
  };

  const updateRoutine = async () => {
    if (!routine) return;
    const changed = await updateRoutineFromWorkout(routine.id, detail);
    notifyDataChanged();
    setRoutineUpdated(true);
    if (!changed) notify('Routine already up to date');
  };

  const remove = async () => {
    if (!(await confirm({ title: 'Delete this workout?', message: 'Its sets and PRs are removed from history.', confirmText: 'Delete', destructive: true }))) return;
    await deleteWorkout(detail.id);
    notifyDataChanged();
    router.back();
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.scroll}>
      <Stack.Screen options={{ title: isFinished ? 'Summary' : 'Workout' }} />

      {isFinished ? (
        <View style={styles.hero} testID="workout-complete">
          <Ionicons name="trophy" size={44} color={colors.gold} />
          <Text style={styles.heroTitle}>Workout complete</Text>
          <Text style={font.small}>That's workout #{data?.total ?? 1}. Nice work.</Text>
        </View>
      ) : null}

      <Text style={font.title}>{detail.name}</Text>
      <Text style={[font.small, { marginTop: 2 }]}>
        {formatDateLong(detail.startedAt)} · {formatTimeOfDay(started.getHours(), started.getMinutes())}
      </Text>

      <Card style={{ marginTop: space.lg }}>
        <View style={{ flexDirection: 'row' }}>
          <Stat label="Duration" value={formatDuration(detail.durationSec)} />
          <Stat label="Volume" value={formatVolume(detail.totalVolume)} />
          <Stat label="Sets" value={String(detail.totalSets)} />
          <Stat label="PRs" value={String(prs.length)} />
        </View>
      </Card>

      {prs.length > 0 ? (
        <>
          <SectionTitle>Personal records</SectionTitle>
          <Card style={{ gap: space.sm }} testID="pr-list">
            {prs.map((p, i) => (
              <View key={`${p.set.id}-${p.kind}-${i}`} style={styles.prRow}>
                <Ionicons name="trophy" size={18} color={colors.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.prName}>{p.name}</Text>
                  <Text style={font.small}>
                    {PR_LABEL[p.kind]}: {prValue(p.kind, p.set)} ({formatSet(p.set.weight, p.set.reps)})
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>Exercises</SectionTitle>
      <View style={{ gap: space.md }}>
        {detail.exercises.map((e, index) => {
          const labels = setLabels(e.sets);
          return (
            <Card key={`${e.exerciseId}-${index}`}>
              <Pressable onPress={() => router.push(`/exercise/${e.exerciseId}`)} style={styles.exerciseHeader}>
                <Text style={styles.exerciseName}>{e.name}</Text>
                <Ionicons name="stats-chart" size={16} color={colors.accent} />
              </Pressable>
              {e.notes ? <Text style={[font.small, { marginBottom: space.sm }]}>{e.notes}</Text> : null}
              {e.sets.map((s, i) => (
                <View key={s.id} style={styles.setRow}>
                  <Text style={[styles.setLabel, { color: SET_TYPE_COLOR[s.type] }]}>{labels[i]}</Text>
                  <Text style={styles.setText}>{formatSet(s.weight, s.reps)}</Text>
                  {s.e1rm > 0 ? <Text style={styles.e1rm}>1RM {formatWeight(s.e1rm)}</Text> : <View style={{ flex: 1 }} />}
                  <View style={styles.badges}>
                    {s.prs.map((k) => (
                      <Badge key={k} icon="trophy" label={PR_LABEL[k]} />
                    ))}
                  </View>
                </View>
              ))}
            </Card>
          );
        })}
      </View>

      <SectionTitle>Notes</SectionTitle>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        onBlur={() => {
          if (notes !== (detail.notes ?? '')) void updateWorkoutMeta(detail.id, { notes }).then(notifyDataChanged);
        }}
        placeholder="How did it go?"
        placeholderTextColor={colors.textFaint}
        keyboardAppearance="dark"
        multiline
        style={styles.notes}
      />

      {healthOn ? (
        <View style={styles.health}>
          <Ionicons name={detail.healthSynced ? 'heart' : 'heart-outline'} size={16} color={colors.danger} />
          <Text style={font.small}>{detail.healthSynced ? 'Saved to Apple Health' : 'Not in Apple Health yet'}</Text>
          {!detail.healthSynced ? (
            <Text
              style={{ color: colors.accent, fontWeight: '700' }}
              onPress={async () => {
                const ok = await syncWorkoutToHealth(detail.id);
                notifyDataChanged();
                if (!ok) notify('Apple Health', 'Could not save. Check Health permissions for IronLog.');
              }}
            >
              Save now
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: space.md, marginTop: space.xl }}>
        {routine ? (
          <Button
            title={routineUpdated ? 'Routine updated' : `Update "${routine.name}" with today's weights`}
            icon={routineUpdated ? 'checkmark' : 'refresh'}
            variant="secondary"
            disabled={routineUpdated}
            onPress={updateRoutine}
            testID="update-routine"
          />
        ) : null}
        <Button title="Save as new routine" icon="bookmark-outline" variant="secondary" onPress={saveAsRoutine} testID="save-as-routine" />
        {isFinished ? <Button title="Done" size="lg" onPress={() => router.back()} testID="summary-done" /> : null}
        <Button title="Delete workout" variant="danger" onPress={remove} testID="delete-workout" />
      </View>
    </ScrollView>
  );
}

/** Turns a logged workout into routine targets: working-set count plus the top set's weight × reps. */
function routineFromWorkout(detail: WorkoutDetail) {
  return detail.exercises
    .map((e) => {
      const working = e.sets.filter((s) => s.type !== 'warmup');
      const top = working.reduce<LoggedSet | null>(
        (best, s) => (!best || s.e1rm > best.e1rm || (s.e1rm === best.e1rm && s.reps > best.reps) ? s : best),
        null,
      );
      return {
        exerciseId: e.exerciseId,
        sets: Math.max(1, working.length),
        reps: top?.reps ?? 8,
        weight: top?.weight ?? 0,
        restSec: getExercise(e.exerciseId)?.defaultRestSec ?? 120,
      };
    })
    .filter((e, i, all) => all.findIndex((x) => x.exerciseId === e.exerciseId) === i);
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, paddingBottom: 80 },
  health: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg },
  hero: { alignItems: 'center', gap: space.xs, paddingVertical: space.lg, marginBottom: space.md },
  heroTitle: { ...font.title },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  prName: { color: colors.text, fontWeight: '700', fontSize: 15 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm, minHeight: 32 },
  exerciseName: { color: colors.accent, fontSize: 17, fontWeight: '700', flex: 1 },
  setRow: { flexDirection: 'row', alignItems: 'center', minHeight: 32, gap: space.sm, flexWrap: 'wrap' },
  setLabel: { width: 22, fontWeight: '800', fontSize: 15 },
  setText: { color: colors.text, fontSize: 15, width: 110 },
  e1rm: { color: colors.textFaint, fontSize: 12, flex: 1 },
  badges: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  notes: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: 80,
    fontSize: 15,
    textAlignVertical: 'top',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
