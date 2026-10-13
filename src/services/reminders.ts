import * as Notifications from 'expo-notifications';

import {
  deleteReminderRow,
  getReminder,
  listReminders,
  listRemindersForRoutine,
  saveReminder,
  setReminderEnabled,
  setReminderNotificationIds,
  type ReminderInput,
} from '@/db/reminders';
import { deleteRoutine, getRoutine } from '@/db/routines';
import { reminderContent } from '@/domain/reminders';

import {
  cancelNotification,
  ensureNotificationPermission,
  listScheduledIds,
  notificationsSupported,
  scheduleWeeklyReminder,
} from './notifications';

/** One weekly local notification per selected weekday; ids are stored on the reminder. */
async function schedule(reminderId: number): Promise<{ scheduled: boolean }> {
  const reminder = await getReminder(reminderId);
  if (!reminder) return { scheduled: false };
  for (const id of reminder.notificationIds) await cancelNotification(id);
  if (!reminder.enabled || reminder.weekdays.length === 0 || !notificationsSupported) {
    await setReminderNotificationIds(reminderId, []);
    return { scheduled: false };
  }
  if (!(await ensureNotificationPermission())) {
    await setReminderNotificationIds(reminderId, []);
    return { scheduled: false };
  }
  const routine = reminder.routineId ? await getRoutine(reminder.routineId) : null;
  const content = reminderContent(routine?.name ?? null, routine?.exercises.length ?? null);
  const ids: string[] = [];
  for (const weekday of reminder.weekdays) {
    ids.push(
      await scheduleWeeklyReminder({
        weekday,
        hour: reminder.hour,
        minute: reminder.minute,
        title: content.title,
        body: content.body,
        data: { reminderId: reminder.id, routineId: reminder.routineId },
      }),
    );
  }
  await setReminderNotificationIds(reminderId, ids);
  return { scheduled: true };
}

export async function upsertReminder(input: ReminderInput): Promise<{ id: number; scheduled: boolean }> {
  const id = await saveReminder(input);
  const { scheduled } = await schedule(id);
  return { id, scheduled };
}

export async function toggleReminder(id: number, enabled: boolean): Promise<{ scheduled: boolean }> {
  await setReminderEnabled(id, enabled);
  return schedule(id);
}

export async function removeReminder(id: number): Promise<void> {
  const reminder = await getReminder(id);
  for (const nid of reminder?.notificationIds ?? []) await cancelNotification(nid);
  await deleteReminderRow(id);
}

/** Deletes a routine along with its reminders and their scheduled notifications. */
export async function removeRoutine(routineId: number): Promise<void> {
  for (const r of await listRemindersForRoutine(routineId)) await removeReminder(r.id);
  await deleteRoutine(routineId);
}

/** Re-schedules a routine's reminders so notification text follows a rename. */
export async function refreshRoutineReminders(routineId: number): Promise<void> {
  for (const r of await listRemindersForRoutine(routineId)) await schedule(r.id);
}

/**
 * Runs at launch: re-creates notifications iOS dropped (reinstall, restore, permission
 * re-grant) and cancels reminder notifications whose reminder no longer exists.
 */
export async function reconcileReminders(): Promise<void> {
  if (!notificationsSupported) return;
  const reminders = await listReminders();
  const scheduled = await listScheduledIds();
  for (const r of reminders) {
    if (!r.enabled) continue;
    const missing = r.notificationIds.length !== r.weekdays.length || r.notificationIds.some((id) => !scheduled.has(id));
    if (missing) await schedule(r.id);
  }
  // Re-read: the loop above may have replaced notification ids.
  const known = new Set((await listReminders()).flatMap((r) => r.notificationIds));
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of all) {
    const data = n.content.data as { kind?: string } | undefined;
    if (data?.kind === 'reminder' && !known.has(n.identifier)) await cancelNotification(n.identifier);
  }
}
