/** Subset of Strava's SummaryActivity we use. */
export type StravaActivity = {
  id: number; name?: string; sport_type?: string; type?: string;
  distance: number; moving_time: number; elapsed_time: number; start_date: string;
};

const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);

export const isRun = (a: StravaActivity) => RUN_TYPES.has(a.sport_type ?? a.type ?? '');

/** Pace uses moving time, like Strava does. */
export const toRun = (a: StravaActivity) => ({
  strava_id: String(a.id),
  name: a.name?.trim() || 'Run',
  started_at: Date.parse(a.start_date),
  distance_m: a.distance,
  duration_s: a.moving_time || a.elapsed_time,
  source: 'strava' as const,
});

export const formEncode = (o: Record<string, string>) =>
  Object.entries(o).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

/** Query params from a redirect URL (custom schemes included, where URL parsing is unreliable in RN). */
export function queryParams(url: string): Record<string, string> {
  const q = url.split('?')[1]?.split('#')[0] ?? '';
  return Object.fromEntries(
    q.split('&').filter(Boolean).map((kv) => {
      const [k = '', v = ''] = kv.split('=');
      return [decodeURIComponent(k), decodeURIComponent(v.replace(/\+/g, ' '))];
    }),
  );
}

/** Host part Strava checks against "Authorization Callback Domain". */
export const callbackDomain = (redirectUri: string) => /^[a-z][a-z0-9+.-]*:\/\/([^/:?#]+)/i.exec(redirectUri)?.[1] ?? '';
