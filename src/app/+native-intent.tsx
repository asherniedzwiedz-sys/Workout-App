// Rewrites system deep links before Expo Router resolves them. The Strava OAuth
// redirect in development builds is ironlog://localhost/strava-redirect, which would
// otherwise look like a "/localhost/..." route.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (path.includes('strava-redirect')) return '/strava';
  return path;
}
