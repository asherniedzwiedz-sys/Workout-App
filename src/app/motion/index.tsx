import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { EXERCISES, MANUAL_ONLY_REASON } from '@/logic/exercises';
import { exportRecordings, listRecordings } from '@/motion';
import { isExpoGo } from '@/native';
import { updateSettings, useSettings, type Hand } from '@/settings';
import { C } from '@/theme';
import { Body, Button, Card, Chip, H, Muted, Row, s, Screen } from '@/ui';
import { useWatchReachable } from '@/watch';

export default function MotionSettings() {
  const settings = useSettings();
  const reachable = useWatchReachable();
  const [count, setCount] = useState(0);
  const taps = useRef(0);
  useFocusEffect(useCallback(() => setCount(listRecordings().length), []));

  const hands = (value: Hand, set: (h: Hand) => void) => (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {(['left', 'right'] as const).map((h) => <Chip key={h} label={h === 'left' ? 'Left' : 'Right'} active={value === h} onPress={() => set(h)} />)}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Motion Detection' }} />
      <Screen>
        {isExpoGo && <Card><Muted>Motion detection runs in the native watch app, which needs the EAS development build. It does not work in Expo Go.</Muted></Card>}
        <Card>
          <Body>The Watch detects when a set ends, guesses the exercise and counts reps — then asks you to confirm. It never logs a set by itself and never guesses weight (there is no load sensor): weight is pre-filled from your last set and you confirm it.</Body>
          <Muted>Watch app: {reachable ? 'connected' : 'not reachable — open Liftlog on the Watch'}</Muted>
        </Card>

        <H>Setup</H>
        <Card>
          <Muted>Watch is on my… (must match how you recorded training data)</Muted>
          {hands(settings.wrist, (wrist) => updateSettings({ wrist }))}
          <Muted>Dominant hand</Muted>
          {hands(settings.dominantHand, (dominantHand) => updateSettings({ dominantHand }))}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Body>Auto-detect sets on Watch</Body>
              <Muted>Off = log sets manually on the Watch</Muted>
            </View>
            <Switch value={settings.autoDetect} onValueChange={(autoDetect) => updateSettings({ autoDetect })} />
          </View>
        </Card>

        <Row title="Calibrate" subtitle="2 guided sets per exercise → your personal dataset" icon="body-outline" onPress={() => router.push('/motion/calibrate')} />
        <Row title="Accuracy Report" subtitle="Predicted vs confirmed exercise and reps" icon="analytics-outline" onPress={() => router.push('/motion/accuracy')} />
        {settings.devMode && <Row title="Collect Data" subtitle="Hidden: label raw motion for training" icon="flask-outline" onPress={() => router.push('/motion/collect')} />}
        <Button
          title={`Export ${count} recording${count === 1 ? '' : 's'} (CSV)`}
          icon="share-outline"
          variant="secondary"
          disabled={!count}
          onPress={() => void exportRecordings().catch((e: Error) => Alert.alert('Export', e.message))}
        />

        <H>Watch can detect (v1)</H>
        <Card>
          {EXERCISES.filter((e) => e.motion === 'wrist').map((e) => <Text key={e.id} style={{ color: C.success, fontSize: 15 }}>✓ {e.name}</Text>)}
        </Card>
        <H>Manual only</H>
        <Card>
          <Muted>{MANUAL_ONLY_REASON}</Muted>
          {EXERCISES.filter((e) => e.motion === 'manual').map((e) => <Text key={e.id} style={{ color: C.warn, fontSize: 15 }}>✎ {e.name}</Text>)}
          <Muted>Other upper-body lifts aren’t in the v1 seed list yet — log them manually.</Muted>
        </Card>

        <Text
          style={[s.muted, { textAlign: 'center', marginTop: 12 }]}
          onPress={() => {
            if (++taps.current < 5) return;
            taps.current = 0;
            updateSettings({ devMode: !settings.devMode });
            Alert.alert(settings.devMode ? 'Collect Data hidden' : 'Collect Data unlocked', 'Also shown on the Watch.');
          }}
        >
          Motion detection v1
        </Text>
      </Screen>
    </>
  );
}
