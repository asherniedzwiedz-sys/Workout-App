// Exercises the Strava service end to end with fetch, Keychain and the DB mocked.

const mockSecrets = new Map<string, string>();
const mockKv = new Map<string, unknown>();
const mockUpserted: unknown[][] = [];

jest.mock('../secureStorage', () => ({
  getSecret: jest.fn(async (k: string) => mockSecrets.get(k) ?? null),
  setSecret: jest.fn(async (k: string, v: string) => void mockSecrets.set(k, v)),
  deleteSecret: jest.fn(async (k: string) => void mockSecrets.delete(k)),
}));
jest.mock('@/db/kv', () => ({
  getKv: jest.fn(async (k: string, fallback: unknown) => (mockKv.has(k) ? mockKv.get(k) : fallback)),
  setKv: jest.fn(async (k: string, v: unknown) => void mockKv.set(k, v)),
}));
jest.mock('@/db/runs', () => ({
  latestStravaStart: jest.fn(async () => null),
  upsertStravaRuns: jest.fn(async (runs: unknown[]) => {
    mockUpserted.push(runs);
    return runs.length;
  }),
}));
jest.mock('../runtime', () => ({ isExpoGo: false }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'state-123' }));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'exp://10.0.0.5:8081/--/strava-redirect' }));

import * as WebBrowser from 'expo-web-browser';

import { connect, getCallbackDomain, getStatus, saveCredentials, StravaAuthError, syncRuns } from '../strava';

type FetchCall = { url: string; init?: RequestInit };
let calls: FetchCall[] = [];

function json(status: number, body: unknown) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response);
}

function activity(id: number, sport: string) {
  return { id, name: `A${id}`, sport_type: sport, start_date: '2026-10-01T12:00:00Z', distance: 5000, moving_time: 1500, elapsed_time: 1550 };
}

beforeEach(() => {
  mockSecrets.clear();
  mockKv.clear();
  mockUpserted.length = 0;
  calls = [];
});

it('uses localhost as the callback domain in a development build', () => {
  expect(getCallbackDomain()).toBe('localhost');
});

it('connects: opens the consent page, exchanges the code and stores tokens', async () => {
  await saveCredentials('999', 'shh');
  (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
    type: 'success',
    url: 'ironlog://localhost/strava-redirect?state=state-123&code=CODE&scope=read,activity:read_all',
  });
  globalThis.fetch = jest.fn((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return json(200, { access_token: 'AT', refresh_token: 'RT', expires_at: Date.now() / 1000 + 3600, athlete: { firstname: 'Ash' } });
  }) as unknown as typeof fetch;

  const athlete = await connect();
  expect(athlete).toBe('Ash');
  const [authUrl] = (WebBrowser.openAuthSessionAsync as jest.Mock).mock.calls[0] as [string];
  expect(authUrl).toContain('client_id=999');
  expect(authUrl).toContain(encodeURIComponent('ironlog://localhost/strava-redirect'));
  expect(calls[0]!.url).toBe('https://www.strava.com/oauth/token');
  expect(String(calls[0]!.init?.body)).toContain('grant_type=authorization_code');
  expect(String(calls[0]!.init?.body)).toContain('code=CODE');
  expect((await getStatus()).connected).toBe(true);
});

it('refreshes an expired token, pages through activities and imports only runs', async () => {
  await saveCredentials('999', 'shh');
  mockSecrets.set('strava_tokens', JSON.stringify({ accessToken: 'OLD', refreshToken: 'RT', expiresAt: 1, athleteName: 'Ash', scope: 'activity:read' }));
  const page1 = Array.from({ length: 100 }, (_, i) => activity(i + 1, i % 2 === 0 ? 'Run' : 'Ride'));
  const page2 = [activity(500, 'TrailRun'), activity(501, 'Swim')];
  globalThis.fetch = jest.fn((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.includes('/oauth/token')) return json(200, { access_token: 'NEW', refresh_token: 'RT2', expires_at: Date.now() / 1000 + 3600 });
    if (url.includes('page=1&')) return json(200, page1);
    return json(200, page2);
  }) as unknown as typeof fetch;

  const result = await syncRuns();
  expect(String(calls[0]!.init?.body)).toContain('grant_type=refresh_token');
  const apiCalls = calls.filter((c) => c.url.includes('/athlete/activities'));
  expect(apiCalls).toHaveLength(2);
  expect((apiCalls[0]!.init?.headers as Record<string, string>).Authorization).toBe('Bearer NEW');
  expect(result).toEqual({ imported: 51, checked: 102 });
  expect(JSON.parse(mockSecrets.get('strava_tokens')!).accessToken).toBe('NEW');
  expect(mockKv.get('strava_last_sync')).toEqual(expect.any(Number));
});

it('reports revoked access as an auth error', async () => {
  await saveCredentials('999', 'shh');
  mockSecrets.set('strava_tokens', JSON.stringify({ accessToken: 'AT', refreshToken: 'RT', expiresAt: Date.now() / 1000 + 3600, athleteName: null, scope: '' }));
  globalThis.fetch = jest.fn(() => json(401, { message: 'Authorization Error' })) as unknown as typeof fetch;
  await expect(syncRuns()).rejects.toBeInstanceOf(StravaAuthError);
});

it('asks for credentials before connecting', async () => {
  await expect(connect()).rejects.toThrow('client ID and secret');
});
