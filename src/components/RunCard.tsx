import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { formatClock, formatDate, formatDistance, formatPace, type DistanceUnit } from '@/domain/format';
import type { Run } from '@/domain/types';
import { colors, font, radius, space } from '@/theme';

import { Card } from './ui';

export function RunCard({ run, unit }: { run: Run; unit: DistanceUnit }) {
  return (
    <Card onPress={() => router.push(`/run/${run.id}`)} style={{ marginBottom: space.md }} testID={`run-${run.id}`}>
      <View style={styles.header}>
        <View style={[styles.icon, run.source === 'strava' && { backgroundColor: 'rgba(252,76,2,0.15)' }]}>
          <Ionicons name="walk" size={20} color={run.source === 'strava' ? colors.strava : colors.success} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={font.subheading} numberOfLines={1}>
            {run.name}
          </Text>
          <Text style={font.small}>
            {formatDate(run.startedAt)} · {run.source === 'strava' ? 'Strava' : 'Manual'}
            {run.sportType !== 'Run' ? ` · ${run.sportType.replace(/([a-z])([A-Z])/g, '$1 $2')}` : ''}
          </Text>
        </View>
      </View>
      <View style={styles.stats}>
        <Text style={styles.stat}>{formatDistance(run.distanceM, unit)}</Text>
        <Text style={styles.stat}>{formatClock(run.movingTimeSec)}</Text>
        <Text style={styles.stat}>{formatPace(run.movingTimeSec, run.distanceM, unit)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.successDim, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md },
  stat: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
