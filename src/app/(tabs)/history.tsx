import { router } from 'expo-router';
import { FlatList } from 'react-native';
import { listWorkouts } from '@/db';
import { useQuery } from '@/hooks';
import { fmtDate, fmtDuration, fmtVolume } from '@/logic/stats';
import { Muted, Row, s } from '@/ui';

export default function HistoryTab() {
  const workouts = useQuery(listWorkouts);
  return (
    <FlatList
      style={s.screen}
      contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 48 }}
      data={workouts}
      keyExtractor={(w) => String(w.id)}
      ListEmptyComponent={<Muted>Finished workouts show up here with duration, volume and every set.</Muted>}
      renderItem={({ item: w }) => (
        <Row
          title={w.name}
          subtitle={`${fmtDate(w.started_at)} · ${fmtDuration((w.ended_at ?? w.started_at) - w.started_at)}\n${w.set_count} sets · ${fmtVolume(w.volume)} lbs · ${w.exercise_names}`}
          onPress={() => router.push({ pathname: '/history/[id]', params: { id: String(w.id) } })}
        />
      )}
    />
  );
}
