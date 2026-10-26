/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callbackDomain, formEncode, isRun, queryParams, toRun, type StravaActivity } from './strava.ts';

const act = (p: Partial<StravaActivity>): StravaActivity => ({ id: 1, distance: 5000, moving_time: 1500, elapsed_time: 1600, start_date: '2026-10-20T12:00:00Z', ...p });

test('keeps runs (incl. trail/virtual) and maps fields', () => {
  assert.ok(isRun(act({ sport_type: 'Run' })));
  assert.ok(isRun(act({ sport_type: 'TrailRun' })));
  assert.ok(isRun(act({ type: 'Run' })));
  assert.ok(!isRun(act({ sport_type: 'Ride' })));
  assert.ok(!isRun(act({ sport_type: 'WeightTraining' })));
  assert.deepEqual(toRun(act({ id: 12345678901, name: ' Morning Run ' })), {
    strava_id: '12345678901', name: 'Morning Run', started_at: Date.UTC(2026, 9, 20, 12), distance_m: 5000, duration_s: 1500, source: 'strava',
  });
  assert.equal(toRun(act({ moving_time: 0 })).duration_s, 1600);
});

test('OAuth helpers', () => {
  assert.deepEqual(queryParams('liftlog://localhost/strava?state=abc&code=x%2By&scope=read,activity:read_all'), { state: 'abc', code: 'x+y', scope: 'read,activity:read_all' });
  assert.deepEqual(queryParams('exp://192.168.1.5:8081/--/strava?error=access_denied'), { error: 'access_denied' });
  assert.equal(callbackDomain('exp://192.168.1.5:8081/--/strava'), '192.168.1.5');
  assert.equal(callbackDomain('liftlog://localhost/strava'), 'localhost');
  assert.equal(formEncode({ a: '1 2', b: 'x&y' }), 'a=1%202&b=x%26y');
});
