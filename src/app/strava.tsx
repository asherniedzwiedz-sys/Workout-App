import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { confirm, notify } from '@/components/dialogs';
import { Button, Card, Field, SectionTitle } from '@/components/ui';
import { formatDate, formatTimeOfDay } from '@/domain/format';
import { useData } from '@/hooks/useData';
import { isExpoGo } from '@/services/runtime';
import {
  connect,
  disconnect,
  forgetCredentials,
  getCallbackDomain,
  getRedirectUri,
  getStatus,
  saveCredentials,
  syncRuns,
} from '@/services/strava';
import { notifyDataChanged } from '@/state/dataVersion';
import { colors, font, radius, space } from '@/theme';

export default function StravaScreen() {
  const { data: status, reload } = useData(getStatus);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [busy, setBusy] = useState<'connect' | 'sync' | null>(null);
  const domain = getCallbackDomain();

  useEffect(() => {
    if (status?.clientId) setClientId(status.clientId);
  }, [status?.clientId]);

  const run = async (kind: 'connect' | 'sync', task: () => Promise<void>) => {
    setBusy(kind);
    try {
      await task();
    } catch (e) {
      notify('Strava', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      void reload();
    }
  };

  const onConnect = () =>
    run('connect', async () => {
      if (!clientId.trim() || (!clientSecret.trim() && !status?.hasSecret)) {
        notify('Missing credentials', 'Enter the Client ID and Client Secret from strava.com/settings/api.');
        return;
      }
      await saveCredentials(clientId, clientSecret);
      setClientSecret('');
      const athlete = await connect();
      if (athlete === null && !(await getStatus()).connected) return; // cancelled
      const result = await syncRuns({ full: true });
      notifyDataChanged();
      notify('Connected to Strava', `${athlete ? `Hi ${athlete}! ` : ''}Imported ${result.imported} run${result.imported === 1 ? '' : 's'}.`);
    });

  const copy = async (text: string) => {
    await Clipboard.setStringAsync(text);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Strava' }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {status?.connected ? (
          <Card style={{ gap: space.sm }} testID="strava-connected">
            <Text style={font.subheading}>Connected{status.athleteName ? ` as ${status.athleteName}` : ''}</Text>
            <Text style={font.small}>
              {status.lastSyncAt
                ? `Last synced ${formatDate(status.lastSyncAt)} at ${formatTimeOfDay(new Date(status.lastSyncAt).getHours(), new Date(status.lastSyncAt).getMinutes())}`
                : 'Not synced yet'}
            </Text>
            <Button
              title="Sync new runs"
              icon="sync"
              loading={busy === 'sync'}
              onPress={() =>
                run('sync', async () => {
                  const r = await syncRuns();
                  notifyDataChanged();
                  notify('Strava synced', r.imported ? `Imported ${r.imported} new run${r.imported === 1 ? '' : 's'}.` : 'No new runs.');
                })
              }
              style={{ marginTop: space.sm }}
            />
            <Button
              title="Re-import full history"
              variant="secondary"
              onPress={() =>
                run('sync', async () => {
                  const r = await syncRuns({ full: true });
                  notifyDataChanged();
                  notify('Strava synced', `Checked ${r.checked} activities, ${r.imported} new runs.`);
                })
              }
            />
            <Button
              title="Disconnect"
              variant="danger"
              onPress={async () => {
                if (!(await confirm({ title: 'Disconnect Strava?', message: 'Imported runs stay in the app.', confirmText: 'Disconnect', destructive: true }))) return;
                await disconnect();
                void reload();
              }}
            />
          </Card>
        ) : null}

        <SectionTitle>1 · Create a Strava API app</SectionTitle>
        <Card style={{ gap: space.sm }}>
          <Text style={font.small}>
            On strava.com go to Settings → My API Application and create an app (any name and website). Set{' '}
            <Text style={styles.strong}>Authorization Callback Domain</Text> to:
          </Text>
          <CopyRow value={domain} onCopy={copy} testID="callback-domain" />
          <Text style={font.tiny}>
            {isExpoGo
              ? "Running in Expo Go, so this is your computer's network address. If it changes (new Wi-Fi), update it on Strava."
              : 'Strava always accepts "localhost", so a development build needs no change here.'}
          </Text>
          <Text style={[font.tiny, { marginTop: space.xs }]}>Redirect URI the app will use:</Text>
          <CopyRow value={getRedirectUri()} onCopy={copy} small />
        </Card>

        <SectionTitle>2 · Enter your app's keys</SectionTitle>
        <Card style={{ gap: space.md }}>
          <Field label="Client ID" value={clientId} onChangeText={setClientId} keyboardType="number-pad" placeholder="12345" autoCorrect={false} testID="strava-client-id" />
          <Field
            label="Client Secret"
            value={clientSecret}
            onChangeText={setClientSecret}
            placeholder={status?.hasSecret ? 'Saved in Keychain (leave blank to keep)' : 'Paste from Strava'}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            testID="strava-client-secret"
          />
          <Text style={font.tiny}>
            Stored in the iOS Keychain on this phone. There's no server, so the token exchange happens on-device with your secret.
          </Text>
        </Card>

        <SectionTitle>3 · Connect</SectionTitle>
        <Button
          title={status?.connected ? 'Reconnect Strava' : 'Connect with Strava'}
          icon="link"
          size="lg"
          loading={busy === 'connect'}
          onPress={onConnect}
          style={{ backgroundColor: colors.strava }}
          testID="strava-connect"
        />
        <Text style={[font.tiny, { marginTop: space.sm }]}>
          Imports Run, Trail Run and Virtual Run activities: distance, moving time, pace, elevation and heart rate.
        </Text>

        {status?.clientId ? (
          <Button
            title="Forget keys and disconnect"
            variant="ghost"
            style={{ marginTop: space.xl }}
            onPress={async () => {
              if (!(await confirm({ title: 'Forget Strava keys?', confirmText: 'Forget', destructive: true }))) return;
              await forgetCredentials();
              setClientId('');
              void reload();
            }}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CopyRow({ value, onCopy, small, testID }: { value: string; onCopy: (v: string) => void; small?: boolean; testID?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        onCopy(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      style={styles.copyRow}
    >
      <Text style={[styles.copyValue, small && { fontSize: 13 }]} selectable numberOfLines={2}>
        {value}
      </Text>
      <Text style={styles.copyAction}>{copied ? 'Copied' : 'Copy'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, paddingBottom: 80 },
  strong: { color: colors.text, fontWeight: '700' },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.input,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: 48,
  },
  copyValue: { flex: 1, color: colors.text, fontSize: 16, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  copyAction: { color: colors.accent, fontWeight: '700' },
});
