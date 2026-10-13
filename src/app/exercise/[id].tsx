import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { showActionSheet } from '@/components/ActionSheet';
import { LineChart } from '@/components/charts';
import { confirm } from '@/components/dialogs';
import { formatRest, REST_OPTIONS } from '@/components/RestTimer';
import { Badge, Button, Card, Chip, EmptyState, ListItem, SectionTitle, Segmented } from '@/components/ui';
import { deleteCustomExercise, setExerciseRest } from '@/db/exercises';
import { getExerciseSessions } from '@/db/workouts';
import { formatDate, formatSet, formatShortDate, formatVolume, formatWeight } from '@/domain/format';
import { computeRecords, type RecordSet } from '@/domain/records';
import { buildSeries, filterRange, METRIC_LABEL, metricsFor, type ExerciseMetric, type RangeKey } from '@/domain/stats';
import { PR_LABEL } from '@/domain/types';
import { useData } from '@/hooks/useData';
import { notifyDataChanged } from '@/state/dataVersion';
import { useExercises } from '@/state/exercises';
import { colors, font, space } from '@/theme';

type Tab = 'charts' | 'records' | 'history';
const RANGES: RangeKey[] = ['1M', '3M', '6M', '1Y', 'ALL'];

function metricFormatter(metric: ExerciseMetric) {
  return (v: number) => (metric === 'bestReps' ? `${Math.round(v)} reps` : `${formatWeight(Math.round(v))} lb`);
}

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = useExercises((s) => s.byId[id]);
  const { data: sessions } = useData(() => getExerciseSessions(id), [id]);
  const [tab, setTab] = useState<Tab>('charts');
  const [metric, setMetric] = useState<ExerciseMetric | null>(null);
  const [range, setRange] = useState<RangeKey>('ALL');

  const metrics = useMemo(() => metricsFor(sessions ?? []), [sessions]);
  const activeMetric = metric && metrics.includes(metric) ? metric : (metrics[0] ?? 'e1rm');
  const series = useMemo(
    () => filterRange(buildSeries(sessions ?? [], activeMetric), range, Date.now()),
    [sessions, activeMetric, range],
  );
  const records = useMemo(() => {
    const flat: RecordSet[] = (sessions ?? []).flatMap((s) =>
      s.sets.map((set) => ({ key: set.id, workoutId: s.workoutId, completedAt: s.startedAt, type: set.type, weight: set.weight, reps: set.reps })),
    );
    return computeRecords(flat);
  }, [sessions]);

  if (!exercise) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ title: 'Exercise' }} />
        <EmptyState icon="alert-circle-outline" title="Exercise not found" />
      </View>
    );
  }

  const fmt = metricFormatter(activeMetric);
  const best = series.reduce((m, p) => Math.max(m, p.y), 0);

  const pickRest = () =>
    showActionSheet({
      title: `Default rest for ${exercise.name}`,
      message: 'Used when you add this exercise to a workout or routine.',
      options: REST_OPTIONS.map((sec) => ({
        label: formatRest(sec),
        selected: sec === exercise.defaultRestSec,
        onPress: async () => {
          await setExerciseRest(exercise.id, sec);
          await useExercises.getState().load();
        },
      })),
    });

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.scroll}>
      <Stack.Screen options={{ title: '' }} />
      <Text style={font.title}>{exercise.name}</Text>
      <Text style={styles.subtitle}>
        {exercise.primaryMuscle}
        {exercise.secondaryMuscles.length ? ` · also ${exercise.secondaryMuscles.join(', ')}` : ''} · {exercise.equipment}
      </Text>

      <View style={{ marginTop: space.lg }}>
        <Segmented
          options={[
            { label: 'Charts', value: 'charts' },
            { label: 'Records', value: 'records' },
            { label: 'History', value: 'history' },
          ]}
          value={tab}
          onChange={setTab}
          testIDPrefix="exercise-tab"
        />
      </View>

      {sessions && sessions.length === 0 ? (
        <EmptyState icon="stats-chart-outline" title="No history yet" body="Log this exercise in a workout to see charts and records." />
      ) : null}

      {tab === 'charts' && sessions && sessions.length > 0 ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
            {metrics.map((m) => (
              <Chip key={m} label={METRIC_LABEL[m]} selected={m === activeMetric} onPress={() => setMetric(m)} testID={`metric-${m}`} />
            ))}
          </ScrollView>
          <View style={styles.ranges}>
            {RANGES.map((r) => (
              <Chip key={r} label={r === 'ALL' ? 'All' : r} selected={r === range} onPress={() => setRange(r)} />
            ))}
          </View>
          <Card style={{ marginTop: space.md }}>
            <Text style={font.subheading}>{METRIC_LABEL[activeMetric]}</Text>
            {series.length > 0 ? (
              <LineChart
                points={series}
                formatValue={fmt}
                testID="exercise-chart"
                accessibilityLabel={`${METRIC_LABEL[activeMetric]} over ${series.length} sessions. Best ${fmt(best)}.`}
              />
            ) : (
              <Text style={[font.small, { marginTop: space.md }]}>No sessions in this range.</Text>
            )}
          </Card>
          <Text style={[font.tiny, { marginTop: space.sm }]}>
            {series.length} sessions · best {fmt(best)} · estimated 1RM uses the Epley formula. Drag across the chart to inspect a session.
          </Text>
        </>
      ) : null}

      {tab === 'records' && sessions && sessions.length > 0 ? (
        <>
          <View style={styles.recordGrid}>
            <RecordTile label={PR_LABEL.e1rm} value={records.bestE1rm ? `${formatWeight(Math.round(records.bestE1rm.value))} lb` : '—'} detail={records.bestE1rm ? `${formatSet(records.bestE1rm.weight, records.bestE1rm.reps)} · ${formatShortDate(records.bestE1rm.at)}` : ''} />
            <RecordTile label={PR_LABEL.weight} value={records.heaviest ? `${formatWeight(records.heaviest.weight)} lb` : '—'} detail={records.heaviest ? `× ${records.heaviest.reps} · ${formatShortDate(records.heaviest.at)}` : ''} />
            <RecordTile label={PR_LABEL.volume} value={records.bestVolumeSet ? formatVolume(records.bestVolumeSet.value) : '—'} detail={records.bestVolumeSet ? `${formatSet(records.bestVolumeSet.weight, records.bestVolumeSet.reps)}` : ''} />
            <RecordTile label={PR_LABEL.reps} value={records.mostReps ? `${records.mostReps.reps}` : '—'} detail={records.mostReps ? `${records.mostReps.weight > 0 ? `at ${formatWeight(records.mostReps.weight)} lb · ` : ''}${formatShortDate(records.mostReps.at)}` : ''} />
          </View>
          {records.repRecords.length > 0 ? (
            <>
              <SectionTitle>Best weight by reps</SectionTitle>
              <Card style={{ paddingVertical: space.sm }} testID="rep-records">
                <View style={styles.tableHeader}>
                  <Text style={[styles.th, { flex: 1 }]}>REPS</Text>
                  <Text style={[styles.th, { flex: 2 }]}>WEIGHT</Text>
                  <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>DATE</Text>
                </View>
                {records.repRecords.map((r) => (
                  <View key={r.reps} style={styles.tr}>
                    <Text style={[styles.td, { flex: 1 }]}>{r.reps}</Text>
                    <Text style={[styles.td, { flex: 2, fontWeight: '700' }]}>{formatWeight(r.weight)} lb</Text>
                    <Text style={[styles.tdDim, { flex: 2, textAlign: 'right' }]}>{formatShortDate(r.at)}</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </>
      ) : null}

      {tab === 'history' && sessions && sessions.length > 0 ? (
        <View style={{ gap: space.md, marginTop: space.lg }}>
          {sessions.map((s) => (
            <Card key={s.workoutId} onPress={() => router.push(`/history/${s.workoutId}`)}>
              <Text style={font.subheading}>{s.workoutName}</Text>
              <Text style={[font.small, { marginBottom: space.sm }]}>{formatDate(s.startedAt)}</Text>
              {s.sets.map((set) => (
                <View key={set.id} style={styles.histRow}>
                  <Text style={[styles.td, set.type === 'warmup' && { color: colors.warning }]}>
                    {set.type === 'warmup' ? 'W  ' : ''}
                    {formatSet(set.weight, set.reps)}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {set.prs.map((k) => (
                      <Badge key={k} icon="trophy" label={PR_LABEL[k]} />
                    ))}
                  </View>
                </View>
              ))}
            </Card>
          ))}
        </View>
      ) : null}

      <SectionTitle>Settings</SectionTitle>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <ListItem icon="timer-outline" title="Default rest timer" right={<Text style={styles.value}>{formatRest(exercise.defaultRestSec)}</Text>} onPress={pickRest} />
      </Card>
      {exercise.isCustom ? (
        <Button
          title="Delete custom exercise"
          variant="danger"
          style={{ marginTop: space.lg }}
          onPress={async () => {
            if (!(await confirm({ title: `Delete ${exercise.name}?`, message: 'If it appears in history it is hidden instead, so old workouts keep their names.', confirmText: 'Delete', destructive: true }))) return;
            await deleteCustomExercise(exercise.id);
            await useExercises.getState().load();
            notifyDataChanged();
            router.back();
          }}
        />
      ) : null}
    </ScrollView>
  );
}

function RecordTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card style={styles.tile}>
      <Text style={font.tiny}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={font.tiny} numberOfLines={1}>
        {detail}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, paddingBottom: 80 },
  subtitle: { ...font.small, marginTop: 4, textTransform: 'capitalize' },
  chips: { gap: space.sm, paddingTop: space.lg },
  ranges: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  recordGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.lg },
  tile: { width: '47%', flexGrow: 1, gap: 4 },
  tileValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  tableHeader: { flexDirection: 'row', paddingBottom: space.xs },
  th: { color: colors.textFaint, fontSize: 11, fontWeight: '700' },
  tr: { flexDirection: 'row', paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  td: { color: colors.text, fontSize: 15, fontVariant: ['tabular-nums'] },
  tdDim: { color: colors.textDim, fontSize: 14 },
  histRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 28 },
  value: { color: colors.textDim, fontSize: 16, marginRight: space.xs },
});
