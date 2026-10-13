import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { showActionSheet } from '@/components/ActionSheet';
import { confirm, notify } from '@/components/dialogs';
import { Card, Divider, ListItem, SectionTitle, Segmented, SwitchRow } from '@/components/ui';
import { seedDemoHistory } from '@/db/demo';
import { countWorkouts } from '@/db/workouts';
import { useData } from '@/hooks/useData';
import { notifyDataChanged } from '@/state/dataVersion';
import { useSettings } from '@/state/settings';
import { colors, font, space } from '@/theme';

const BAR_WEIGHTS = [45, 35, 33, 25, 15];

export default function SettingsTab() {
  const { settings, update } = useSettings();
  const { data: workoutCount } = useData(countWorkouts);
  const [seeding, setSeeding] = useState(false);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.scroll}>
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
});
