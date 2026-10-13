import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { confirm, notify } from '@/components/dialogs';
import { TimeField } from '@/components/TimeField';
import { Button, Card, Divider, ListItem, SectionTitle } from '@/components/ui';
import { getReminder } from '@/db/reminders';
import { listRoutines } from '@/db/routines';
import { describeWeekdays } from '@/domain/reminders';
import { useData } from '@/hooks/useData';
import { removeReminder, upsertReminder } from '@/services/reminders';
import { notifyDataChanged } from '@/state/dataVersion';
import { colors, radius, space } from '@/theme';

// Monday-first, matching how training weeks read. Values are JS weekdays (0 = Sunday).
const WEEK = [
  { day: 1, label: 'M' },
  { day: 2, label: 'T' },
  { day: 3, label: 'W' },
  { day: 4, label: 'T' },
  { day: 5, label: 'F' },
  { day: 6, label: 'S' },
  { day: 0, label: 'S' },
];

export default function ReminderEditor() {
  const { id, routineId: routineParam } = useLocalSearchParams<{ id: string; routineId?: string }>();
  const isNew = id === 'new';
  const { data: routines } = useData(listRoutines);
  const [routineId, setRoutineId] = useState<number | null>(routineParam ? Number(routineParam) : null);
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [hour, setHour] = useState(18);
  const [minute, setMinute] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    void getReminder(Number(id)).then((r) => {
      if (!r) return;
      setRoutineId(r.routineId);
      setWeekdays(r.weekdays);
      setHour(r.hour);
      setMinute(r.minute);
      setEnabled(r.enabled);
    });
  }, [id, isNew]);

  const toggleDay = (day: number) =>
    setWeekdays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day]));

  const save = async () => {
    if (weekdays.length === 0) {
      notify('Pick at least one day');
      return;
    }
    setSaving(true);
    try {
      const { scheduled } = await upsertReminder({
        id: isNew ? undefined : Number(id),
        routineId,
        weekdays,
        hour,
        minute,
        enabled,
      });
      notifyDataChanged();
      if (enabled && !scheduled && Platform.OS !== 'web') {
        notify('Saved, but notifications are off', 'Allow notifications for this app in iOS Settings so the reminder can fire.');
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.scroll}>
      <Stack.Screen
        options={{
          title: isNew ? 'New reminder' : 'Edit reminder',
          headerRight: () => <Button title="Save" variant="ghost" size="sm" loading={saving} onPress={save} testID="save-reminder" />,
        }}
      />

      <SectionTitle>Time</SectionTitle>
      <TimeField
        hour={hour}
        minute={minute}
        onChange={(h, m) => {
          setHour(h);
          setMinute(m);
        }}
      />

      <SectionTitle right={<Text style={styles.summary}>{describeWeekdays(weekdays)}</Text>}>Days</SectionTitle>
      <View style={styles.days}>
        {WEEK.map(({ day, label }) => {
          const selected = weekdays.includes(day);
          return (
            <Pressable
              key={day}
              onPress={() => toggleDay(day)}
              style={[styles.day, selected && styles.daySelected]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              testID={`reminder-day-${day}`}
            >
              <Text style={[styles.dayText, selected && { color: '#fff' }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>Routine</SectionTitle>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <ListItem
          title="Any workout"
          subtitle="A general nudge to train"
          onPress={() => setRoutineId(null)}
          right={routineId === null ? <Text style={styles.check}>✓</Text> : <View />}
          testID="reminder-routine-any"
        />
        {(routines ?? []).map((r) => (
          <View key={r.id}>
            <Divider />
            <ListItem
              title={r.name}
              subtitle={`${r.exercises.length} exercises`}
              onPress={() => setRoutineId(r.id)}
              right={routineId === r.id ? <Text style={styles.check}>✓</Text> : <View />}
              testID={`reminder-routine-${r.id}`}
            />
          </View>
        ))}
      </Card>

      {!isNew ? (
        <Button
          title="Delete reminder"
          variant="danger"
          style={{ marginTop: space.xl }}
          onPress={async () => {
            if (!(await confirm({ title: 'Delete reminder?', confirmText: 'Delete', destructive: true }))) return;
            await removeReminder(Number(id));
            notifyDataChanged();
            router.back();
          }}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, paddingBottom: 80 },
  summary: { color: colors.textDim, fontSize: 13 },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayText: { color: colors.textDim, fontWeight: '800', fontSize: 16 },
  check: { color: colors.accent, fontSize: 20, fontWeight: '800' },
});
