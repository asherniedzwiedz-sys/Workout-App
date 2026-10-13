import { router } from 'expo-router';
import { FlatList, Text, View } from 'react-native';

import { Card, EmptyState } from '@/components/ui';
import { listWorkoutSummaries } from '@/db/workouts';
import { formatDate, formatDuration, formatVolume } from '@/domain/format';
import { useData } from '@/hooks/useData';
import { colors, font, space } from '@/theme';

export default function HistoryTab() {
  const { data } = useData(() => listWorkoutSummaries(100));
  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 120 }}
      data={data ?? []}
      keyExtractor={(w) => String(w.id)}
      ListEmptyComponent={data ? <EmptyState icon="calendar-outline" title="No workouts yet" /> : null}
      renderItem={({ item }) => (
        <Card onPress={() => router.push(`/history/${item.id}`)}>
          <Text style={font.subheading}>{item.name}</Text>
          <Text style={font.small}>
            {formatDate(item.startedAt)} · {formatDuration(item.durationSec)} · {formatVolume(item.totalVolume)}
          </Text>
          <View style={{ marginTop: space.sm }}>
            {item.exerciseLines.map((l) => (
              <Text key={l.name} style={font.small}>
                {l.sets} × {l.name}
              </Text>
            ))}
          </View>
        </Card>
      )}
    />
  );
}
