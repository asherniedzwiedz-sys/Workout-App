import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ActionSheetHost } from '@/components/ActionSheet';
import { RestTimerWatcher } from '@/components/RestTimer';
import { initDatabase } from '@/db/client';
import { initSound } from '@/services/feedback';
import { configureNotifications } from '@/services/notifications';
import { useActiveWorkout } from '@/state/activeWorkout';
import { useExercises } from '@/state/exercises';
import { useSettings } from '@/state/settings';
import { colors, navigationTheme } from '@/theme';

// Must be registered before any notification can arrive.
configureNotifications();

async function boot(): Promise<void> {
  await initDatabase();
  await Promise.all([useSettings.getState().load(), useExercises.getState().load()]);
  await useActiveWorkout.getState().hydrate();
  void initSound();
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    boot()
      .then(() => setReady(true))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Couldn't open the database</Text>
        <Text style={styles.errorBody}>{error}</Text>
      </View>
    );
  }
  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700' },
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home' }} />
          <Stack.Screen name="workout" options={{ presentation: 'modal', headerShown: false }} />
        </Stack>
        <RestTimerWatcher />
        <ActionSheetHost />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errorBody: { color: colors.textDim, textAlign: 'center' },
});
