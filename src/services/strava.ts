import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';

import { getKv, setKv } from '@/db/kv';
import { latestStravaStart, upsertStravaRuns } from '@/db/runs';
import {
  buildAuthorizeUrl,
  callbackDomain,
  isRunActivity,
  needsRefresh,
  parseRedirect,
  parseTokenResponse,
  STRAVA_API,
  STRAVA_DEAUTHORIZE_URL,
  STRAVA_TOKEN_URL,
  toQuery,
  toRunInput,
  type StravaActivity,
  type StravaTokens,
} from '@/domain/strava';

import { isExpoGo } from './runtime';
import { deleteSecret, getSecret, setSecret } from './secureStorage';

// The Strava client secret and tokens are kept in the iOS Keychain (expo-secure-store).
// Because there is no backend, the code-for-token exchange happens on the phone with
// your own client secret. That's fine for a personal app; don't ship it to others.

const KEY_CLIENT_ID = 'strava_client_id';
const KEY_CLIENT_SECRET = 'strava_client_secret';
const KEY_TOKENS = 'strava_tokens';
const KV_LAST_SYNC = 'strava_last_sync';

export class StravaAuthError extends Error {}

export interface StravaStatus {
  clientId: string | null;
  hasSecret: boolean;
  connected: boolean;
  athleteName: string | null;
  lastSyncAt: number | null;
}

/**
 * Expo Go can only receive exp://<your computer's IP>:8081/--/… links, so the Strava
 * callback domain must be that IP. A development build uses ironlog://localhost/…,
 * and Strava always allows "localhost".
 */
export function getRedirectUri(): string {
  if (isExpoGo) return AuthSession.makeRedirectUri({ path: 'strava-redirect' });
  return 'ironlog://localhost/strava-redirect';
}

export function getCallbackDomain(): string {
  return callbackDomain(getRedirectUri());
}

export async function getStatus(): Promise<StravaStatus> {
  const [clientId, secret, tokens, lastSyncAt] = await Promise.all([
    getSecret(KEY_CLIENT_ID),
    getSecret(KEY_CLIENT_SECRET),
    loadTokens(),
    getKv<number | null>(KV_LAST_SYNC, null),
  ]);
  return {
    clientId,
    hasSecret: !!secret,
    connected: !!tokens,
    athleteName: tokens?.athleteName ?? null,
    lastSyncAt,
  };
}

export async function saveCredentials(clientId: string, clientSecret: string): Promise<void> {
  await setSecret(KEY_CLIENT_ID, clientId.trim());
  if (clientSecret.trim()) await setSecret(KEY_CLIENT_SECRET, clientSecret.trim());
}

async function loadTokens(): Promise<StravaTokens | null> {
  const raw = await getSecret(KEY_TOKENS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StravaTokens;
  } catch {
    return null;
  }
}

async function storeTokens(tokens: StravaTokens): Promise<void> {
  await setSecret(KEY_TOKENS, JSON.stringify(tokens));
}

async function credentials(): Promise<{ clientId: string; clientSecret: string }> {
  const [clientId, clientSecret] = await Promise.all([getSecret(KEY_CLIENT_ID), getSecret(KEY_CLIENT_SECRET)]);
  if (!clientId || !clientSecret) throw new StravaAuthError('Add your Strava client ID and secret first.');
  return { clientId, clientSecret };
}

async function tokenRequest(params: Record<string, string>): Promise<unknown> {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: toQuery(params),
  });
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (json as { message?: string } | null)?.message ?? `HTTP ${response.status}`;
    throw new StravaAuthError(`Strava rejected the request: ${message}. Check your client ID and secret.`);
  }
  return json;
}

/** Opens Strava's consent page and stores tokens on success. */
export async function connect(): Promise<string | null> {
  const { clientId, clientSecret } = await credentials();
  const redirectUri = getRedirectUri();
  const state = Crypto.randomUUID();
  const result = await WebBrowser.openAuthSessionAsync(buildAuthorizeUrl(clientId, redirectUri, state), redirectUri);
  if (result.type !== 'success') return null;
  const parsed = parseRedirect(result.url, state);
  if (!parsed.ok) throw new StravaAuthError(parsed.error);
  const json = await tokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    code: parsed.code,
    grant_type: 'authorization_code',
  });
  const tokens = { ...parseTokenResponse(json), scope: parsed.scope };
  await storeTokens(tokens);
  return tokens.athleteName;
}

async function validAccessToken(): Promise<string> {
  const tokens = await loadTokens();
  if (!tokens) throw new StravaAuthError('Connect your Strava account first.');
  if (!needsRefresh(tokens, Date.now())) return tokens.accessToken;
  const { clientId, clientSecret } = await credentials();
  const json = await tokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
  });
  const refreshed = parseTokenResponse(json, tokens);
  await storeTokens(refreshed);
  return refreshed.accessToken;
}

export async function disconnect(): Promise<void> {
  const tokens = await loadTokens();
  if (tokens) {
    try {
      await fetch(STRAVA_DEAUTHORIZE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: toQuery({ access_token: tokens.accessToken }),
      });
    } catch {
      // Offline: still forget the tokens locally.
    }
  }
  await deleteSecret(KEY_TOKENS);
}

export async function forgetCredentials(): Promise<void> {
  await disconnect();
  await deleteSecret(KEY_CLIENT_ID);
  await deleteSecret(KEY_CLIENT_SECRET);
}

export interface SyncResult {
  imported: number;
  checked: number;
}

/**
 * Imports runs from Strava. Incremental by default (from a day before the newest
 * imported run); `full` re-reads the whole history (up to 2,000 activities).
 */
export async function syncRuns(options: { full?: boolean } = {}): Promise<SyncResult> {
  const token = await validAccessToken();
  const newest = options.full ? null : await latestStravaStart();
  const after = newest ? Math.floor(newest / 1000) - 86_400 : 0;
  const activities: StravaActivity[] = [];
  for (let page = 1; page <= 20; page++) {
    const response = await fetch(`${STRAVA_API}/athlete/activities?${toQuery({ after, page, per_page: 100 })}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 401) {
      throw new StravaAuthError('Strava access expired or was revoked. Reconnect your account.');
    }
    if (response.status === 429) {
      throw new Error('Strava rate limit reached. Try again in 15 minutes.');
    }
    if (!response.ok) throw new Error(`Strava returned HTTP ${response.status}.`);
    const batch = (await response.json()) as StravaActivity[];
    activities.push(...batch);
    if (batch.length < 100) break;
  }
  const runs = activities.filter(isRunActivity).map(toRunInput).filter((r) => Number.isFinite(r.startedAt));
  const imported = await upsertStravaRuns(runs);
  await setKv(KV_LAST_SYNC, Date.now());
  return { imported, checked: activities.length };
}
