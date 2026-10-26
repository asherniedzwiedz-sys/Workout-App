/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isUsable, predictionStats, repStats } from './accuracy.ts';
import { parseRecordingName, recordingName } from './recording.ts';

test('rep stats per exercise and the usable bar', () => {
  const rows = [10, 10, 9, 11, 10, 10, 13].map((counted) => ({ key: 'dumbbell-curl', actual: 10, counted }));
  const [s] = repStats(rows);
  assert.deepEqual(s, { key: 'dumbbell-curl', n: 7, exact: 4, within1: 6, mae: 5 / 7 });
  assert.equal(isUsable(s!), false); // 6/7 = 86%
  assert.equal(isUsable({ ...s!, within1: 7 }), true);
  assert.equal(isUsable({ key: 'x', n: 3, exact: 3, within1: 3, mae: 0 }), false);
});

test('prediction stats count correct, unsure and confusions', () => {
  const r = predictionStats([
    { predicted: 'dumbbell-curl', confidence: 0.9, confirmed: 'dumbbell-curl' },
    { predicted: 'hammer-curl', confidence: 0.7, confirmed: 'dumbbell-curl' },
    { predicted: null, confidence: 0.4, confirmed: 'dumbbell-row' },
  ]);
  assert.equal(r.n, 3);
  assert.equal(r.correct, 1);
  assert.equal(r.unsure, 1);
  assert.deepEqual(r.confusions, [{ pair: 'hammer-curl → dumbbell-curl', n: 1 }]);
  assert.deepEqual(r.perExercise[0], { key: 'dumbbell-curl', n: 2, correct: 1, unsure: 0 });
});

test('recording file names round-trip (must match the watch writer)', () => {
  const meta = { kind: 'calibration', exerciseId: 'dumbbell-shoulder-press', wrist: 'left', dominantHand: 'right', actualReps: 9, countedReps: 8, startedAt: 1761170000000 } as const;
  assert.equal(recordingName(meta), 'calibration__dumbbell-shoulder-press__left-right__a9__c8__1761170000000.csv');
  assert.deepEqual(parseRecordingName(recordingName(meta)), meta);
  assert.equal(parseRecordingName('notes.txt'), null);
});
