import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { showActionSheet } from '@/components/ActionSheet';
import { confirm, notify } from '@/components/dialogs';
import { ExercisePicker } from '@/components/ExercisePicker';
import { NumericInput } from '@/components/NumericInput';
import { formatRest, REST_OPTIONS } from '@/components/RestTimer';
import { Button, EmptyState, Field } from '@/components/ui';
import { getRoutine, saveRoutine } from '@/db/routines';
import type { RoutineExercise } from '@/domain/types';
import { makeId } from '@/domain/workout';
import { refreshRoutineReminders, removeRoutine } from '@/services/reminders';
import { startRoutineWorkout } from '@/services/workoutActions';
import { notifyDataChanged } from '@/state/dataVersion';
import { getExercise, useExercises } from '@/state/exercises';
import { colors, font, radius, space } from '@/theme';

type Row = RoutineExercise & { key: string };

function defaultRoutineExercise(exerciseId: string): RoutineExercise {
  const meta = getExercise(exerciseId);
  return {
    exerciseId,
    sets: 3,
    reps: meta?.category === 'isolation' ? 12 : 8,
    weight: 0,
    restSec: meta?.defaultRestSec ?? 120,
  };
}

export default function RoutineEditor() {
  const params = useLocalSearchParams<{ id: string }>();
  const isNew = params.id === 'new';
  const routineId = isNew ? undefined : Number(params.id);
  const byId = useExercises((s) => s.byId);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [source, setSource] = useState<'manual' | 'ai'>('manual');
  const [loaded, setLoaded] = useState(isNew);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (routineId === undefined) return;
    void getRoutine(routineId).then((r) => {
      if (r) {
        setName(r.name);
        setNotes(r.notes ?? '');
        setSource(r.source);
        setRows(r.exercises.map((e) => ({ ...e, key: makeId('row') })));
      }
      setLoaded(true);
    });
  }, [routineId]);

  const update = (key: string, patch: Partial<RoutineExercise>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const move = (index: number, dir: -1 | 1) =>
    setRows((rs) => {
      const target = index + dir;
      if (target < 0 || target >= rs.length) return rs;
      const next = [...rs];
      const [item] = next.splice(index, 1);
      if (item) next.splice(target, 0, item);
      return next;
    });

  const save = async (): Promise<number | null> => {
    if (!name.trim()) {
      notify('Name your routine', 'Give it a name like "Push Day" or "Full Body A".');
      return null;
    }
    setSaving(true);
    try {
      const id = await saveRoutine({
        id: routineId,
        name,
        notes,
        source,
        exercises: rows.map(({ key: _key, id: _id, ...rest }) => rest),
      });
      if (routineId !== undefined) void refreshRoutineReminders(id);
      notifyDataChanged();
      return id;
    } finally {
      setSaving(false);
    }
  };

  const rowMenu = (row: Row, index: number) =>
    showActionSheet({
      title: byId[row.exerciseId]?.name,
      options: [
        ...(index > 0 ? [{ label: 'Move up', icon: 'arrow-up' as const, onPress: () => move(index, -1) }] : []),
        ...(index < rows.length - 1 ? [{ label: 'Move down', icon: 'arrow-down' as const, onPress: () => move(index, 1) }] : []),
        { label: 'History & charts', icon: 'stats-chart-outline', onPress: () => router.push(`/exercise/${row.exerciseId}`) },
        {
          label: 'Remove',
          icon: 'trash-outline',
          destructive: true,
          testID: 'routine-row-remove',
          onPress: () => setRows((rs) => rs.filter((r) => r.key !== row.key)),
        },
      ],
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: isNew ? 'New routine' : 'Edit routine',
          headerRight: () => (
            <Button
              title="Save"
              variant="ghost"
              size="sm"
              loading={saving}
              testID="save-routine"
              onPress={async () => {
                const id = await save();
                if (id !== null) router.back();
              }}
            />
          ),
        }}
      />
      {loaded ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <Field label="Routine name" value={name} onChangeText={setName} placeholder="Push Day" testID="routine-name" />
          <Field
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional"
            style={{ marginTop: space.md }}
            inputStyle={{ height: 64, paddingTop: space.sm }}
            multiline
          />
          <Text style={[font.tiny, { marginTop: space.lg }]}>
            Leave weight empty to reuse whatever you lifted last time.
          </Text>

          {rows.length === 0 ? <EmptyState icon="barbell-outline" title="No exercises yet" /> : null}

          <View style={{ gap: space.md, marginTop: space.md }}>
            {rows.map((row, index) => (
              <View key={row.key} style={styles.row} testID={`routine-row-${index}`}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowName} numberOfLines={2}>
                    {byId[row.exerciseId]?.name ?? row.exerciseId}
                  </Text>
                  <Pressable onPress={() => rowMenu(row, index)} hitSlop={10} style={styles.menu} testID={`routine-row-menu-${index}`}>
                    <Ionicons name="ellipsis-horizontal" size={22} color={colors.textDim} />
                  </Pressable>
                </View>
                <View style={styles.inputs}>
                  <View style={styles.inputCol}>
                    <Text style={styles.inputLabel}>SETS</Text>
                    <NumericInput value={row.sets} placeholder="3" onChange={(v) => update(row.key, { sets: v ?? 1 })} testID={`routine-row-${index}-sets`} />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.inputLabel}>REPS</Text>
                    <NumericInput value={row.reps} placeholder="8" onChange={(v) => update(row.key, { reps: v ?? 1 })} testID={`routine-row-${index}-reps`} />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.inputLabel}>LB</Text>
                    <NumericInput
                      decimal
                      value={row.weight > 0 ? row.weight : null}
                      placeholder="auto"
                      onChange={(v) => update(row.key, { weight: v ?? 0 })}
                      testID={`routine-row-${index}-weight`}
                    />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.inputLabel}>REST</Text>
                    <Pressable
                      style={styles.restButton}
                      onPress={() =>
                        showActionSheet({
                          title: 'Rest between sets',
                          options: REST_OPTIONS.map((sec) => ({
                            label: formatRest(sec),
                            selected: sec === row.restSec,
                            onPress: () => update(row.key, { restSec: sec }),
                          })),
                        })
                      }
                    >
                      <Text style={styles.restText}>{formatRest(row.restSec)}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <Button title="Add exercises" icon="add" variant="secondary" size="lg" onPress={() => setPicking(true)} style={{ marginTop: space.lg }} testID="routine-add-exercises" />

          {!isNew ? (
            <>
              <Button
                title="Save & start workout"
                icon="play"
                size="lg"
                style={{ marginTop: space.md }}
                disabled={rows.length === 0}
                onPress={async () => {
                  const id = await save();
                  if (id === null) return;
                  const routine = await getRoutine(id);
                  if (routine) {
                    router.back();
                    await startRoutineWorkout(routine);
                  }
                }}
              />
              <Button
                title="Delete routine"
                variant="danger"
                style={{ marginTop: space.md }}
                onPress={async () => {
                  if (routineId === undefined) return;
                  if (await confirm({ title: 'Delete routine?', message: 'Your workout history is kept.', confirmText: 'Delete', destructive: true })) {
                    await removeRoutine(routineId);
                    notifyDataChanged();
                    router.back();
                  }
                }}
              />
            </>
          ) : null}
        </ScrollView>
      ) : null}
      <ExercisePicker
        visible={picking}
        onClose={() => setPicking(false)}
        onPick={(ids) => setRows((rs) => [...rs, ...ids.map((id) => ({ ...defaultRoutineExercise(id), key: makeId('row') }))])}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, paddingBottom: 80 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center' },
  rowName: { flex: 1, color: colors.accent, fontSize: 17, fontWeight: '700' },
  menu: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  inputs: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  inputCol: { flex: 1 },
  inputLabel: { color: colors.textFaint, fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  restButton: { height: 44, borderRadius: radius.sm, backgroundColor: colors.input, alignItems: 'center', justifyContent: 'center' },
  restText: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
