import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

// The Strava OAuth redirect normally returns straight to WebBrowser.openAuthSessionAsync.
// If the OS opens the link in the app instead, land somewhere sensible.
WebBrowser.maybeCompleteAuthSession();

export default function StravaRedirect() {
  return <Redirect href="/strava" />;
}
