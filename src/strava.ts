import { makeRedirectUri } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { addRun, lastStravaRunAt } from './db';
import { formEncode, isRun, queryParams, toRun, type StravaActivity } from './logic/strava';

WebBrowser.maybeCompleteAuthSession();

type Creds = { clientId: string; clientSecret: string };
type Tokens = { access_token: string; refresh_token: string; expires_at: number; athlete?: { firstname?: string; lastname?: string } };

// Credentials and tokens live in the iOS Keychain, never in SQLite or logs.
const CREDS = 'strava.creds';
const TOKENS = 'strava.tokens';

const read = async <T,>(key: string): Promise<T | null> => {
  const raw = await SecureStore.getItemAsync(key);
  return raw ? (JSON.parse(raw) as T) : null;
};

export const getStravaCreds = () => read<Creds>(CREDS);
export const setStravaCreds = (c: Creds) => SecureStore.setItemAsync(CREDS, JSON.stringify({ clientId: c.clientId.trim(), clientSecret: c.clientSecret.trim() }));
export async function stravaAthlete(): Promise<string | null> {
  const t = await read<Tokens>(TOKENS);
  return t ? [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(' ') || 'Strava athlete' : null;
}

/** Expo Go: exp://<LAN-IP>:8081/--/strava. Dev build: liftlog://localhost/strava. */
export const stravaRedirectUri = () => makeRedirectUri({ native: 'liftlog://localhost/strava', path: 'strava' });

async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  const r = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formEncode(body),
  });
  if (!r.ok) throw new Error(`Strava token request failed (${r.status}). Check your client ID/secret.`);
  return (await r.json()) as Tokens;
}

export async function connectStrava(): Promise<string> {
  const creds = await getStravaCreds();
  if (!creds?.clientId || !creds.clientSecret) throw new Error('Enter your Strava client ID and secret first.');
  const redirectUri = stravaRedirectUri();
  const state = Crypto.randomUUID();
  const url = `https://www.strava.com/oauth/mobile/authorize?${formEncode({
    client_id: creds.clientId, redirect_uri: redirectUri, response_type: 'code', approval_prompt: 'auto', scope: 'read,activity:read_all', state,
  })}`;
  const res = await WebBrowser.openAuthSessionAsync(url, redirectUri);
  if (res.type !== 'success') throw new Error('Strava sign-in was cancelled.');
  const p = queryParams(res.url);
  if (p.state !== state) throw new Error('Strava sign-in failed a security check (state mismatch). Try again.');
  if (p.error || !p.code) throw new Error(`Strava denied access${p.error ? ` (${p.error})` : ''}.`);
  if (!p.scope?.includes('activity:read')) throw new Error('Allow "View data about your activities" so runs can be imported.');
  const tokens = await tokenRequest({ client_id: creds.clientId, client_secret: creds.clientSecret, code: p.code, grant_type: 'authorization_code' });
  await SecureStore.setItemAsync(TOKENS, JSON.stringify(tokens));
  return (await stravaAthlete()) ?? 'Strava athlete';
}

async function accessToken(): Promise<string> {
  const t = await read<Tokens>(TOKENS);
  const creds = await getStravaCreds();
  if (!t || !creds) throw new Error('Connect Strava in Settings first.');
  if (t.expires_at * 1000 - 60_000 > Date.now()) return t.access_token;
  const fresh = await tokenRequest({ client_id: creds.clientId, client_secret: creds.clientSecret, grant_type: 'refresh_token', refresh_token: t.refresh_token });
  await SecureStore.setItemAsync(TOKENS, JSON.stringify({ ...t, ...fresh }));
  return fresh.access_token;
}

/** Imports runs since the last import (with a week of overlap so edits on Strava are picked up). Returns runs upserted. */
export async function importStravaRuns(): Promise<number> {
  const token = await accessToken();
  const last = lastStravaRunAt();
  const after = last ? Math.floor((last - 7 * 86_400_000) / 1000) : 0;
  let count = 0;
  for (let page = 1; page <= 30; page++) {
    const r = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=100&page=${page}${after ? `&after=${after}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.status === 429) throw new Error('Strava rate limit reached. Try again in 15 minutes.');
    if (r.status === 401) throw new Error('Strava access expired or was revoked. Reconnect in Settings.');
    if (!r.ok) throw new Error(`Strava request failed (${r.status}).`);
    const list = (await r.json()) as StravaActivity[];
    for (const a of list.filter(isRun)) {
      addRun(toRun(a));
      count++;
    }
    if (list.length < 100) break;
  }
  return count;
}

export async function disconnectStrava() {
  const t = await read<Tokens>(TOKENS);
  if (t) await fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formEncode({ access_token: t.access_token }) }).catch(() => {});
  await SecureStore.deleteItemAsync(TOKENS);
}
