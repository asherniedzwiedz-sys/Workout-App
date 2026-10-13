import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { router, Stack } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { showActionSheet } from '@/components/ActionSheet';
import { confirm, notify } from '@/components/dialogs';
import { ExerciseCard } from '@/components/ExerciseCard';
import { ExercisePicker } from '@/components/ExercisePicker';
import { NUMPAD_ACCESSORY_ID } from '@/components/NumericInput';
import { pickManualRest, RestTimerBar } from '@/components/RestTimer';
import { Button, EmptyState } from '@/components/ui';
import { formatClock, formatVolume } from '@/domain/format';
import { workoutTotals } from '@/domain/workout';
import { useNow } from '@/hooks/useNow';
import { describeNext, useActiveWorkout } from '@/state/activeWorkout';
import { useExercises } from '@/state/exercises';
import { useSettings } from '@/state/settings';
import { colors, space } from '@/theme';

function KeepAwake() {
  useKeepAwake('active-workout');
  return null;
}

export default function ActiveWorkoutScreen() {
  const workout = useActiveWorkout((s) => s.workout);
  const previous = useActiveWorkout((s) => s.previous);
  const byId = useExercises((s) => s.byId);
  const keepAwake = useSettings((s) => s.settings.keepAwake);
  const now = useNow(1000, workout !== null);
  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'swap'; key: string } | null>(null);
  const [finishing, setFinishing] = useState(false);

  const totals = useMemo(() => (workout ? workoutTotals(workout) : null), [workout]);

  const onSwap = useCallback((key: string) => setPicker({ mode: 'swap', key }), []);

  if (!workout || !totals) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <EmptyState
          icon="barbell-outline"
          title="No workout in progress"
          action={<Button title="Back" variant="secondary" onPress={() => router.back()} />}
        />
      </SafeAreaView>
    );
  }

  const swapTarget = picker?.mode === 'swap' ? workout.exercises.find((e) => e.key === picker.key) : undefined;

  const finish = async () => {
    Keyboard.dismiss();
    if (totals.completedSets === 0) {
      const discard = await confirm({
        title: 'No sets completed',
        message: 'Check off at least one set to save this workout. Discard it instead?',
        confirmText: 'Discard',
        destructive: true,
      });
      if (discard) {
        await useActiveWorkout.getState().discard();
        router.back();
      }
      return;
    }
    const pending = totals.totalSets - totals.completedSets;
    const ok = await confirm({
      title: 'Finish workout?',
      message: pending > 0 ? `${pending} unfinished ${pending === 1 ? 'set' : 'sets'} will be dropped.` : undefined,
      confirmText: 'Finish',
    });
    if (!ok) return;
    setFinishing(true);
    try {
      const result = await useActiveWorkout.getState().finish();
      if (result) router.replace(`/history/${result.workoutId}?finished=1`);
    } catch (error) {
      notify('Could not save workout', error instanceof Error ? error.message : String(error));
    } finally {
      setFinishing(false);
    }
  };

  const discard = async () => {
    const ok = await confirm({
      title: 'Discard workout?',
      message: 'Everything logged in this workout will be deleted.',
      confirmText: 'Discard',
      destructive: true,
    });
    if (!ok) return;
    await useActiveWorkout.getState().discard();
    router.back();
  };

  const openWorkoutMenu = () =>
    showActionSheet({
      title: workout.name,
      options: [
        {
          label: 'Start rest timer',
          icon: 'timer-outline',
          onPress: () => pickManualRest('Manual', describeNext(workout)),
        },
        { label: 'Discard workout', icon: 'trash-outline', destructive: true, testID: 'discard-workout', onPress: discard },
      ],
    });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      {keepAwake && Platform.OS !== 'web' ? <KeepAwake /> : null}

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton} accessibilityLabel="Minimize workout" testID="minimize-workout">
          <Ionicons name="chevron-down" size={28} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.clock} testID="workout-clock">
            {formatClock((now - workout.startedAt) / 1000)}
          </Text>
        </View>
        <Pressable onPress={openWorkoutMenu} style={styles.headerButton} accessibilityLabel="Workout options" testID="workout-menu">
          <Ionicons name="ellipsis-horizontal-circle" size={28} color={colors.textDim} />
        </Pressable>
        <Button title="Finish" variant="success" size="sm" onPress={finish} loading={finishing} style={{ paddingHorizontal: space.lg }} testID="finish-workout" />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
        >
          <TextInput
            value={workout.name}
            onChangeText={(name) => useActiveWorkout.getState().apply((w) => ({ ...w, name }))}
            style={styles.title}
            keyboardAppearance="dark"
            selectionColor={colors.accent}
            testID="workout-name"
          />
          <Text style={styles.summary} testID="workout-summary">
            {totals.completedSets}/{totals.totalSets} sets · {formatVolume(totals.volume)}
          </Text>

          {workout.exercises.length === 0 ? (
            <EmptyState icon="add-circle-outline" title="Empty workout" body="Add exercises from the library to start logging." />
          ) : null}

          <View style={{ gap: space.md }}>
            {workout.exercises.map((exercise, index) => (
              <ExerciseCard
                key={exercise.key}
                exercise={exercise}
                meta={byId[exercise.exerciseId]}
                previous={previous[exercise.exerciseId]}
                index={index}
                count={workout.exercises.length}
                onSwap={onSwap}
              />
            ))}
          </View>

          <Button
            title="Add exercises"
            icon="add"
            variant="secondary"
            size="lg"
            onPress={() => setPicker({ mode: 'add' })}
            style={{ marginTop: space.lg }}
            testID="add-exercises"
          />
          <Button title="Discard workout" variant="danger" onPress={discard} style={{ marginTop: space.md }} />
        </ScrollView>
      </View>

      <RestTimerBar />

      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={NUMPAD_ACCESSORY_ID} backgroundColor={colors.surfaceRaised}>
          <View style={styles.accessory}>
            <Pressable onPress={() => Keyboard.dismiss()} style={styles.accessoryButton} accessibilityLabel="Done">
              <Text style={styles.accessoryText}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}

      <ExercisePicker
        visible={picker !== null}
        multi={picker?.mode !== 'swap'}
        title={picker?.mode === 'swap' ? 'Swap exercise' : 'Add exercises'}
        initialMuscle={swapTarget ? (byId[swapTarget.exerciseId]?.primaryMuscle ?? null) : null}
        onClose={() => setPicker(null)}
        onPick={(ids) => {
          if (picker?.mode === 'swap') {
            const id = ids[0];
            if (id) void useActiveWorkout.getState().swap(picker.key, id);
          } else {
            void useActiveWorkout.getState().addExercises(ids);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    gap: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  clock: { color: colors.text, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  scroll: { padding: space.md, paddingBottom: 160 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', paddingVertical: space.xs },
  summary: { color: colors.textDim, fontSize: 14, marginBottom: space.md },
  accessory: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.md, paddingVertical: space.xs },
  accessoryButton: { paddingHorizontal: space.lg, height: 40, justifyContent: 'center' },
  accessoryText: { color: colors.accent, fontSize: 17, fontWeight: '700' },
});
