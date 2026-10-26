/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { e1rm, fmtDuration, fmtPace, parseDuration, progression, prSetIds, type LoggedSet } from './stats.ts';

test('e1rm uses Epley and treats singles as the max', () => {
  assert.equal(e1rm(200, 1), 200);
  assert.equal(Math.round(e1rm(200, 5)), 233);
  assert.equal(e1rm(0, 5), 0);
  assert.equal(e1rm(100, 0), 0);
});

const set = (id: number, workoutId: number, weight: number, reps: number): LoggedSet => ({ id, workoutId, at: workoutId * 1000 + id, weight, reps });

test('PRs: first workout is the baseline, later sets that beat weight or e1RM are flagged', () => {
  const sets = [set(1, 1, 185, 5), set(2, 1, 185, 5), set(3, 2, 185, 5), set(4, 2, 190, 3), set(5, 3, 175, 10), set(6, 3, 170, 8)];
  // 4: heavier weight. 5: e1RM 233.3 > 215.8. 3 and 6 beat nothing.
  assert.deepEqual([...prSetIds(sets)].sort(), [4, 5]);
  assert.equal(prSetIds([set(1, 1, 300, 1)]).size, 0);
});

test('progression keeps the best e1RM and top weight per workout', () => {
  const p = progression([set(1, 1, 100, 10), set(2, 1, 120, 2), set(3, 2, 130, 1)]);
  assert.equal(p.length, 2);
  assert.equal(p[0]?.topWeight, 120);
  assert.equal(Math.round(p[0]?.e1rm ?? 0), 133);
  assert.equal(p[1]?.e1rm, 130);
});

test('formatting and parsing', () => {
  assert.equal(fmtDuration(65_000), '1:05');
  assert.equal(fmtDuration(3_723_000), '1:02:03');
  assert.equal(fmtPace(1609.344, 485), '8:05 /mi');
  assert.equal(parseDuration('45:30'), 2730);
  assert.equal(parseDuration('1:02:03'), 3723);
  assert.equal(parseDuration('40'), 2400);
  assert.ok(Number.isNaN(parseDuration('4x:00')));
  assert.ok(Number.isNaN(parseDuration('10:75')));
});
