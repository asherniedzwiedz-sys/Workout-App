// Pure Strava helpers: URL building, redirect parsing and activity mapping.
// Network and storage live in src/services/strava.ts.

export const STRAVA_AUTHORIZE_URL = 'https://www.strava.com/oauth/mobile/authorize';
export const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
export const STRAVA_DEAUTHORIZE_URL = 'https://www.strava.com/oauth/deauthorize';
export const STRAVA_API = 'https://www.strava.com/api/v3';
export const STRAVA_SCOPE = 'read,activity:read_all';

const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);

/** The subset of Strava's SummaryActivity that we use. */
export interface StravaActivity {
  id: number | string;
  name: string;
  type?: string;
  sport_type?: string;
  start_date: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
}

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch seconds, as returned by Strava. */
  expiresAt: number;
  athleteName: string | null;
  scope: string;
}

export interface RunInput {
  source: 'strava' | 'manual';
  externalId: string | null;
  name: string;
  startedAt: number;
  distanceM: number;
  movingTimeSec: number;
  elapsedTimeSec: number;
  elevationGainM: number | null;
  avgHeartrate: number | null;
  sportType: string;
  notes: string | null;
}

// Small query helpers instead of URLSearchParams, whose React Native support has been patchy.
export function toQuery(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

export function parseQuery(url: string): Record<string, string> {
  const start = url.indexOf('?');
  if (start < 0) return {};
  const query = (url.slice(start + 1).split('#')[0] ?? '').replace(/\+/g, ' ');
  const out: Record<string, string> = {};
  for (const part of query.split('&')) {
    if (!part) continue;
    const [k, v = ''] = part.split('=');
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return out;
}

export function buildAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const query = toQuery({
    client_id: clientId.trim(),
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: STRAVA_SCOPE,
    state,
  });
  return `${STRAVA_AUTHORIZE_URL}?${query}`;
}

export type RedirectResult =
  | { ok: true; code: string; scope: string }
  | { ok: false; error: string };

/** Reads Strava's redirect (…?state=&code=&scope= or …?error=access_denied). */
export function parseRedirect(url: string, expectedState: string): RedirectResult {
  const params = parseQuery(url);
  const error = params.error;
  if (error) return { ok: false, error: error === 'access_denied' ? 'You declined access on Strava.' : `Strava returned "${error}".` };
  if (params.state !== expectedState) return { ok: false, error: 'The sign-in response did not match this request. Try again.' };
  const code = params.code;
  if (!code) return { ok: false, error: 'Strava did not return an authorization code.' };
  const scope = params.scope ?? '';
  if (!hasActivityScope(scope)) {
    return { ok: false, error: 'Activity access is needed to import runs. Leave "View data about your activities" checked.' };
  }
  return { ok: true, code, scope };
}

export function hasActivityScope(scope: string): boolean {
  return scope.split(/[ ,]/).some((s) => s === 'activity:read' || s === 'activity:read_all');
}

/** Host part of a redirect URI; this is what Strava's "Authorization Callback Domain" must match. */
export function callbackDomain(redirectUri: string): string {
  const afterScheme = redirectUri.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const host = afterScheme.split(/[/?#]/)[0] ?? '';
  return host.replace(/:\d+$/, '');
}

export function isRunActivity(a: StravaActivity): boolean {
  return RUN_TYPES.has(a.sport_type ?? a.type ?? '');
}

export function toRunInput(a: StravaActivity): RunInput {
  return {
    source: 'strava',
    externalId: String(a.id),
    name: a.name?.trim() || 'Run',
    startedAt: Date.parse(a.start_date),
    distanceM: a.distance,
    movingTimeSec: Math.round(a.moving_time),
    elapsedTimeSec: Math.round(a.elapsed_time),
    elevationGainM: a.total_elevation_gain ?? null,
    avgHeartrate: a.average_heartrate ?? null,
    sportType: a.sport_type ?? a.type ?? 'Run',
    notes: null,
  };
}

/** Parses Strava's token response (authorization_code or refresh_token grant). */
export function parseTokenResponse(json: unknown, previous?: StravaTokens): StravaTokens {
  const body = json as {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    athlete?: { firstname?: string; lastname?: string };
    message?: string;
  };
  if (!body?.access_token || !body.refresh_token || !body.expires_at) {
    throw new Error(body?.message ? `Strava: ${body.message}` : 'Unexpected response from Strava.');
  }
  const name = body.athlete ? [body.athlete.firstname, body.athlete.lastname].filter(Boolean).join(' ') : null;
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: body.expires_at,
    athleteName: name || previous?.athleteName || null,
    scope: previous?.scope ?? STRAVA_SCOPE,
  };
}

/** Refresh a minute early so a request never goes out with an expiring token. */
export function needsRefresh(tokens: StravaTokens, nowMs: number): boolean {
  return tokens.expiresAt * 1000 - nowMs < 60_000;
}
