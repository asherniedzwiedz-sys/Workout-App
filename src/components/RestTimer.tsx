import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatClock } from '@/domain/format';
import { useNow } from '@/hooks/useNow';
import { playRestDoneSound, vibrateRestDone } from '@/services/feedback';
import { useRestTimer } from '@/state/restTimer';
import { getSettings } from '@/state/settings';
import { colors, radius, space } from '@/theme';

import { showActionSheet } from './ActionSheet';

export const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

export function formatRest(sec: number): string {
  return sec === 0 ? 'Off' : formatClock(sec);
}

/**
 * Mounted once at the root. Fires the in-app sound + vibration when a rest ends
 * while the app is open. If the app was in the background, the scheduled
 * notification already alerted the user, so the timer just clears.
 */
export function RestTimerWatcher() {
  const endsAt = useRestTimer((s) => s.endsAt);
  useEffect(() => {
    if (endsAt === null) return;
    const check = () => {
      const current = useRestTimer.getState().endsAt;
      if (current === null || Date.now() < current) return;
      const late = Date.now() - current;
      if (AppState.currentState === 'active' && late < 3000) {
        useRestTimer.getState().stop();
        const settings = getSettings();
        if (settings.restSound) playRestDoneSound();
        if (settings.restVibrate) vibrateRestDone();
      } else {
        useRestTimer.getState().clear();
      }
    };
    const interval = setInterval(check, 250);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [endsAt]);
  return null;
}

/** Big countdown bar shown at the bottom of the workout screen while resting. */
export function RestTimerBar() {
  const { endsAt, durationSec, label, adjust, stop } = useRestTimer();
  const now = useNow(250, endsAt !== null);
  if (endsAt === null) return null;
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const progress = durationSec > 0 ? Math.min(1, Math.max(0, remaining / durationSec)) : 0;

  return (
    <View style={styles.bar} testID="rest-timer-bar">
      <View style={[styles.progress, { width: `${progress * 100}%` }]} />
      <View style={styles.content}>
        <Pressable style={styles.adjust} onPress={() => adjust(-15)} accessibilityLabel="Subtract 15 seconds" testID="rest-minus">
          <Text style={styles.adjustText}>−15</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.time} testID="rest-remaining">
            {formatClock(remaining)}
          </Text>
          <Text style={styles.label} numberOfLines={1}>
            Rest · {label}
          </Text>
        </View>
        <Pressable style={styles.adjust} onPress={() => adjust(15)} accessibilityLabel="Add 15 seconds" testID="rest-plus">
          <Text style={styles.adjustText}>+15</Text>
        </Pressable>
        <Pressable style={[styles.adjust, styles.skip]} onPress={stop} accessibilityLabel="Skip rest" testID="rest-skip">
          <Ionicons name="play-skip-forward" size={22} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

/** Opens a sheet to start a rest timer manually. */
export function pickManualRest(label: string, nextUp: string) {
  showActionSheet({
    title: 'Start rest timer',
    options: REST_OPTIONS.filter((s) => s > 0).map((s) => ({
      label: formatRest(s),
      icon: 'timer-outline',
      onPress: () => useRestTimer.getState().start(s, label, nextUp),
    })),
  });
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.accentDim,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginHorizontal: space.md,
    marginBottom: space.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  progress: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(76,141,255,0.35)' },
  content: { flexDirection: 'row', alignItems: 'center', padding: space.sm, gap: space.sm },
  center: { flex: 1, alignItems: 'center' },
  time: { color: colors.text, fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  label: { color: colors.textDim, fontSize: 13 },
  adjust: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skip: { width: 48 },
  adjustText: { color: colors.text, fontSize: 17, fontWeight: '700' },
});
