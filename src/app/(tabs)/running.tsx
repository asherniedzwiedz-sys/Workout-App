import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { deleteRun, listRuns } from '@/db';
import { useQuery } from '@/hooks';
import { fmtDate, fmtDuration, fmtPace, METERS_PER_MILE } from '@/logic/stats';
import { importStravaRuns, stravaAthlete } from '@/strava';
import { C } from '@/theme';
import { Button, Card, Muted, Row, s } from '@/ui';

const miles = (m: number) => (m / METERS_PER_MILE).toFixed(2);

export default function RunningTab() {
  const runs = useQuery(listRuns);
  const [athlete, setAthlete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useFocusEffect(useCallback(() => void stravaAthlete().then(setAthlete), []));

  const weekStart = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  })();
  const week = runs.filter((r) => r.started_at >= weekStart);

  const sync = async () => {
    setBusy(true);
    try {
      const n = await importStravaRuns();
      Alert.alert('Strava', n ? `Imported ${n} run${n > 1 ? 's' : ''}.` : 'No new runs.');
    } catch (e) {
      Alert.alert('Strava import failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FlatList
      style={s.screen}
      contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 48 }}
      data={runs}
      keyExtractor={(r) => String(r.id)}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 4 }}>
          <Card>
            <Muted>This week</Muted>
            <Text style={{ color: C.text, fontSize: 26, fontWeight: '800' }}>
              {miles(week.reduce((m, r) => m + r.distance_m, 0))} mi <Text style={{ color: C.muted, fontSize: 16 }}>· {week.length} run{week.length === 1 ? '' : 's'}</Text>
            </Text>
          </Card>
          <Button title="Log a Run" icon="add" onPress={() => router.push('/log-run')} />
          {athlete
            ? <Button title={busy ? 'Importing…' : 'Import from Strava'} icon="cloud-download" variant="secondary" disabled={busy} onPress={sync} />
            : <Muted>Connect Strava in Settings to import runs automatically.</Muted>}
        </View>
      }
      ListEmptyComponent={<Muted>No runs yet.</Muted>}
      renderItem={({ item: r }) => (
        <Row
          title={`${miles(r.distance_m)} mi · ${fmtDuration(r.duration_s * 1000)}`}
          subtitle={`${r.name} · ${fmtDate(r.started_at)} · ${fmtPace(r.distance_m, r.duration_s)} · ${r.source === 'strava' ? 'Strava' : 'Manual'}`}
          icon={r.source === 'strava' ? 'cloud-done-outline' : 'create-outline'}
          onLongPress={() =>
            Alert.alert('Delete run?', r.source === 'strava' ? 'It will come back on the next Strava import if it is still recent.' : undefined, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteRun(r.id) },
            ])
          }
        />
      )}
    />
  );
}
