import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { getRoutine } from '@/db/routines';
import { startRoutineWorkout } from '@/services/workoutActions';
import { useActiveWorkout } from '@/state/activeWorkout';

import { confirm } from './dialogs';

/**
 * Handles taps on our notifications (also when they launch the app):
 * - rest timer → back to the active workout
 * - routine reminder → offer to start that routine
 */
export function NotificationResponder() {
  if (Platform.OS === 'web') return null;
  return <Responder />;
}

function Responder() {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    Notifications.clearLastNotificationResponse();

    const data = response.notification.request.content.data as { kind?: string; routineId?: number | null } | undefined;
    if (data?.kind === 'rest') {
      if (useActiveWorkout.getState().workout) router.push('/workout');
      return;
    }
    if (data?.kind === 'reminder') {
      void (async () => {
        if (useActiveWorkout.getState().workout) {
          router.push('/workout');
          return;
        }
        const routine = data.routineId ? await getRoutine(data.routineId) : null;
        if (!routine) {
          router.navigate('/');
          return;
        }
        if (await confirm({ title: `Start ${routine.name}?`, message: `${routine.exercises.length} exercises`, confirmText: 'Start' })) {
          await startRoutineWorkout(routine);
        }
      })();
    }
  }, [response]);

  return null;
}
