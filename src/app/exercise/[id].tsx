import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { useExercises } from '@/state/exercises';
import { colors } from '@/theme';

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = useExercises((s) => s.byId[id]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: exercise?.name ?? 'Exercise' }} />
    </View>
  );
}
