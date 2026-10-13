import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { showActionSheet } from '@/components/ActionSheet';
import { confirm, notify } from '@/components/dialogs';
import { NumericInput } from '@/components/NumericInput';
import { Button, Card, Divider, ListItem, SectionTitle, Segmented, SwitchRow } from '@/components/ui';
import { seedDemoHistory } from '@/db/demo';
import { listReminders } from '@/db/reminders';
import { countWorkouts } from '@/db/workouts';
import { useData } from '@/hooks/useData';
import { connectHealth, healthSupport, syncPendingToHealth } from '@/services/health';
import { isExpoGo } from '@/services/runtime';
import { getStatus as getStravaStatus } from '@/services/strava';
import { getWatchStatus, watchBridgeAvailable } from '@/services/watch';
import { notifyDataChanged } from '@/state/dataVersion';
import { useSettings } from '@/state/settings';
import { colors, font, space } from '@/theme';

const BAR_WEIGHTS = [45, 35, 33, 25, 15];

function watchSubtitle(): string {
  const status = getWatchStatus();
  if (!status?.paired) return 'No paired Apple Watch';
  if (!status.watchAppInstalled) return 'Install IronLog from the Watch app on your iPhone';
  return status.reachable ? 'Connected · log sets and rest from your wrist' : 'Installed · opens with your workout';
}

export default function SettingsTab() {
  const { settings, update } = useSettings();
  const { data } = useData(async () => {
    const [workoutCount, reminders, strava] = await Promise.all([countWorkouts(), listReminders(), getStravaStatus()]);
    return { workoutCount, reminders, strava };
  });
  const workoutCount = data?.workoutCount;
  const activeReminders = data?.reminders.filter((r) => r.enabled).length ?? 0;
  const [seeding, setSeeding] = useState(false);
  const [syncingHealth, setSyncingHealth] = useState(false);
  const health = healthSupport();

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.scroll}>
      <SectionTitle>Connections</SectionTitle>
      <Card style={styles.group}>
        <ListItem
          icon="alarm-outline"
          title="Workout reminders"
          subtitle={activeReminders ? `${activeReminders} active` : 'Pick a routine, days and a time'}
          onPress={() => router.push('/reminders')}
          testID="open-reminders"
        />
        <Divider />
        <ListItem
          icon="walk-outline"
          iconColor={colors.strava}
          title="Strava"
          subtitle={data?.strava.connected ? `Connected${data.strava.athleteName ? ` as ${data.strava.athleteName}` : ''}` : 'Import your runs'}
          onPress={() => router.push('/strava')}
          testID="open-strava"
        />
      </Card>

      <SectionTitle>Apple Health</SectionTitle>
      <Card style={styles.group}>
        <SwitchRow
          icon="heart-outline"
          iconColor={colors.danger}
          title="Save workouts to Health"
          subtitle={
            health === 'expo-go'
              ? 'Needs a development build (HealthKit is not available in Expo Go)'
              : health === 'unsupported'
                ? 'Apple Health is not available on this device'
                : 'Strength workouts and manually logged runs'
          }
          value={settings.healthSync && health === 'available'}
          disabled={health !== 'available'}
          testID="setting-health"
          onChange={async (v) => {
            if (v && !(await connectHealth())) {
              notify('Apple Health', 'Allow IronLog to write workouts in the Health app: Profile → Apps → IronLog.');
            }
            await update({ healthSync: v });
          }}
        />
        {health === 'available' ? (
          <>
            <Divider />
            <View style={styles.inline}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inlineTitle}>Body weight (lb)</Text>
                <Text style={font.tiny}>Optional. Used to estimate active calories.</Text>
              </View>
              <NumericInput
                decimal
                value={settings.bodyWeightLbs}
                placeholder="—"
                onChange={(v) => void update({ bodyWeightLbs: v })}
                style={{ width: 90 }}
              />
            </View>
          </>
        ) : null}
      </Card>
      {settings.healthSync && health === 'available' ? (
        <Button
          title="Save past workouts to Health"
          icon="cloud-upload-outline"
          variant="secondary"
          loading={syncingHealth}
          style={{ marginTop: space.md }}
          onPress={async () => {
            setSyncingHealth(true);
            try {
              const r = await syncPendingToHealth();
              notifyDataChanged();
              notify('Apple Health', `Saved ${r.workouts} workout${r.workouts === 1 ? '' : 's'} and ${r.runs} run${r.runs === 1 ? '' : 's'}.`);
            } finally {
              setSyncingHealth(false);
            }
          }}
        />
      ) : null}

      <SectionTitle>Apple Watch</SectionTitle>
      <Card style={styles.group}>
        {watchBridgeAvailable() ? (
          <SwitchRow
            icon="watch-outline"
            title="IronLog on Apple Watch"
            subtitle={watchSubtitle()}
            value={settings.watchSync}
            onChange={(v) => void update({ watchSync: v })}
          />
        ) : (
          <ListItem
            icon="watch-outline"
            title="Apple Watch"
            subtitle={
              isExpoGo
                ? 'Rest-timer and reminder alerts show on your watch when the phone is locked. The watch app needs a development build.'
                : 'Rest-timer and reminder alerts show on your watch when the phone is locked.'
            }
          />
        )}
      </Card>

      <SectionTitle>Rest timer</SectionTitle>
      <Card style={styles.group}>
        <SwitchRow
          icon="play-circle-outline"
          title="Start automatically"
          subtitle="Begins when you check off a set"
          value={settings.autoStartRest}
          onChange={(v) => void update({ autoStartRest: v })}
          testID="setting-auto-rest"
        />
        <Divider />
        <SwitchRow icon="volume-high-outline" title="Sound" value={settings.restSound} onChange={(v) => void update({ restSound: v })} />
        <Divider />
        <SwitchRow icon="phone-portrait-outline" title="Vibration" value={settings.restVibrate} onChange={(v) => void update({ restVibrate: v })} />
      </Card>
      <Text style={styles.footnote}>
        Per-exercise rest lengths are set from each exercise's menu during a workout, in routines, or on the exercise page.
      </Text>

      <SectionTitle>Workout</SectionTitle>
      <Card style={styles.group}>
        <SwitchRow
          icon="sunny-outline"
          title="Keep screen awake"
          subtitle="During an active workout"
          value={settings.keepAwake}
          onChange={(v) => void update({ keepAwake: v })}
        />
        <Divider />
        <ListItem
          icon="barbell-outline"
          title="Barbell weight"
          subtitle="Used by the plate calculator and warm-up sets"
          right={<Text style={styles.value}>{settings.barWeight} lb</Text>}
          onPress={() =>
            showActionSheet({
              title: 'Barbell weight',
              options: BAR_WEIGHTS.map((w) => ({
                label: `${w} lb`,
                selected: w === settings.barWeight,
                onPress: () => void update({ barWeight: w }),
              })),
            })
          }
        />
      </Card>

      <SectionTitle>Units</SectionTitle>
      <Card>
        <Text style={[font.small, { marginBottom: space.sm }]}>Run distance</Text>
        <Segmented
          options={[
            { label: 'Miles', value: 'mi' },
            { label: 'Kilometers', value: 'km' },
          ]}
          value={settings.distanceUnit}
          onChange={(v) => void update({ distanceUnit: v })}
        />
        <Text style={[font.tiny, { marginTop: space.sm }]}>Weights are always in pounds.</Text>
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Card style={styles.group}>
        {workoutCount === 0 ? (
          <>
            <ListItem
              icon="flask-outline"
              title={seeding ? 'Loading sample history…' : 'Load sample history'}
              subtitle="10 weeks of Push/Pull/Legs so you can try charts and PRs"
              testID="load-sample-history"
              onPress={async () => {
                if (seeding) return;
                if (!(await confirm({ title: 'Load sample history?', message: 'Adds about 30 example workouts. You can delete them from History.', confirmText: 'Load' }))) return;
                setSeeding(true);
                try {
                  const n = await seedDemoHistory();
                  notifyDataChanged();
                  notify('Sample history loaded', `${n} workouts added.`);
                  router.navigate('/history');
                } finally {
                  setSeeding(false);
                }
              }}
            />
            <Divider />
          </>
        ) : null}
        <ListItem icon="lock-closed-outline" title="Stored on this phone only" subtitle="No account, no cloud. Everything lives in a local SQLite database." />
      </Card>

      <View style={{ height: space.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, paddingBottom: 120 },
  group: { padding: 0, overflow: 'hidden' },
  value: { color: colors.textDim, fontSize: 16, marginRight: space.xs },
  footnote: { ...font.tiny, marginTop: space.sm, paddingHorizontal: space.xs },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: colors.surface },
  inlineTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
