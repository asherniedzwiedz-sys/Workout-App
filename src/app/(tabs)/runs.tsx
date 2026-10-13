import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { WeeklyBars } from '@/components/charts';
import { notify } from '@/components/dialogs';
import { RunCard } from '@/components/RunCard';
import { Button, Card, EmptyState, SectionTitle, Stat } from '@/components/ui';
import { listRuns } from '@/db/runs';
import { formatDistance, formatPace, metersToUnit, startOfWeek } from '@/domain/format';
import { summarizeRuns } from '@/domain/runs';
import { weeklyBuckets } from '@/domain/stats';
import { useData } from '@/hooks/useData';
import { getStatus, StravaAuthError, syncRuns } from '@/services/strava';
import { notifyDataChanged } from '@/state/dataVersion';
import { useSettings } from '@/state/settings';
import { colors, font, space } from '@/theme';

const DAY = 86_400_000;

export default function RunsTab() {
  const unit = useSettings((s) => s.settings.distanceUnit);
  const [syncing, setSyncing] = useState(false);
  const { data } = useData(async () => {
    const [runs, strava] = await Promise.all([listRuns(), getStatus()]);
    return { runs, strava, now: Date.now() };
  });

  const header = useMemo(() => {
    if (!data) return null;
    const { runs, now } = data;
    const week = summarizeRuns(runs.filter((r) => r.startedAt >= startOfWeek(now)));
    const month = summarizeRuns(runs.filter((r) => r.startedAt >= now - 30 * DAY));
    const all = summarizeRuns(runs);
    const weekly = weeklyBuckets(runs, (r) => r.startedAt, (r) => metersToUnit(r.distanceM, unit), 12, now, startOfWeek);
    return (
      <View>
        <Card>
          <View style={styles.statsRow}>
            <Stat label="This week" value={formatDistance(week.distanceM, unit, 1)} />
            <Stat label="30 days" value={formatDistance(month.distanceM, unit, 1)} />
            <Stat label="30-day pace" value={formatPace(month.movingTimeSec, month.distanceM, unit).replace(` /${unit}`, '')} />
            <Stat label="Runs" value={String(all.count)} />
          </View>
        </Card>
        {runs.length > 0 ? (
          <>
            <SectionTitle>{`Distance per week (${unit})`}</SectionTitle>
            <Card>
              <WeeklyBars data={weekly} formatValue={(v) => v.toFixed(1)} testID="run-weekly-bars" />
            </Card>
            <View style={styles.bests}>
              <Card style={styles.best}>
                <Text style={font.tiny}>Longest run</Text>
                <Text style={styles.bestValue}>{all.longest ? formatDistance(all.longest.distanceM, unit, 2) : '—'}</Text>
              </Card>
              <Card style={styles.best}>
                <Text style={font.tiny}>Fastest pace (5 km+)</Text>
                <Text style={styles.bestValue}>
                  {all.fastest5k ? formatPace(all.fastest5k.movingTimeSec, all.fastest5k.distanceM, unit) : '—'}
                </Text>
              </Card>
            </View>
          </>
        ) : null}
        <View style={styles.actions}>
          <Button title="Log a run" icon="add" onPress={() => router.push('/run/new')} style={{ flex: 1 }} testID="log-run" />
          <Button
            title={data.strava.connected ? 'Sync Strava' : 'Connect Strava'}
            icon="sync"
            variant="secondary"
            loading={syncing}
            style={{ flex: 1 }}
            testID="sync-strava"
            onPress={async () => {
              if (!data.strava.connected) {
                router.push('/strava');
                return;
              }
              setSyncing(true);
              try {
                const result = await syncRuns();
                notifyDataChanged();
                notify('Strava synced', result.imported > 0 ? `Imported ${result.imported} new run${result.imported === 1 ? '' : 's'}.` : 'No new runs.');
              } catch (e) {
                notify(e instanceof StravaAuthError ? 'Strava connection' : 'Sync failed', e instanceof Error ? e.message : String(e));
              } finally {
                setSyncing(false);
              }
            }}
          />
        </View>
        {runs.length > 0 ? <SectionTitle>All runs</SectionTitle> : null}
      </View>
    );
  }, [data, unit, syncing]);

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}
      data={data?.runs ?? []}
      keyExtractor={(r) => String(r.id)}
      ListHeaderComponent={header}
      ListEmptyComponent={
        data ? (
          <EmptyState
            icon="walk-outline"
            title="No runs yet"
            body="Log a run by hand, or connect Strava to import your runs automatically."
          />
        ) : null
      }
      renderItem={({ item }) => <RunCard run={item} unit={unit} />}
      ListFooterComponent={
        data?.strava.connected ? (
          <View style={styles.footer}>
            <Text style={font.tiny}>
              Strava{data.strava.athleteName ? ` · ${data.strava.athleteName}` : ''} ·{' '}
              <Text style={{ color: colors.accent }} onPress={() => router.push('/strava')}>
                Manage
              </Text>
            </Text>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: space.sm },
  bests: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  best: { flex: 1, gap: 4 },
  bestValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  footer: { alignItems: 'center', paddingVertical: space.lg },
});
