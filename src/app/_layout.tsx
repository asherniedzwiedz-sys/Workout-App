import * as Notifications from 'expo-notifications';
import { DarkTheme, router, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { migrate } from '@/db';
import { initWatch } from '@/watch';
import { C } from '@/theme';

migrate();

Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    // In the foreground the rest timer beeps itself; only reminders show a banner.
    const show = n.request.content.data?.kind !== 'rest';
    return { shouldPlaySound: show, shouldSetBadge: false, shouldShowBanner: show, shouldShowList: show };
  },
});

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, primary: C.accent, text: C.text, border: C.border } };

export default function RootLayout() {
  useEffect(() => {
    initWatch();
    const open = (r: Notifications.NotificationResponse | null) => {
      const routineId = r?.notification.request.content.data?.routineId;
      if (typeof routineId === 'number') router.push({ pathname: '/workout', params: { routineId: String(routineId) } });
    };
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: C.bg }, headerTintColor: C.text, contentStyle: { backgroundColor: C.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Back' }} />
        <Stack.Screen name="workout" options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="pick-exercise" options={{ presentation: 'modal', title: 'Choose exercise' }} />
        <Stack.Screen name="log-run" options={{ presentation: 'modal', title: 'Log a run' }} />
      </Stack>
    </ThemeProvider>
  );
}
