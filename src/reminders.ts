import * as Notifications from 'expo-notifications';
import { getRoutine, saveReminder, type Reminder } from './db';

export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // index + 1 = expo-notifications weekday (1 = Sunday)

export async function ensureNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

type Draft = Omit<Reminder, 'id' | 'routine_name' | 'notif_ids'> & { id?: number; notif_ids?: string };

/** Cancels the reminder's old notifications, schedules one weekly trigger per selected day if enabled, then saves. */
export async function saveAndSchedule(r: Draft) {
  for (const id of JSON.parse(r.notif_ids ?? '[]') as string[]) await Notifications.cancelScheduledNotificationAsync(id);
  const ids: string[] = [];
  if (r.enabled) {
    if (!(await ensureNotificationPermission())) throw new Error('Notifications are off for Liftlog. Enable them in iOS Settings.');
    const routine = r.routine_id ? getRoutine(r.routine_id) : null;
    for (const weekday of r.weekdays.split(',').filter(Boolean).map(Number)) {
      ids.push(
        await Notifications.scheduleNotificationAsync({
          content: {
            title: routine ? `Time for ${routine.name}` : 'Time to lift',
            body: routine ? `${routine.exercises.length} exercises queued. Tap to start.` : 'Tap to start a workout.',
            sound: 'default',
            data: routine ? { kind: 'reminder', routineId: routine.id } : { kind: 'reminder' },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour: r.hour, minute: r.minute },
        }),
      );
    }
  }
  return saveReminder({ ...r, notif_ids: JSON.stringify(ids) });
}

export async function removeReminder(r: Reminder, remove: (id: number) => void) {
  for (const id of JSON.parse(r.notif_ids) as string[]) await Notifications.cancelScheduledNotificationAsync(id);
  remove(r.id);
}
