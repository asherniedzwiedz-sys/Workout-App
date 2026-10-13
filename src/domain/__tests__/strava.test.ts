import { summarizeRuns, validateManualRun } from '../runs';
import {
  buildAuthorizeUrl,
  callbackDomain,
  isRunActivity,
  needsRefresh,
  parseQuery,
  parseRedirect,
  parseTokenResponse,
  toRunInput,
  type StravaActivity,
} from '../strava';
import type { Run } from '../types';

describe('strava helpers', () => {
  it('builds the authorize URL with an encoded redirect and activity scope', () => {
    const url = buildAuthorizeUrl(' 12345 ', 'exp://192.168.1.20:8081/--/strava-redirect', 'abc');
    expect(url.startsWith('https://www.strava.com/oauth/mobile/authorize?')).toBe(true);
    const q = parseQuery(url);
    expect(q).toMatchObject({
      client_id: '12345',
      redirect_uri: 'exp://192.168.1.20:8081/--/strava-redirect',
      response_type: 'code',
      scope: 'read,activity:read_all',
      state: 'abc',
    });
  });

  it('parses redirects, including denials, state mismatches and missing scope', () => {
    expect(parseRedirect('ironlog://localhost/strava-redirect?state=s1&code=xyz&scope=read,activity:read_all', 's1')).toEqual({
      ok: true,
      code: 'xyz',
      scope: 'read,activity:read_all',
    });
    expect(parseRedirect('ironlog://x?state=s1&error=access_denied', 's1')).toMatchObject({ ok: false });
    expect(parseRedirect('ironlog://x?state=other&code=xyz&scope=activity:read', 's1')).toMatchObject({ ok: false });
    const noActivity = parseRedirect('ironlog://x?state=s1&code=xyz&scope=read', 's1');
    expect(noActivity.ok).toBe(false);
  });

  it('extracts the callback domain Strava validates against', () => {
    expect(callbackDomain('exp://192.168.1.20:8081/--/strava-redirect')).toBe('192.168.1.20');
    expect(callbackDomain('ironlog://localhost/strava-redirect')).toBe('localhost');
  });

  it('keeps only runs and maps fields', () => {
    const base: StravaActivity = {
      id: 11223344556,
      name: 'Lunch Run',
      sport_type: 'Run',
      start_date: '2026-10-01T16:30:00Z',
      distance: 8046.7,
      moving_time: 2400.4,
      elapsed_time: 2550,
      total_elevation_gain: 42,
      average_heartrate: 151.2,
    };
    expect(isRunActivity(base)).toBe(true);
    expect(isRunActivity({ ...base, sport_type: 'TrailRun' })).toBe(true);
    expect(isRunActivity({ ...base, sport_type: 'Ride' })).toBe(false);
    expect(isRunActivity({ ...base, sport_type: undefined, type: 'Run' })).toBe(true);
    expect(toRunInput(base)).toEqual({
      source: 'strava',
      externalId: '11223344556',
      name: 'Lunch Run',
      startedAt: Date.UTC(2026, 9, 1, 16, 30),
      distanceM: 8046.7,
      movingTimeSec: 2400,
      elapsedTimeSec: 2550,
      elevationGainM: 42,
      avgHeartrate: 151.2,
      sportType: 'Run',
      notes: null,
    });
  });

  it('parses token responses and keeps the athlete name across refreshes', () => {
    const first = parseTokenResponse({ access_token: 'a', refresh_token: 'r', expires_at: 2000, athlete: { firstname: 'Sam', lastname: 'Lee' } });
    expect(first.athleteName).toBe('Sam Lee');
    const refreshed = parseTokenResponse({ access_token: 'b', refresh_token: 'r2', expires_at: 4000 }, first);
    expect(refreshed).toMatchObject({ accessToken: 'b', refreshToken: 'r2', athleteName: 'Sam Lee' });
    expect(() => parseTokenResponse({ message: 'Bad Request' })).toThrow('Strava: Bad Request');
  });

  it('refreshes tokens a minute before expiry', () => {
    const tokens = parseTokenResponse({ access_token: 'a', refresh_token: 'r', expires_at: 1000 });
    expect(needsRefresh(tokens, 900_000)).toBe(false);
    expect(needsRefresh(tokens, 950_000)).toBe(true);
  });
});

describe('run helpers', () => {
  const run = (id: number, distanceM: number, movingTimeSec: number): Run => ({
    id,
    source: 'manual',
    externalId: null,
    name: 'Run',
    startedAt: id,
    distanceM,
    movingTimeSec,
    elapsedTimeSec: movingTimeSec,
    elevationGainM: null,
    avgHeartrate: null,
    sportType: 'Run',
    notes: null,
    healthSynced: false,
  });

  it('summarizes totals, longest and fastest 5k+', () => {
    const s = summarizeRuns([run(1, 5000, 1500), run(2, 10000, 3300), run(3, 3000, 780)]);
    expect(s.count).toBe(3);
    expect(s.distanceM).toBe(18000);
    expect(s.longest?.id).toBe(2);
    // Run 1 is 5:00/km, run 2 is 5:30/km; the 3 km run is too short to count.
    expect(s.fastest5k?.id).toBe(1);
  });

  it('validates manual entries', () => {
    expect(validateManualRun(0, 100)).toMatch(/distance/);
    expect(validateManualRun(5000, 0)).toMatch(/long/);
    expect(validateManualRun(5000, 300)).toMatch(/world record/);
    expect(validateManualRun(5000, 1500)).toBeNull();
  });
});
