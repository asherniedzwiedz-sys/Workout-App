import { router, Stack } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { notify } from '@/components/dialogs';
import { Button, Card, EmptyState } from '@/components/ui';
import { listReminders } from '@/db/reminders';
import { formatDate, formatTimeOfDay } from '@/domain/format';
import { describeWeekdays, nextOccurrence } from '@/domain/reminders';
import { useData } from '@/hooks/useData';
import { toggleReminder } from '@/services/reminders';
import { notifyDataChanged } from '@/state/dataVersion';
import { colors, font, space } from '@/theme';

export default function RemindersScreen() {
  const { data: reminders } = useData(listReminders);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.scroll}>
      <Stack.Screen options={{ title: 'Reminders' }} />
      <Text style={font.small}>
        Local notifications on the days and time you pick. They also show on a paired Apple Watch. No account or internet needed.
      </Text>
      {Platform.OS === 'web' ? (
        <Text style={[font.tiny, { marginTop: space.sm, color: colors.warning }]}>Notifications only fire on a phone.</Text>
      ) : null}

      {reminders && reminders.length === 0 ? (
        <EmptyState icon="alarm-outline" title="No reminders" body="Add one for each routine, or a single reminder for any workout." />
      ) : null}

      <View style={{ gap: space.md, marginTop: space.lg }}>
        {(reminders ?? []).map((r) => {
          const next = r.enabled ? nextOccurrence(r.weekdays, r.hour, r.minute, new Date()) : null;
          return (
            <Card key={r.id} testID={`reminder-${r.id}`}>
              <View style={styles.row}>
                <Pressable style={{ flex: 1 }} onPress={() => router.push(`/reminder/${r.id}`)} testID={`reminder-edit-${r.id}`}>
                  <Text style={[styles.time, !r.enabled && { color: colors.textFaint }]}>{formatTimeOfDay(r.hour, r.minute)}</Text>
                  <Text style={font.subheading}>{r.routineId ? (r.routineName ?? 'Deleted routine') : 'Any workout'}</Text>
                  <Text style={font.small}>{describeWeekdays(r.weekdays)}</Text>
                  {next ? <Text style={font.tiny}>Next: {formatDate(next.getTime())}</Text> : null}
                </Pressable>
                <Switch
                  value={r.enabled}
                  testID={`reminder-toggle-${r.id}`}
                  trackColor={{ true: colors.accent, false: colors.input }}
                  thumbColor="#fff"
                  ios_backgroundColor={colors.input}
                  onValueChange={async (enabled) => {
                    const { scheduled } = await toggleReminder(r.id, enabled);
                    notifyDataChanged();
                    if (enabled && !scheduled && Platform.OS !== 'web') {
                      notify('Notifications are off', 'Allow notifications for this app in iOS Settings to get reminders.');
                    }
                  }}
                />
              </View>
            </Card>
          );
        })}
      </View>

      <Button title="Add reminder" icon="add" size="lg" onPress={() => router.push('/reminder/new')} style={{ marginTop: space.xl }} testID="add-reminder" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, paddingBottom: 80 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  time: { color: colors.text, fontSize: 32, fontWeight: '800' },
});
