// Reminder scheduling with expo-notifications and the DB mocked.

type Row = { id: number; routineId: number | null; routineName: string | null; weekdays: number[]; hour: number; minute: number; enabled: boolean; notificationIds: string[] };
const mockRows = new Map<number, Row>();
const mockScheduled = new Map<string, { trigger: unknown; content: { data: Record<string, unknown> } }>();
let mockNextId = 1;
let mockGranted = true;

jest.mock('../runtime', () => ({ isExpoGo: true }));
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { WEEKLY: 'weekly', TIME_INTERVAL: 'timeInterval' },
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  getPermissionsAsync: jest.fn(async () => ({ granted: mockGranted, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: mockGranted })),
  scheduleNotificationAsync: jest.fn(async (req: { trigger: unknown; content: { data: Record<string, unknown> } }) => {
    const id = `n${mockNextId++}`;
    mockScheduled.set(id, req);
    return id;
  }),
  cancelScheduledNotificationAsync: jest.fn(async (id: string) => void mockScheduled.delete(id)),
  getAllScheduledNotificationsAsync: jest.fn(async () =>
    [...mockScheduled.entries()].map(([identifier, req]) => ({ identifier, content: req.content, trigger: req.trigger })),
  ),
}));
jest.mock('@/db/routines', () => ({
  getRoutine: jest.fn(async (id: number) => (id === 7 ? { id: 7, name: 'Push A', exercises: [1, 2, 3] } : null)),
  deleteRoutine: jest.fn(async () => undefined),
}));
jest.mock('@/db/reminders', () => ({
  getReminder: jest.fn(async (id: number) => mockRows.get(id) ?? null),
  listReminders: jest.fn(async () => [...mockRows.values()]),
  listRemindersForRoutine: jest.fn(async (rid: number) => [...mockRows.values()].filter((r) => r.routineId === rid)),
  saveReminder: jest.fn(async (input: Omit<Row, 'id' | 'routineName' | 'notificationIds'> & { id?: number }) => {
    const id = input.id ?? mockRows.size + 1;
    mockRows.set(id, { ...input, id, routineName: null, notificationIds: mockRows.get(id)?.notificationIds ?? [] });
    return id;
  }),
  setReminderEnabled: jest.fn(async (id: number, enabled: boolean) => void (mockRows.get(id)!.enabled = enabled)),
  setReminderNotificationIds: jest.fn(async (id: number, ids: string[]) => void (mockRows.get(id)!.notificationIds = ids)),
  deleteReminderRow: jest.fn(async (id: number) => void mockRows.delete(id)),
}));

import { reconcileReminders, removeRoutine, toggleReminder, upsertReminder } from '../reminders';

beforeEach(() => {
  mockRows.clear();
  mockScheduled.clear();
  mockNextId = 1;
  mockGranted = true;
});

it('schedules one weekly notification per day, converting to iOS weekday numbers', async () => {
  const { id, scheduled } = await upsertReminder({ routineId: 7, weekdays: [1, 3, 5], hour: 18, minute: 30, enabled: true });
  expect(scheduled).toBe(true);
  expect(mockRows.get(id)!.notificationIds).toHaveLength(3);
  const triggers = [...mockScheduled.values()].map((r) => r.trigger as { weekday: number; hour: number; minute: number });
  expect(triggers.map((t) => t.weekday)).toEqual([2, 4, 6]); // Mon/Wed/Fri as 1=Sunday..7=Saturday
  expect(triggers[0]).toMatchObject({ type: 'weekly', hour: 18, minute: 30 });
  const first = [...mockScheduled.values()][0]!;
  expect(first.content).toMatchObject({ title: 'Time for Push A', data: { kind: 'reminder', routineId: 7 } });
});

it('cancels notifications when toggled off and restores them when toggled on', async () => {
  const { id } = await upsertReminder({ routineId: null, weekdays: [0, 6], hour: 9, minute: 0, enabled: true });
  expect(mockScheduled.size).toBe(2);
  await toggleReminder(id, false);
  expect(mockScheduled.size).toBe(0);
  expect(mockRows.get(id)!.notificationIds).toEqual([]);
  await toggleReminder(id, true);
  expect(mockScheduled.size).toBe(2);
});

it('re-saving replaces notifications instead of duplicating them', async () => {
  const { id } = await upsertReminder({ routineId: 7, weekdays: [1, 2], hour: 6, minute: 0, enabled: true });
  await upsertReminder({ id, routineId: 7, weekdays: [1, 2, 4], hour: 6, minute: 15, enabled: true });
  expect(mockScheduled.size).toBe(3);
});

it('saves but does not schedule without permission', async () => {
  mockGranted = false;
  const { id, scheduled } = await upsertReminder({ routineId: 7, weekdays: [1], hour: 6, minute: 0, enabled: true });
  expect(scheduled).toBe(false);
  expect(mockRows.has(id)).toBe(true);
  expect(mockScheduled.size).toBe(0);
});

it('reconciles: reschedules dropped notifications and cancels orphans', async () => {
  const { id } = await upsertReminder({ routineId: 7, weekdays: [1, 3], hour: 6, minute: 0, enabled: true });
  mockScheduled.clear(); // e.g. app reinstalled
  mockScheduled.set('orphan', { trigger: {}, content: { data: { kind: 'reminder', reminderId: 99 } } });
  mockScheduled.set('rest', { trigger: {}, content: { data: { kind: 'rest' } } });
  await reconcileReminders();
  expect(mockScheduled.has('orphan')).toBe(false);
  expect(mockScheduled.has('rest')).toBe(true);
  expect(mockRows.get(id)!.notificationIds.every((n) => mockScheduled.has(n))).toBe(true);
  expect(mockScheduled.size).toBe(3);
});

it('deleting a routine removes its reminders and notifications', async () => {
  await upsertReminder({ routineId: 7, weekdays: [1, 3], hour: 6, minute: 0, enabled: true });
  await upsertReminder({ routineId: null, weekdays: [5], hour: 6, minute: 0, enabled: true });
  await removeRoutine(7);
  expect([...mockRows.values()].map((r) => r.routineId)).toEqual([null]);
  expect(mockScheduled.size).toBe(1);
});
