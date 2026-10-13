import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const supported = Platform.OS !== 'web';

export type NotificationKind = 'rest' | 'reminder';

/**
 * Must run once at startup. In the foreground the app plays its own rest-timer
 * cue, so rest notifications are silenced there; reminders still show a banner.
 * In the background (or on a paired Apple Watch) iOS delivers them normally.
 */
export function configureNotifications(): void {
  if (!supported) return;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const kind = notification.request.content.data?.kind as NotificationKind | undefined;
      const quiet = kind === 'rest';
      return {
        shouldShowBanner: !quiet,
        shouldShowList: !quiet,
        shouldPlaySound: !quiet,
        shouldSetBadge: false,
      };
    },
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('rest-timer', {
      name: 'Rest timer',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 400, 200, 400],
      sound: 'rest-done.wav',
    });
    void Notifications.setNotificationChannelAsync('reminders', {
      name: 'Workout reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return next.granted;
}

export async function hasNotificationPermission(): Promise<boolean> {
  if (!supported) return false;
  return (await Notifications.getPermissionsAsync()).granted;
}

/** Schedules the "rest over" alert so it fires even if the phone is locked. */
export async function scheduleRestNotification(endsAt: number, body: string): Promise<string | null> {
  if (!supported) return null;
  if (!(await hasNotificationPermission())) return null;
  const seconds = Math.max(1, Math.round((endsAt - Date.now()) / 1000));
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest complete',
        body,
        // Expo Go can't bundle custom sounds; a development build uses the beep.
        sound: isExpoGo ? 'default' : 'rest-done.wav',
        data: { kind: 'rest' satisfies NotificationKind },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        channelId: 'rest-timer',
      },
    });
  } catch (error) {
    console.warn('Could not schedule rest notification', error);
    return null;
  }
}

export async function cancelNotification(id: string | null | undefined): Promise<void> {
  if (!supported || !id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or gone.
  }
}

export interface WeeklyReminderInput {
  /** JavaScript weekday, 0 = Sunday. */
  weekday: number;
  hour: number;
  minute: number;
  title: string;
  body: string;
  data: Record<string, string | number | null>;
}

export async function scheduleWeeklyReminder(input: WeeklyReminderInput): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
      sound: 'default',
      data: { ...input.data, kind: 'reminder' satisfies NotificationKind },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      // expo-notifications weekdays run 1 (Sunday) to 7 (Saturday).
      weekday: input.weekday + 1,
      hour: input.hour,
      minute: input.minute,
      channelId: 'reminders',
    },
  });
}

export async function listScheduledIds(): Promise<Set<string>> {
  if (!supported) return new Set();
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return new Set(all.map((n) => n.identifier));
}

export const notificationsSupported = supported;
