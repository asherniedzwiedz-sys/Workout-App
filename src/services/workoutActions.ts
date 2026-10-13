import { router } from 'expo-router';

import { confirm } from '@/components/dialogs';
import type { Routine } from '@/domain/types';
import { useActiveWorkout } from '@/state/activeWorkout';

import { ensureNotificationPermission } from './notifications';

/** Only one workout can be active; ask before replacing it. */
async function canStartNew(): Promise<boolean> {
  if (!useActiveWorkout.getState().workout) return true;
  const replace = await confirm({
    title: 'Workout already in progress',
    message: 'Discard the current workout and start a new one?',
    confirmText: 'Discard & start',
    destructive: true,
  });
  if (replace) await useActiveWorkout.getState().discard();
  return replace;
}

export async function startEmptyWorkout(): Promise<void> {
  if (!(await canStartNew())) return;
  // Rest-timer alerts need notification permission; ask once, up front.
  void ensureNotificationPermission();
  await useActiveWorkout.getState().startEmpty();
  router.push('/workout');
}

export async function startRoutineWorkout(routine: Routine): Promise<void> {
  if (!(await canStartNew())) return;
  void ensureNotificationPermission();
  await useActiveWorkout.getState().startRoutine(routine);
  router.push('/workout');
}
