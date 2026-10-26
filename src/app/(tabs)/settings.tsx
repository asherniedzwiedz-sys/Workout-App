import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Switch, Text, TextInput, View } from 'react-native';
import { healthAvailable, syncAllToHealth } from '@/health';
import { callbackDomain } from '@/logic/strava';
import { isExpoGo } from '@/native';
import { updateSettings, useSettings } from '@/settings';
import { connectStrava, disconnectStrava, getStravaCreds, setStravaCreds, stravaAthlete, stravaRedirectUri } from '@/strava';
import { C } from '@/theme';
import { Body, Button, Card, H, Muted, Row, s, Screen } from '@/ui';

export default function SettingsTab() {
  const settings = useSettings();
  const [clientId, setClientId] = useState('');
  const [secret, setSecret] = useState('');
  const [athlete, setAthlete] = useState<string | null>(null);
  const redirect = stravaRedirectUri();

  useFocusEffect(
    useCallback(() => {
      void getStravaCreds().then((c) => {
        setClientId(c?.clientId ?? '');
        setSecret(c?.clientSecret ?? '');
      });
      void stravaAthlete().then(setAthlete);
    }, []),
  );

  const connect = async () => {
    try {
      await setStravaCreds({ clientId, clientSecret: secret });
      setAthlete(await connectStrava());
    } catch (e) {
      Alert.alert('Strava', (e as Error).message);
    }
  };

  return (
    <Screen>
      <H>Workouts</H>
      <Row title="Reminders" subtitle="Scheduled notifications per routine" icon="alarm-outline" onPress={() => router.push('/reminders')} />

      <H>Apple Health</H>
      <Card>
        {healthAvailable() ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Body>Save finished workouts to Health</Body>
              <View style={{ flex: 1 }} />
              <Switch value={settings.healthSync} onValueChange={(v) => updateSettings({ healthSync: v })} />
            </View>
            <Button
              title="Sync past workouts"
              variant="secondary"
              onPress={() => void syncAllToHealth().then((n) => Alert.alert('Apple Health', n ? `Saved ${n} workout${n > 1 ? 's' : ''}.` : 'Everything is already in Health.'))}
            />
          </>
        ) : (
          <Muted>{isExpoGo ? 'HealthKit needs the development build (Phase 7) — it is not available in Expo Go. Workouts logged now can be synced later.' : 'Health data is not available on this device.'}</Muted>
        )}
      </Card>

      <H>Apple Watch</H>
      <Row
        title="Motion Detection"
        subtitle={isExpoGo ? 'Needs the development build + watch app' : 'Wrist, auto-detect, calibration, accuracy report'}
        icon="watch-outline"
        onPress={() => router.push('/motion')}
      />

      <H>Strava</H>
      <Card>
        {athlete ? (
          <>
            <Body>Connected as {athlete}</Body>
            <Button title="Disconnect" variant="secondary" onPress={() => void disconnectStrava().then(() => setAthlete(null))} />
          </>
        ) : (
          <>
            <Muted>Create an API app at strava.com/settings/api, then paste its credentials. Set its Authorization Callback Domain to:</Muted>
            <Text selectable style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>{callbackDomain(redirect)}</Text>
            <Muted>{isExpoGo ? 'In Expo Go this is your computer’s LAN IP and changes with your network; the dev build uses "localhost".' : `Redirect: ${redirect}`}</Muted>
            <TextInput style={s.textInput} placeholder="Client ID" placeholderTextColor={C.muted} value={clientId} onChangeText={setClientId} keyboardType="number-pad" />
            <TextInput style={s.textInput} placeholder="Client Secret" placeholderTextColor={C.muted} value={secret} onChangeText={setSecret} secureTextEntry autoCapitalize="none" autoCorrect={false} />
            <Button title="Connect Strava" icon="link" disabled={!clientId || !secret} onPress={() => void connect()} />
            <Muted>Stored in the iOS Keychain on this phone only.</Muted>
          </>
        )}
      </Card>

      <Muted style={{ textAlign: 'center', marginTop: 16 }}>Liftlog {Constants.expoConfig?.version} · all data stays on this device</Muted>
    </Screen>
  );
}
