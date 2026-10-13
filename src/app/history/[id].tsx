import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text } from 'react-native';

import { Card } from '@/components/ui';
import { getWorkoutDetail } from '@/db/workouts';
import { formatSet } from '@/domain/format';
import { useData } from '@/hooks/useData';
import { colors, font, space } from '@/theme';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useData(() => getWorkoutDetail(Number(id)), [id]);
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, gap: space.md }}>
      <Stack.Screen options={{ title: data?.name ?? 'Workout' }} />
      {data?.exercises.map((e) => (
        <Card key={e.exerciseId}>
          <Text style={font.subheading}>{e.name}</Text>
          {e.sets.map((s) => (
            <Text key={s.id} style={font.small}>
              {formatSet(s.weight, s.reps)}
            </Text>
          ))}
        </Card>
      ))}
    </ScrollView>
  );
}
