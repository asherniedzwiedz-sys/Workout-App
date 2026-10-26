import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useSyncExternalStore } from 'react';
import { Vibration } from 'react-native';

export type Rest = { endsAt: number; total: number } | null;

let rest: Rest = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let notificationId: string | undefined;
let player: AudioPlayer | undefined;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
export const getRest = () => rest;
export function onRestChange(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}
export const useRest = () => useSyncExternalStore(onRestChange, getRest);

/** Shared by phone-logged and watch-logged sets. 0 = rest timer off for that exercise. */
export function startRest(seconds: number) {
  if (seconds <= 0) return stopRest();
  rest = { endsAt: Date.now() + seconds * 1000, total: seconds };
  arm();
}

export function adjustRest(deltaSec: number) {
  if (!rest) return;
  rest = { endsAt: Math.max(Date.now() + 1000, rest.endsAt + deltaSec * 1000), total: Math.max(1, rest.total + deltaSec) };
  arm();
}

export function stopRest() {
  disarm();
  rest = null;
  emit();
}

function disarm() {
  clearTimeout(timer);
  if (notificationId) void Notifications.cancelScheduledNotificationAsync(notificationId);
  notificationId = undefined;
}

function arm() {
  disarm();
  if (!rest) return;
  const ms = rest.endsAt - Date.now();
  timer = setTimeout(finish, ms);
  emit();
  // JS timers pause when the phone locks; this notification is what beeps in your pocket.
  void Notifications.scheduleNotificationAsync({
    content: { title: 'Rest over', body: 'Next set — go.', sound: 'default', data: { kind: 'rest' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.round(ms / 1000)) },
  }).then((id) => (rest ? (notificationId = id) : void Notifications.cancelScheduledNotificationAsync(id)), () => {});
}

function finish() {
  const lateMs = rest ? Date.now() - rest.endsAt : Infinity;
  rest = null;
  notificationId = undefined;
  emit();
  if (lateMs > 3000) return; // app was suspended; the notification already alerted
  Vibration.vibrate([0, 400, 150, 400]);
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  if (!player) {
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' });
    player = createAudioPlayer(require('../assets/beep.wav'));
  }
  void player.seekTo(0).then(() => player?.play());
}
