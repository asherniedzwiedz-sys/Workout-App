import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { deleteReminder, listReminders, listRoutines, type Reminder } from '@/db';
import { useQuery } from '@/hooks';
import { removeReminder, saveAndSchedule, WEEKDAY_LABELS } from '@/reminders';
import { C } from '@/theme';
import { Button, Card, Chip, H, Muted, Screen, Stepper } from '@/ui';

const fmtTime = (h: number, m: number) => `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
const dayNames = (w: string) => w.split(',').filter(Boolean).map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][Number(d) - 1]).join(' ');

type Draft = { id?: number; routine_id: number | null; days: number[]; hour: number; minute: number; enabled: number; notif_ids?: string };
const blank: Draft = { routine_id: null, days: [2, 4, 6], hour: 18, minute: 0, enabled: 1 };

export default function Reminders() {
  const reminders = useQuery(listReminders);
  const routines = useQuery(listRoutines);
  const [draft, setDraft] = useState<Draft | null>(null);

  const persist = async (d: Draft) => {
    try {
      await saveAndSchedule({ id: d.id, routine_id: d.routine_id, weekdays: [...d.days].sort((a, b) => a - b).join(','), hour: d.hour, minute: d.minute, enabled: d.enabled, notif_ids: d.notif_ids });
      setDraft(null);
    } catch (e) {
      Alert.alert('Could not schedule', (e as Error).message);
    }
  };
  const edit = (r: Reminder) => setDraft({ id: r.id, routine_id: r.routine_id, days: r.weekdays.split(',').map(Number), hour: r.hour, minute: r.minute, enabled: r.enabled, notif_ids: r.notif_ids });

  return (
    <>
      <Stack.Screen options={{ title: 'Reminders' }} />
      <Screen>
        {reminders.length === 0 && !draft && <Muted>Local notifications on the days and time you pick. Nothing leaves your phone.</Muted>}
        {reminders.map((r) => (
          <Card key={r.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 20, fontWeight: '800' }} onPress={() => edit(r)}>{fmtTime(r.hour, r.minute)}</Text>
              <Muted>{r.routine_name ?? 'Any workout'} · {dayNames(r.weekdays)}</Muted>
            </View>
            <Switch
              value={!!r.enabled}
              onValueChange={(on) => void persist({ id: r.id, routine_id: r.routine_id, days: r.weekdays.split(',').map(Number), hour: r.hour, minute: r.minute, enabled: on ? 1 : 0, notif_ids: r.notif_ids })}
            />
          </Card>
        ))}
        {!draft && <Button title="Add Reminder" icon="alarm" onPress={() => setDraft(blank)} />}
        {draft && (
          <Card>
            <H>{draft.id ? 'Edit reminder' : 'New reminder'}</H>
            <Muted>Routine</Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Chip label="Any workout" active={draft.routine_id === null} onPress={() => setDraft({ ...draft, routine_id: null })} />
              {routines.map((r) => <Chip key={r.id} label={r.name} active={draft.routine_id === r.id} onPress={() => setDraft({ ...draft, routine_id: r.id })} />)}
            </View>
            <Muted>Days</Muted>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {WEEKDAY_LABELS.map((l, i) => {
                const day = i + 1;
                const on = draft.days.includes(day);
                return <Chip key={day} label={l} active={on} onPress={() => setDraft({ ...draft, days: on ? draft.days.filter((d) => d !== day) : [...draft.days, day] })} />;
              })}
            </View>
            <Muted>Time · {fmtTime(draft.hour, draft.minute)}</Muted>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Stepper value={draft.hour} label="h" onChange={(h) => setDraft({ ...draft, hour: (h + 24) % 24 })} min={-1} />
              <Stepper value={draft.minute} step={5} label="m" onChange={(m) => setDraft({ ...draft, minute: (m + 60) % 60 })} min={-5} />
            </View>
            <Button title="Save" disabled={!draft.days.length} onPress={() => void persist(draft)} />
            {draft.id && (
              <Button
                title="Delete"
                variant="ghost"
                onPress={() => {
                  const r = reminders.find((x) => x.id === draft.id);
                  if (r) void removeReminder(r, deleteReminder).then(() => setDraft(null));
                }}
              />
            )}
            <Button title="Cancel" variant="secondary" onPress={() => setDraft(null)} />
          </Card>
        )}
      </Screen>
    </>
  );
}
