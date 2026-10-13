import { estimateOneRepMax, roundToIncrement, weightForReps } from '../oneRepMax';
import { computePrFlags, computeRecords, type RecordSet } from '../records';

let key = 0;
function s(workoutId: number, at: number, weight: number, reps: number, type: RecordSet['type'] = 'normal'): RecordSet {
  return { key: ++key, workoutId, completedAt: at, type, weight, reps };
}

describe('one rep max', () => {
  it('uses Epley and treats a single as a true max', () => {
    expect(estimateOneRepMax(200, 1)).toBe(200);
    expect(estimateOneRepMax(200, 5)).toBeCloseTo(233.33, 1);
    expect(estimateOneRepMax(0, 5)).toBe(0);
    expect(estimateOneRepMax(100, 0)).toBe(0);
  });

  it('inverts back to a working weight', () => {
    expect(weightForReps(estimateOneRepMax(185, 8), 8)).toBeCloseTo(185);
    expect(roundToIncrement(187.4)).toBe(185);
  });
});

describe('PR flags', () => {
  it('does not flag the first session (baseline)', () => {
    const sets = [s(1, 100, 135, 5), s(1, 101, 145, 5)];
    expect(computePrFlags(sets).size).toBe(0);
  });

  it('flags the best set of a later session that beats history', () => {
    const base = [s(1, 100, 185, 5), s(1, 101, 185, 5)];
    const better = s(2, 200, 195, 5);
    const worse = s(2, 201, 175, 5);
    const flags = computePrFlags([...base, better, worse]);
    expect(flags.get(better.key)?.sort()).toEqual(['e1rm', 'volume', 'weight']);
    expect(flags.has(worse.key)).toBe(false);
  });

  it('awards each kind to only one set per workout', () => {
    const sets = [s(1, 1, 100, 5), s(2, 2, 110, 5), s(2, 3, 120, 5)];
    const flags = computePrFlags(sets);
    const flagged = [...flags.values()].flat();
    expect(flagged.filter((k) => k === 'weight')).toHaveLength(1);
  });

  it('tracks kinds independently (rep PR at lower weight gives e1RM/volume but not weight)', () => {
    const first = s(1, 1, 225, 3);
    const later = s(2, 2, 205, 8);
    const flags = computePrFlags([first, later]);
    expect(flags.get(later.key)?.sort()).toEqual(['e1rm', 'volume']);
  });

  it('ignores warm-ups and uses reps for bodyweight sets', () => {
    const sets = [s(1, 1, 0, 10), s(2, 2, 0, 12), s(2, 3, 400, 1, 'warmup')];
    const flags = computePrFlags(sets);
    expect([...flags.values()]).toEqual([['reps']]);
  });

  it('orders sessions by time, not insertion order', () => {
    const later = s(2, 500, 200, 5);
    const earlier = s(1, 100, 150, 5);
    const flags = computePrFlags([later, earlier]);
    expect(flags.get(later.key)).toContain('weight');
    expect(flags.has(earlier.key)).toBe(false);
  });

  it('requires strictly beating the record', () => {
    const flags = computePrFlags([s(1, 1, 200, 5), s(2, 2, 200, 5)]);
    expect(flags.size).toBe(0);
  });
});

describe('records', () => {
  it('summarizes bests and rep records', () => {
    const r = computeRecords([s(1, 1, 225, 5), s(1, 2, 245, 2), s(2, 3, 185, 10), s(2, 4, 315, 1, 'warmup')]);
    expect(r.heaviest).toMatchObject({ weight: 245, reps: 2 });
    expect(r.bestE1rm?.weight).toBe(225); // 262.5 beats 245×2 (261.3)
    expect(r.bestVolumeSet).toMatchObject({ weight: 185, reps: 10, value: 1850 });
    expect(r.repRecords.map((x) => [x.reps, x.weight])).toEqual([
      [2, 245],
      [5, 225],
      [10, 185],
    ]);
  });
});
