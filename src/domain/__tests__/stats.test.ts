import { startOfWeek } from '../format';
import { buildSeries, compactNumber, filterRange, metricsFor, niceTicks, weekStreak, weeklyBuckets } from '../stats';

const DAY = 86_400_000;
const base = new Date(2026, 8, 7, 18).getTime(); // Mon Sep 7 2026, 6pm

const sessions = [
  { startedAt: base, sets: [{ type: 'warmup' as const, weight: 95, reps: 5 }, { type: 'normal' as const, weight: 185, reps: 5 }] },
  { startedAt: base + 7 * DAY, sets: [{ type: 'normal' as const, weight: 175, reps: 5 }] },
  { startedAt: base + 14 * DAY, sets: [{ type: 'normal' as const, weight: 195, reps: 3 }, { type: 'normal' as const, weight: 185, reps: 6 }] },
];

describe('buildSeries', () => {
  it('builds e1RM points oldest first and marks new highs (not the baseline)', () => {
    const points = buildSeries([...sessions].reverse(), 'e1rm');
    expect(points.map((p) => p.x)).toEqual(sessions.map((s) => s.startedAt));
    expect(points[0]!.record).toBe(false);
    expect(points[1]!.record).toBe(false); // 175×5 is lower
    expect(points[2]!.record).toBe(true); // 185×6 = 222 > 215.8
    expect(points[2]!.y).toBeCloseTo(185 * (1 + 6 / 30));
  });

  it('ignores warm-ups for top weight and volume', () => {
    expect(buildSeries(sessions, 'topWeight').map((p) => p.y)).toEqual([185, 175, 195]);
    expect(buildSeries(sessions, 'volume').map((p) => p.y)).toEqual([925, 875, 195 * 3 + 185 * 6]);
  });

  it('picks rep-based metrics for bodyweight-only history', () => {
    expect(metricsFor([{ startedAt: 1, sets: [{ type: 'normal', weight: 0, reps: 12 }] }])).toEqual(['bestReps', 'volume']);
    expect(metricsFor(sessions)[0]).toBe('e1rm');
  });

  it('filters by range', () => {
    const points = buildSeries(sessions, 'topWeight');
    expect(filterRange(points, '1M', base + 20 * DAY)).toHaveLength(3);
    expect(filterRange(points, '1M', base + 40 * DAY)).toHaveLength(1);
    expect(filterRange(points, 'ALL', base + 400 * DAY)).toHaveLength(3);
  });
});

describe('weekly stats', () => {
  it('buckets into Monday weeks, oldest first, including empty weeks', () => {
    const times = [base, base + DAY, base + 14 * DAY];
    const buckets = weeklyBuckets(times, (t) => t, () => 1, 4, base + 15 * DAY, startOfWeek);
    expect(buckets.map((b) => b.value)).toEqual([0, 2, 0, 1]);
    expect(new Date(buckets[1]!.weekStart).getDay()).toBe(1);
  });

  it('counts week streaks ending this week or last week', () => {
    const times = [base, base + 7 * DAY, base + 14 * DAY];
    expect(weekStreak(times, base + 15 * DAY, startOfWeek)).toBe(3);
    // Nothing yet this week still counts the streak through last week.
    expect(weekStreak(times, base + 22 * DAY, startOfWeek)).toBe(3);
    expect(weekStreak(times, base + 35 * DAY, startOfWeek)).toBe(0);
  });
});

describe('axis helpers', () => {
  it('produces round ticks that cover the data', () => {
    const ticks = niceTicks(183, 247, 4);
    expect(ticks[0]).toBeLessThanOrEqual(183);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(247);
    expect(ticks.every((t) => t % 10 === 0)).toBe(true);
    expect(niceTicks(100, 100).length).toBeGreaterThan(1);
  });

  it('compacts large numbers', () => {
    expect(compactNumber(950)).toBe('950');
    expect(compactNumber(1500)).toBe('1.5K');
    expect(compactNumber(12000)).toBe('12K');
  });
});
