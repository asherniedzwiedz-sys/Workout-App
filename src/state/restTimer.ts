import { create } from 'zustand';

import { cancelNotification, scheduleRestNotification } from '@/services/notifications';

interface RestTimerState {
  endsAt: number | null;
  durationSec: number;
  /** Exercise the rest belongs to, shown in the timer bar. */
  label: string;
  /** What's next, used as the notification body (also shown on a paired Apple Watch). */
  nextUp: string;
  notificationId: string | null;
  start: (durationSec: number, label: string, nextUp: string) => void;
  adjust: (deltaSec: number) => void;
  stop: () => void;
  /** Clears state without cancelling the notification (it already fired). */
  clear: () => void;
}

let scheduleToken = 0;

async function reschedule(endsAt: number, body: string): Promise<void> {
  const token = ++scheduleToken;
  const previous = useRestTimer.getState().notificationId;
  await cancelNotification(previous);
  const id = await scheduleRestNotification(endsAt, body);
  // A newer start/adjust/stop happened while we were scheduling; drop this one.
  if (token !== scheduleToken) {
    await cancelNotification(id);
    return;
  }
  useRestTimer.setState({ notificationId: id });
}

export const useRestTimer = create<RestTimerState>((set, get) => ({
  endsAt: null,
  durationSec: 0,
  label: '',
  nextUp: '',
  notificationId: null,
  start: (durationSec, label, nextUp) => {
    if (durationSec <= 0) return;
    const endsAt = Date.now() + durationSec * 1000;
    set({ endsAt, durationSec, label, nextUp });
    void reschedule(endsAt, nextUp);
  },
  adjust: (deltaSec) => {
    const { endsAt, durationSec, nextUp } = get();
    if (endsAt === null) return;
    const nextEnd = endsAt + deltaSec * 1000;
    if (nextEnd <= Date.now() + 1000) {
      get().stop();
      return;
    }
    set({ endsAt: nextEnd, durationSec: Math.max(1, durationSec + deltaSec) });
    void reschedule(nextEnd, nextUp);
  },
  stop: () => {
    scheduleToken++;
    const id = get().notificationId;
    set({ endsAt: null, notificationId: null });
    void cancelNotification(id);
  },
  clear: () => {
    scheduleToken++;
    set({ endsAt: null, notificationId: null });
  },
}));
