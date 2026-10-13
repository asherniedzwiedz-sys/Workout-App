import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatClock } from '@/domain/format';
import { useNow } from '@/hooks/useNow';
import { useActiveWorkout } from '@/state/activeWorkout';
import { useRestTimer } from '@/state/restTimer';
import { colors, radius, space } from '@/theme';

/** Floating "workout in progress" pill shown above the tab bar (like Strong/Hevy). */
export function ActiveWorkoutBanner({ bottom }: { bottom: number }) {
  const workout = useActiveWorkout((s) => s.workout);
  const restEndsAt = useRestTimer((s) => s.endsAt);
  const now = useNow(1000, workout !== null);
  if (!workout) return null;
  const resting = restEndsAt !== null && restEndsAt > now;
  return (
    <Pressable
      testID="resume-workout-banner"
      onPress={() => router.push('/workout')}
      style={({ pressed }) => [styles.banner, { bottom, opacity: pressed ? 0.85 : 1 }]}
    >
      <Ionicons name="barbell" size={22} color="#fff" />
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>
          {workout.name}
        </Text>
        <Text style={styles.sub}>
          {formatClock((now - workout.startedAt) / 1000)}
          {resting ? ` · Rest ${formatClock(Math.ceil((restEndsAt - now) / 1000))}` : ''}
        </Text>
      </View>
      <Text style={styles.resume}>Resume</Text>
      <Ionicons name="chevron-up" size={20} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    height: 60,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  title: { color: '#fff', fontWeight: '800', fontSize: 16 },
  sub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontVariant: ['tabular-nums'] },
  resume: { color: '#fff', fontWeight: '700' },
});
