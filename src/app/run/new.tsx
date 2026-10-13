import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DateTimeField } from '@/components/DateTimeField';
import { notify } from '@/components/dialogs';
import { NumericInput } from '@/components/NumericInput';
import { Button, Card, Field } from '@/components/ui';
import { addManualRun, getRun, updateManualRun } from '@/db/runs';
import { formatPace, metersToUnit, unitToMeters } from '@/domain/format';
import { validateManualRun } from '@/domain/runs';
import { syncRunToHealth } from '@/services/health';
import { notifyDataChanged } from '@/state/dataVersion';
import { useSettings } from '@/state/settings';
import { colors, font, space } from '@/theme';

/** Manual run entry. `/run/new?id=5` edits an existing manual run. */
export default function NewRunScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;
  const unit = useSettings((s) => s.settings.distanceUnit);
  const [name, setName] = useState('Run');
  const [date, setDate] = useState(() => new Date());
  const [distance, setDistance] = useState<number | null>(null);
  const [hours, setHours] = useState<number | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingId === null) return;
    void getRun(editingId).then((run) => {
      if (!run) return;
      setName(run.name);
      setDate(new Date(run.startedAt));
      setDistance(Math.round(metersToUnit(run.distanceM, unit) * 100) / 100);
      setHours(Math.floor(run.movingTimeSec / 3600) || null);
      setMinutes(Math.floor((run.movingTimeSec % 3600) / 60));
      setSeconds(run.movingTimeSec % 60);
      setNotes(run.notes ?? '');
    });
  }, [editingId, unit]);

  const totalSec = (hours ?? 0) * 3600 + (minutes ?? 0) * 60 + (seconds ?? 0);
  const meters = distance ? unitToMeters(distance, unit) : 0;

  const save = async () => {
    const error = validateManualRun(meters, totalSec);
    if (error) {
      notify('Check your run', error);
      return;
    }
    setSaving(true);
    try {
      const input = {
        name,
        startedAt: date.getTime(),
        distanceM: meters,
        movingTimeSec: totalSec,
        elapsedTimeSec: totalSec,
        elevationGainM: null,
        avgHeartrate: null,
        sportType: 'Run',
        notes,
      };
      if (editingId !== null) {
        await updateManualRun(editingId, input);
      } else {
        const runId = await addManualRun(input);
        void syncRunToHealth(runId);
      }
      notifyDataChanged();
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: editingId !== null ? 'Edit run' : 'Log a run' }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Field label="Name" value={name} onChangeText={setName} testID="run-name" />
        <View style={{ marginTop: space.lg }}>
          <DateTimeField label="When" value={date} onChange={setDate} />
        </View>

        <Text style={styles.label}>Distance ({unit})</Text>
        <NumericInput decimal value={distance} placeholder={unit === 'mi' ? '3.1' : '5.0'} onChange={setDistance} style={styles.big} testID="run-distance" />

        <Text style={styles.label}>Time</Text>
        <View style={styles.timeRow}>
          <View style={styles.timeCol}>
            <NumericInput value={hours} placeholder="0" onChange={setHours} style={styles.big} testID="run-hours" />
            <Text style={styles.unit}>hr</Text>
          </View>
          <View style={styles.timeCol}>
            <NumericInput value={minutes} placeholder="25" onChange={(v) => setMinutes(v === null ? null : Math.min(59, v))} style={styles.big} testID="run-minutes" />
            <Text style={styles.unit}>min</Text>
          </View>
          <View style={styles.timeCol}>
            <NumericInput value={seconds} placeholder="00" onChange={(v) => setSeconds(v === null ? null : Math.min(59, v))} style={styles.big} testID="run-seconds" />
            <Text style={styles.unit}>sec</Text>
          </View>
        </View>

        <Card style={styles.pace}>
          <Text style={font.small}>Pace</Text>
          <Text style={styles.paceValue} testID="run-pace">
            {formatPace(totalSec, meters, unit)}
          </Text>
        </Card>

        <Field
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Route, weather, how it felt"
          multiline
          style={{ marginTop: space.lg }}
          inputStyle={{ height: 80, paddingTop: space.sm }}
        />

        <Button title="Save run" icon="checkmark" variant="success" size="lg" onPress={save} loading={saving} style={{ marginTop: space.xl }} testID="save-run" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, paddingBottom: 80 },
  label: { color: colors.textDim, fontSize: 14, fontWeight: '600', marginTop: space.lg, marginBottom: space.xs },
  big: { height: 56, fontSize: 24 },
  timeRow: { flexDirection: 'row', gap: space.md },
  timeCol: { flex: 1, alignItems: 'stretch' },
  unit: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: 4 },
  pace: { marginTop: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paceValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
});
