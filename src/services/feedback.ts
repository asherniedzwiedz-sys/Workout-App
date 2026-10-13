import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

// Sound and vibration cues. Everything here is best-effort: failures are swallowed
// so a missing audio session never breaks set logging.

let player: AudioPlayer | null = null;

export async function initSound(): Promise<void> {
  try {
    // Mix with the user's music instead of pausing it, and play even with the ringer off.
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
    player = createAudioPlayer(require('../../assets/sounds/rest-done.wav'));
  } catch (error) {
    console.warn('Rest timer sound unavailable', error);
  }
}

export function playRestDoneSound(): void {
  if (!player) return;
  try {
    void player.seekTo(0).then(() => player?.play());
  } catch {
    // ignore
  }
}

export function vibrateRestDone(): void {
  if (Platform.OS === 'web') return;
  Vibration.vibrate([0, 400, 200, 400]);
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function tap(): void {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function setCompleted(): void {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function errorBuzz(): void {
  if (Platform.OS === 'web') return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
