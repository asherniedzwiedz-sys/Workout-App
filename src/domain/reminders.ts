import { weekdayShort } from './format';

/** "Mon, Wed, Fri" / "Every day" / "Weekdays" / "Weekends". Weekdays are JS (0 = Sunday). */
export function describeWeekdays(days: number[]): string {
  const set = new Set(days);
  if (set.size === 7) return 'Every day';
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'Weekdays';
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekends';
  // List Monday first, the way training weeks are usually read.
  return [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => set.has(d))
    .map(weekdayShort)
    .join(', ');
}

export function reminderContent(routineName: string | null, exerciseCount: number | null): { title: string; body: string } {
  if (routineName) {
    return {
      title: `Time for ${routineName}`,
      body: exerciseCount ? `${exerciseCount} exercises ready. Tap to start.` : 'Tap to start your workout.',
    };
  }
  return { title: 'Time to train', body: 'Open IronLog and start a workout.' };
}

/** Next time this reminder fires after `now`, or null if it has no days. */
export function nextOccurrence(days: number[], hour: number, minute: number, now: Date): Date | null {
  if (days.length === 0) return null;
  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(hour, minute, 0, 0);
    if (days.includes(candidate.getDay()) && candidate.getTime() > now.getTime()) return candidate;
  }
  return null;
}
