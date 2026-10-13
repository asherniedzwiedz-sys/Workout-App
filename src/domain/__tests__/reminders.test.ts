import { describeWeekdays, nextOccurrence, reminderContent } from '../reminders';

describe('reminders', () => {
  it('describes weekday sets', () => {
    expect(describeWeekdays([1, 3, 5])).toBe('Mon, Wed, Fri');
    expect(describeWeekdays([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(describeWeekdays([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(describeWeekdays([6, 0])).toBe('Weekends');
    expect(describeWeekdays([0, 2])).toBe('Tue, Sun');
  });

  it('finds the next occurrence', () => {
    const tueNoon = new Date(2026, 9, 13, 12, 0); // Tue Oct 13 2026
    expect(nextOccurrence([2], 18, 0, tueNoon)?.getDate()).toBe(13); // later today
    expect(nextOccurrence([2], 7, 0, tueNoon)?.getDate()).toBe(20); // today already passed
    expect(nextOccurrence([1, 5], 18, 30, tueNoon)?.getDate()).toBe(16); // Friday
    expect(nextOccurrence([], 18, 0, tueNoon)).toBeNull();
  });

  it('builds notification text', () => {
    expect(reminderContent('Push A', 6)).toEqual({ title: 'Time for Push A', body: '6 exercises ready. Tap to start.' });
    expect(reminderContent(null, null).title).toBe('Time to train');
  });
});
