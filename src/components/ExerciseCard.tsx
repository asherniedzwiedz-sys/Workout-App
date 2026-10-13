import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatSet, formatWeight } from '@/domain/format';
import { plateBreakdown, warmupSets } from '@/domain/plates';
import { SET_TYPE_LABEL, type Exercise, type SetType } from '@/domain/types';
import {
  addSet,
  addWarmupSets,
  moveExercise,
  removeExercise,
  removeSet,
  setExerciseNotes,
  setRest,
  setSkipped,
  updateSet,
  type ActiveExercise,
  type ActiveSet,
  type PreviousSet,
} from '@/domain/workout';
import { tap } from '@/services/feedback';
import { useActiveWorkout } from '@/state/activeWorkout';
import { getSettings } from '@/state/settings';
import { colors, radius, SET_TYPE_COLOR, space } from '@/theme';

import { showActionSheet } from './ActionSheet';
import { confirm } from './dialogs';
import { NumericInput } from './NumericInput';
import { formatRest, REST_OPTIONS } from './RestTimer';

function setLabel(set: ActiveSet, workingIndex: number): string {
  switch (set.type) {
    case 'warmup':
      return 'W';
    case 'drop':
      return 'D';
    case 'failure':
      return 'F';
    case 'normal':
      return String(workingIndex);
  }
}

const apply = (fn: Parameters<ReturnType<typeof useActiveWorkout.getState>['apply']>[0]) =>
  useActiveWorkout.getState().apply(fn);

export const ExerciseCard = memo(function ExerciseCard({
  exercise,
  meta,
  previous,
  index,
  count,
  onSwap,
}: {
  exercise: ActiveExercise;
  meta: Exercise | undefined;
  previous: PreviousSet[] | undefined;
  index: number;
  count: number;
  onSwap: (key: string) => void;
}) {
  const [showNotes, setShowNotes] = useState(exercise.notes.length > 0);
  const name = meta?.name ?? 'Unknown exercise';
  const isBarbell = meta?.equipment === 'barbell';
  const workingPrev = previous ?? [];

  const openMenu = () => {
    const firstWorking = exercise.sets.find((s) => s.type !== 'warmup');
    const workingWeight = firstWorking ? (firstWorking.weight ?? firstWorking.targetWeight ?? 0) : 0;
    showActionSheet({
      title: name,
      options: [
        {
          label: `Rest timer: ${formatRest(exercise.restSec)}`,
          icon: 'timer-outline',
          testID: 'menu-rest',
          onPress: () =>
            showActionSheet({
              title: `Rest after each ${name} set`,
              options: REST_OPTIONS.map((sec) => ({
                label: formatRest(sec),
                selected: sec === exercise.restSec,
                testID: `rest-option-${sec}`,
                onPress: () => apply((w) => setRest(w, exercise.key, sec)),
              })),
            }),
        },
        { label: 'Swap exercise', icon: 'swap-horizontal', testID: 'menu-swap', onPress: () => onSwap(exercise.key) },
        {
          label: exercise.skipped ? 'Un-skip exercise' : 'Skip exercise',
          icon: exercise.skipped ? 'arrow-undo-outline' : 'play-skip-forward-outline',
          testID: 'menu-skip',
          onPress: () => apply((w) => setSkipped(w, exercise.key, !exercise.skipped)),
        },
        ...(workingWeight > 0 && meta?.equipment !== 'bodyweight'
          ? [
              {
                label: 'Add warm-up sets',
                icon: 'flame-outline' as const,
                onPress: () =>
                  apply((w) =>
                    addWarmupSets(w, exercise.key, warmupSets(workingWeight, isBarbell ? getSettings().barWeight : 0)),
                  ),
              },
            ]
          : []),
        { label: showNotes ? 'Hide note' : 'Add note', icon: 'create-outline', onPress: () => setShowNotes((v) => !v) },
        ...(index > 0
          ? [{ label: 'Move up', icon: 'arrow-up' as const, onPress: () => apply((w) => moveExercise(w, exercise.key, -1)) }]
          : []),
        ...(index < count - 1
          ? [{ label: 'Move down', icon: 'arrow-down' as const, onPress: () => apply((w) => moveExercise(w, exercise.key, 1)) }]
          : []),
        {
          label: 'History & charts',
          icon: 'stats-chart-outline',
          onPress: () => router.push(`/exercise/${exercise.exerciseId}`),
        },
        {
          label: 'Remove exercise',
          icon: 'trash-outline',
          destructive: true,
          testID: 'menu-remove',
          onPress: async () => {
            const hasCompleted = exercise.sets.some((s) => s.completed);
            if (hasCompleted && !(await confirm({ title: `Remove ${name}?`, message: 'Completed sets will be lost.', confirmText: 'Remove', destructive: true }))) {
              return;
            }
            apply((w) => removeExercise(w, exercise.key));
          },
        },
      ],
    });
  };

  if (exercise.skipped) {
    return (
      <View style={[styles.card, styles.skipped]} testID={`exercise-${index}`}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.textDim }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.meta}>Skipped</Text>
          </View>
          <Pressable style={styles.undo} onPress={() => apply((w) => setSkipped(w, exercise.key, false))} testID={`unskip-${index}`}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Undo</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  let workingIndex = 0;
  return (
    <View style={styles.card} testID={`exercise-${index}`}>
      <Pressable style={styles.headerRow} onPress={openMenu} testID={`exercise-menu-${index}`}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          <Text style={styles.meta}>
            {meta ? `${meta.primaryMuscle} · ${meta.equipment} · ` : ''}rest {formatRest(exercise.restSec)}
          </Text>
        </View>
        <Ionicons name="ellipsis-horizontal" size={24} color={colors.accent} />
      </Pressable>

      {showNotes ? (
        <TextInput
          value={exercise.notes}
          onChangeText={(t) => apply((w) => setExerciseNotes(w, exercise.key, t))}
          placeholder="Note (seat height, grip, cues...)"
          placeholderTextColor={colors.textFaint}
          keyboardAppearance="dark"
          multiline
          style={styles.notes}
        />
      ) : null}

      <View style={styles.columns}>
        <Text style={[styles.col, styles.colSetHeader]}>SET</Text>
        <Text style={[styles.col, styles.colPrev]}>PREVIOUS</Text>
        <Text style={[styles.col, styles.colInput]}>{meta?.bodyweight ? '+LB' : 'LB'}</Text>
        <Text style={[styles.col, styles.colInput]}>REPS</Text>
        <View style={styles.colCheck} />
      </View>

      {exercise.sets.map((set, setIndex) => {
        if (set.type === 'normal') workingIndex++;
        const prev = workingPrev[setIndex];
        return (
          <SetRow
            key={set.id}
            exerciseKey={exercise.key}
            set={set}
            label={setLabel(set, workingIndex)}
            previous={prev}
            isBarbell={isBarbell}
            testID={`set-${index}-${setIndex}`}
          />
        );
      })}

      <Pressable
        style={({ pressed }) => [styles.addSet, pressed && { opacity: 0.7 }]}
        onPress={() => {
          tap();
          apply((w) => addSet(w, exercise.key));
        }}
        testID={`add-set-${index}`}
      >
        <Ionicons name="add" size={20} color={colors.text} />
        <Text style={styles.addSetText}>Add set</Text>
      </Pressable>
    </View>
  );
});

const SET_TYPES: SetType[] = ['warmup', 'normal', 'drop', 'failure'];

const SetRow = memo(function SetRow({
  exerciseKey,
  set,
  label,
  previous,
  isBarbell,
  testID,
}: {
  exerciseKey: string;
  set: ActiveSet;
  label: string;
  previous: PreviousSet | undefined;
  isBarbell: boolean;
  testID: string;
}) {
  const toggleSet = useActiveWorkout((s) => s.toggleSet);
  const weightPlaceholder = set.targetWeight !== null ? formatWeight(set.targetWeight) : '–';
  const repsPlaceholder = set.targetReps !== null ? String(set.targetReps) : '–';

  const openSetMenu = () => {
    const weight = set.weight ?? set.targetWeight ?? 0;
    const plates = isBarbell && weight > 0 ? plateBreakdown(weight, getSettings().barWeight) : null;
    showActionSheet({
      title: `Set ${label}`,
      message: plates
        ? `Plates per side for ${formatWeight(weight)} lb: ${plates.perSide.length ? plates.perSide.join(' · ') : 'empty bar'}${plates.remainder ? ` (${formatWeight(plates.remainder)} lb short)` : ''}`
        : undefined,
      options: [
        ...SET_TYPES.map((type) => ({
          label: SET_TYPE_LABEL[type],
          selected: set.type === type,
          testID: `set-type-${type}`,
          onPress: () => apply((w) => updateSet(w, exerciseKey, set.id, { type })),
        })),
        {
          label: 'Delete set',
          icon: 'trash-outline' as const,
          destructive: true,
          testID: 'delete-set',
          onPress: () => apply((w) => removeSet(w, exerciseKey, set.id)),
        },
      ],
    });
  };

  return (
    <View style={[styles.setRow, set.completed && styles.setRowDone]} testID={testID}>
      <Pressable style={styles.colSet} onPress={openSetMenu} hitSlop={6} testID={`${testID}-menu`}>
        <Text style={[styles.setLabel, { color: SET_TYPE_COLOR[set.type] }]}>{label}</Text>
      </Pressable>
      <Pressable
        style={styles.colPrev}
        disabled={!previous || set.completed}
        onPress={() => previous && apply((w) => updateSet(w, exerciseKey, set.id, { weight: previous.weight, reps: previous.reps }))}
      >
        <Text style={styles.prevText} numberOfLines={1}>
          {previous ? formatSet(previous.weight, previous.reps).replace(' lb', '') : '—'}
        </Text>
      </Pressable>
      <View style={styles.colInput}>
        <NumericInput
          decimal
          value={set.weight}
          placeholder={weightPlaceholder}
          completed={set.completed}
          testID={`${testID}-weight`}
          accessibilityLabel="Weight in pounds"
          onChange={(weight) => apply((w) => updateSet(w, exerciseKey, set.id, { weight }))}
        />
      </View>
      <View style={styles.colInput}>
        <NumericInput
          value={set.reps}
          placeholder={repsPlaceholder}
          completed={set.completed}
          testID={`${testID}-reps`}
          accessibilityLabel="Reps"
          onChange={(reps) => apply((w) => updateSet(w, exerciseKey, set.id, { reps }))}
        />
      </View>
      <Pressable
        style={[styles.check, set.completed && styles.checkDone]}
        onPress={() => toggleSet(exerciseKey, set.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: set.completed }}
        accessibilityLabel={set.completed ? 'Mark set not done' : 'Complete set'}
        hitSlop={4}
        testID={`${testID}-check`}
      >
        <Ionicons name="checkmark" size={26} color={set.completed ? '#062414' : colors.textDim} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  skipped: { opacity: 0.7 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, minHeight: 48, gap: space.sm },
  name: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  meta: { color: colors.textFaint, fontSize: 13, marginTop: 2, textTransform: 'capitalize' },
  undo: { paddingHorizontal: space.md, height: 44, justifyContent: 'center' },
  notes: {
    marginHorizontal: space.md,
    marginTop: space.sm,
    color: colors.text,
    backgroundColor: colors.input,
    borderRadius: radius.sm,
    padding: space.sm,
    fontSize: 15,
    minHeight: 40,
  },
  columns: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, marginTop: space.sm, marginBottom: 2 },
  col: { color: colors.textFaint, fontSize: 11, fontWeight: '700', textAlign: 'center', letterSpacing: 0.5 },
  colSet: { width: 40, alignItems: 'center', justifyContent: 'center', height: 44 },
  colSetHeader: { width: 40 },
  colPrev: { flex: 1.3, alignItems: 'center', justifyContent: 'center' },
  colInput: { flex: 1, marginHorizontal: 3 },
  colCheck: { width: 52 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingVertical: 3 },
  setRowDone: { backgroundColor: colors.successDim },
  setLabel: { fontSize: 16, fontWeight: '800' },
  prevText: { color: colors.textFaint, fontSize: 14 },
  check: {
    width: 48,
    height: 44,
    marginLeft: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.success },
  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: space.md,
    marginTop: space.sm,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
  addSetText: { color: colors.text, fontWeight: '700', fontSize: 15 },
});
