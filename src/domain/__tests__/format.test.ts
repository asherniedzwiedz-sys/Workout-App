import {
  formatClock,
  formatDuration,
  formatPace,
  formatSet,
  formatTimeOfDay,
  formatVolume,
  metersToUnit,
  parseClock,
  startOfWeek,
  unitToMeters,
} from '../format';
import { plateBreakdown, warmupSets } from '../plates';

describe('format', () => {
  it('formats clocks and durations', () => {
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatDuration(3900)).toBe('1h 5m');
    expect(formatDuration(1500)).toBe('25m');
  });

  it('parses clock input', () => {
    expect(parseClock('25:30')).toBe(1530);
    expect(parseClock('1:02:03')).toBe(3723);
    expect(parseClock('30')).toBe(1800);
    expect(parseClock('5:75')).toBeNull();
    expect(parseClock('abc')).toBeNull();
  });

  it('computes pace per mile and km', () => {
    // 5 km in 25:00 is 8:03 /mi and 5:00 /km.
    expect(formatPace(1500, 5000, 'km')).toBe('5:00 /km');
    expect(formatPace(1500, 5000, 'mi')).toBe('8:03 /mi');
    expect(formatPace(1500, 0, 'mi')).toBe('–');
  });

  it('converts distances', () => {
    expect(metersToUnit(1609.344, 'mi')).toBeCloseTo(1);
    expect(unitToMeters(3.1, 'mi')).toBeCloseTo(4988.97, 1);
  });

  it('formats sets and volume', () => {
    expect(formatSet(185, 5)).toBe('185 lb × 5');
    expect(formatSet(0, 12)).toBe('12 reps');
    expect(formatVolume(12345)).toBe('12.3k lb');
    expect(formatVolume(950)).toBe('950 lb');
  });

  it('formats times of day', () => {
    expect(formatTimeOfDay(0, 5)).toBe('12:05 AM');
    expect(formatTimeOfDay(18, 30)).toBe('6:30 PM');
  });

  it('starts weeks on Monday', () => {
    const wed = new Date(2026, 9, 14, 15, 0).getTime(); // Wed Oct 14 2026
    expect(new Date(startOfWeek(wed)).getDate()).toBe(12);
    const sun = new Date(2026, 9, 18, 9, 0).getTime();
    expect(new Date(startOfWeek(sun)).getDate()).toBe(12);
  });
});

describe('plates', () => {
  it('breaks a target into plates per side', () => {
    expect(plateBreakdown(225).perSide).toEqual([45, 45]);
    expect(plateBreakdown(185).perSide).toEqual([45, 25]);
    // 46.25 lb per side can't be made from 45/35/25/10/5/2.5 plates: load 45 and report the gap.
    expect(plateBreakdown(137.5).perSide).toEqual([45]);
    expect(plateBreakdown(137.5).remainder).toBeCloseTo(2.5);
    expect(plateBreakdown(140).perSide).toEqual([45, 2.5]);
    expect(plateBreakdown(45).perSide).toEqual([]);
  });

  it('builds a warm-up ramp below the working weight', () => {
    const ramp = warmupSets(225);
    expect(ramp[0]).toEqual({ weight: 45, reps: 10 });
    expect(ramp.every((r) => r.weight < 225)).toBe(true);
    expect(warmupSets(45)).toEqual([]);
  });
});
