import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { confirm } from '@/components/dialogs';
import { Button, Card, EmptyState, Stat } from '@/components/ui';
import { deleteRun, getRun } from '@/db/runs';
import { formatClock, formatDateLong, formatDistance, formatPace, formatTimeOfDay } from '@/domain/format';
import { useData } from '@/hooks/useData';
import { notifyDataChanged } from '@/state/dataVersion';
import { useSettings } from '@/state/settings';
import { colors, font, space } from '@/theme';

export default function RunDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const unit = useSettings((s) => s.settings.distanceUnit);
  const { data: run, loading } = useData(() => getRun(Number(id)), [id]);

  if (!run) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ title: 'Run' }} />
        {!loading ? <EmptyState icon="alert-circle-outline" title="Run not found" /> : null}
      </View>
    );
  }

  const started = new Date(run.startedAt);
  const elevation = run.elevationGainM !== null ? (unit === 'mi' ? `${Math.round(run.elevationGainM * 3.28084)} ft` : `${Math.round(run.elevationGainM)} m`) : '—';

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.scroll}>
      <Stack.Screen options={{ title: 'Run' }} />
      <Text style={font.title}>{run.name}</Text>
      <Text style={[font.small, { marginTop: 2 }]}>
        {formatDateLong(run.startedAt)} · {formatTimeOfDay(started.getHours(), started.getMinutes())}
      </Text>

      <Card style={{ marginTop: space.lg, gap: space.lg }}>
        <View style={styles.row}>
          <Stat label="Distance" value={formatDistance(run.distanceM, unit)} />
          <Stat label="Moving time" value={formatClock(run.movingTimeSec)} />
        </View>
        <View style={styles.row}>
          <Stat label="Pace" value={formatPace(run.movingTimeSec, run.distanceM, unit)} />
          <Stat label="Elevation" value={elevation} />
        </View>
        {run.avgHeartrate || run.elapsedTimeSec !== run.movingTimeSec ? (
          <View style={styles.row}>
            <Stat label="Avg heart rate" value={run.avgHeartrate ? `${Math.round(run.avgHeartrate)} bpm` : '—'} />
            <Stat label="Elapsed" value={formatClock(run.elapsedTimeSec)} />
          </View>
        ) : null}
      </Card>

      {run.notes ? <Text style={[font.body, { marginTop: space.lg }]}>{run.notes}</Text> : null}

      <View style={styles.source}>
        <Ionicons name={run.source === 'strava' ? 'cloud-download-outline' : 'create-outline'} size={16} color={colors.textFaint} />
        <Text style={font.tiny}>{run.source === 'strava' ? 'Imported from Strava' : 'Logged by hand'}</Text>
      </View>

      <View style={{ gap: space.md, marginTop: space.lg }}>
        {run.source === 'strava' && run.externalId ? (
          <Button
            title="View on Strava"
            icon="open-outline"
            variant="secondary"
            onPress={() => void Linking.openURL(`https://www.strava.com/activities/${run.externalId}`)}
          />
        ) : (
          <Button title="Edit run" icon="create-outline" variant="secondary" onPress={() => router.push(`/run/new?id=${run.id}`)} />
        )}
        <Button
          title="Delete run"
          variant="danger"
          testID="delete-run"
          onPress={async () => {
            const message = run.source === 'strava' ? 'A full re-sync from Strava would import it again.' : undefined;
            if (!(await confirm({ title: 'Delete this run?', message, confirmText: 'Delete', destructive: true }))) return;
            await deleteRun(run.id);
            notifyDataChanged();
            router.back();
          }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, paddingBottom: 80 },
  row: { flexDirection: 'row', gap: space.lg },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.lg },
});
