import type { Reminder } from '@/domain/types';

import { getDb, parseJson } from './client';

interface ReminderRow {
  id: number;
  routine_id: number | null;
  routine_name: string | null;
  weekdays: string;
  hour: number;
  minute: number;
  enabled: number;
  notification_ids: string;
}

function toReminder(r: ReminderRow): Reminder {
  return {
    id: r.id,
    routineId: r.routine_id,
    routineName: r.routine_name,
    weekdays: parseJson<number[]>(r.weekdays, []),
    hour: r.hour,
    minute: r.minute,
    enabled: r.enabled === 1,
    notificationIds: parseJson<string[]>(r.notification_ids, []),
  };
}

const SELECT = `SELECT r.*, ro.name AS routine_name FROM reminders r LEFT JOIN routines ro ON ro.id = r.routine_id`;

export async function listReminders(): Promise<Reminder[]> {
  const rows = await getDb().getAllAsync<ReminderRow>(`${SELECT} ORDER BY r.hour, r.minute, r.id`);
  return rows.map(toReminder);
}

export async function getReminder(id: number): Promise<Reminder | null> {
  const row = await getDb().getFirstAsync<ReminderRow>(`${SELECT} WHERE r.id = ?`, id);
  return row ? toReminder(row) : null;
}

export async function listRemindersForRoutine(routineId: number): Promise<Reminder[]> {
  const rows = await getDb().getAllAsync<ReminderRow>(`${SELECT} WHERE r.routine_id = ?`, routineId);
  return rows.map(toReminder);
}

export interface ReminderInput {
  id?: number;
  routineId: number | null;
  weekdays: number[];
  hour: number;
  minute: number;
  enabled: boolean;
}

export async function saveReminder(input: ReminderInput): Promise<number> {
  const db = getDb();
  const weekdays = JSON.stringify([...new Set(input.weekdays)].sort((a, b) => a - b));
  if (input.id) {
    await db.runAsync(
      'UPDATE reminders SET routine_id = ?, weekdays = ?, hour = ?, minute = ?, enabled = ? WHERE id = ?',
      input.routineId,
      weekdays,
      input.hour,
      input.minute,
      input.enabled ? 1 : 0,
      input.id,
    );
    return input.id;
  }
  const result = await db.runAsync(
    'INSERT INTO reminders (routine_id, weekdays, hour, minute, enabled) VALUES (?, ?, ?, ?, ?)',
    input.routineId,
    weekdays,
    input.hour,
    input.minute,
    input.enabled ? 1 : 0,
  );
  return result.lastInsertRowId;
}

export async function setReminderEnabled(id: number, enabled: boolean): Promise<void> {
  await getDb().runAsync('UPDATE reminders SET enabled = ? WHERE id = ?', enabled ? 1 : 0, id);
}

export async function setReminderNotificationIds(id: number, ids: string[]): Promise<void> {
  await getDb().runAsync('UPDATE reminders SET notification_ids = ? WHERE id = ?', JSON.stringify(ids), id);
}

export async function deleteReminderRow(id: number): Promise<void> {
  await getDb().runAsync('DELETE FROM reminders WHERE id = ?', id);
}
