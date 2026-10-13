import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { RankedBars, WeeklyBars } from '@/components/charts';
import { Badge, Card, EmptyState, SectionTitle, Stat } from '@/components/ui';
import { getMuscleSetCounts, getWorkoutStartTimes, listWorkoutSummaries } from '@/db/workouts';
import { formatDate, formatDuration, formatMonth, formatVolume, startOfWeek } from '@/domain/format';
import { weekStreak, weeklyBuckets } from '@/domain/stats';
import type { WorkoutSummary } from '@/domain/types';
import { useData } from '@/hooks/useData';
import { colors, font, space } from '@/theme';

type Row = { kind: 'month'; key: string; label: string } | { kind: 'workout'; key: string; workout: WorkoutSummary };

const DAY = 86_400_000;

export default function HistoryTab() {
  const { data } = useData(async () => {
    const now = Date.now();
    const [workouts, times, muscles] = await Promise.all([
      listWorkoutSummaries(500),
      getWorkoutStartTimes(now - 365 * DAY),
      getMuscleSetCounts(now - 30 * DAY),
    ]);
    return { workouts, times, muscles, now };
  });

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let month = '';
    for (const w of data?.workouts ?? []) {
      const label = formatMonth(w.startedAt);
      if (label !== month) {
        month = label;
        out.push({ kind: 'month', key: `m-${label}`, label });
      }
      out.push({ kind: 'workout', key: `w-${w.id}`, workout: w });
    }
    return out;
  }, [data?.workouts]);

  const header = useMemo(() => {
    if (!data) return null;
    const { now, times, workouts } = data;
    const weekStart = startOfWeek(now);
    const thisWeek = workouts.filter((w) => w.startedAt >= weekStart);
    const weekly = weeklyBuckets(times, (t) => t, () => 1, 12, now, startOfWeek);
    return (
      <View>
        <Card>
          <View style={styles.statsRow}>
            <Stat label="This week" value={String(thisWeek.length)} />
            <Stat label="Week volume" value={formatVolume(thisWeek.reduce((s, w) => s + w.totalVolume, 0))} />
            <Stat label="Week streak" value={String(weekStreak(times, now, startOfWeek))} />
            <Stat label="All time" value={String(workouts.length)} />
          </View>
        </Card>
        {workouts.length > 0 ? (
          <>
            <SectionTitle>Workouts per week</SectionTitle>
            <Card>
              <WeeklyBars data={weekly} formatValue={(v) => String(v)} testID="weekly-bars" />
            </Card>
          </>
        ) : null}
        {data.muscles.length > 0 ? (
          <>
            <SectionTitle>Working sets by muscle · 30 days</SectionTitle>
            <Card>
              <RankedBars rows={data.muscles.slice(0, 8).map((m) => ({ label: m.muscle, value: m.sets }))} formatValue={(v) => String(v)} />
            </Card>
          </>
        ) : null}
      </View>
    );
  }, [data]);

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}
      data={rows}
      keyExtractor={(r) => r.key}
      ListHeaderComponent={header}
      ListEmptyComponent={
        data ? (
          <EmptyState icon="calendar-outline" title="No workouts yet" body="Finished workouts show up here with volume, duration and PRs." />
        ) : null
      }
      renderItem={({ item }) =>
        item.kind === 'month' ? <SectionTitle>{item.label}</SectionTitle> : <WorkoutCard workout={item.workout} />
      }
    />
  );
}

function WorkoutCard({ workout }: { workout: WorkoutSummary }) {
  return (
    <Card onPress={() => router.push(`/history/${workout.id}`)} style={{ marginBottom: space.md }} testID={`history-${workout.id}`}>
      <View style={styles.cardHeader}>
        <Text style={[font.subheading, { flex: 1 }]} numberOfLines={1}>
          {workout.name}
        </Text>
        {workout.prCount > 0 ? <Badge icon="trophy" label={`${workout.prCount} PR${workout.prCount === 1 ? '' : 's'}`} /> : null}
      </View>
      <Text style={styles.meta}>{formatDate(workout.startedAt)}</Text>
      <View style={styles.metaRow}>
        <Meta icon="time-outline" text={formatDuration(workout.durationSec)} />
        <Meta icon="barbell-outline" text={formatVolume(workout.totalVolume)} />
        <Meta icon="checkmark-done-outline" text={`${workout.totalSets} sets`} />
      </View>
      <View style={styles.lines}>
        {workout.exerciseLines.slice(0, 6).map((l, i) => (
          <View key={`${l.name}-${i}`} style={styles.line}>
            <Text style={styles.lineName} numberOfLines={1}>
              {l.sets} × {l.name}
            </Text>
            <Text style={styles.lineBest}>{l.best}</Text>
          </View>
        ))}
        {workout.exerciseLines.length > 6 ? <Text style={font.tiny}>+{workout.exerciseLines.length - 6} more</Text> : null}
      </View>
    </Card>
  );
}

function Meta({ icon, text }: { icon: 'time-outline' | 'barbell-outline' | 'checkmark-done-outline'; text: string }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={14} color={colors.textFaint} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: space.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  meta: { ...font.small, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: space.lg, marginTop: space.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: colors.textDim, fontSize: 13 },
  lines: { marginTop: space.md, gap: 4 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  lineName: { color: colors.text, fontSize: 14, flex: 1 },
  lineBest: { color: colors.textDim, fontSize: 14 },
});
