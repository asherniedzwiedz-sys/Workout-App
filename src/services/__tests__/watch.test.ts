// The phone side of the watch protocol, against the real workout and rest-timer stores.

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('../../../modules/watch-bridge', () => ({ __esModule: true, default: null }));
jest.mock('@/db/kv', () => ({ getKv: jest.fn(async (_k: string, f: unknown) => f), setKv: jest.fn(async () => {}), deleteKv: jest.fn(async () => {}) }));
jest.mock('@/db/workouts', () => ({ getPreviousSets: jest.fn(async () => ({})), saveFinishedWorkout: jest.fn(async () => 42) }));
jest.mock('@/db/routines', () => ({
  listRoutines: jest.fn(async () => []),
  getRoutine: jest.fn(async (id: number) => ({ id, name: 'Legs', notes: null, source: 'manual', createdAt: 0, updatedAt: 0, exercises: [{ exerciseId: 'back-squat', sets: 2, reps: 5, weight: 225, restSec: 180 }] })),
}));
jest.mock('@/services/notifications', () => ({ scheduleRestNotification: jest.fn(async () => null), cancelNotification: jest.fn(async () => {}) }));
jest.mock('@/services/health', () => ({ syncWorkoutToHealth: jest.fn(async () => false) }));
jest.mock('@/services/feedback', () => ({ setCompleted: jest.fn(), errorBuzz: jest.fn() }));

import { router } from 'expo-router';

import { handleWatchAction } from '../watch';
import { useActiveWorkout } from '@/state/activeWorkout';
import { useRestTimer } from '@/state/restTimer';

beforeEach(async () => {
  await useActiveWorkout.getState().discard();
  useRestTimer.getState().stop();
});

it('starts a routine from the watch and logs a set with the weight chosen on the wrist', async () => {
  await handleWatchAction({ action: 'startRoutine', routineId: 9 });
  const workout = useActiveWorkout.getState().workout!;
  expect(workout.name).toBe('Legs');
  expect(router.push).toHaveBeenCalledWith('/workout');

  const squat = workout.exercises[0]!;
  await handleWatchAction({ action: 'completeSet', exerciseKey: squat.key, setId: squat.sets[0]!.id, weight: 235, reps: 5 });
  const logged = useActiveWorkout.getState().workout!.exercises[0]!.sets[0]!;
  expect(logged).toMatchObject({ weight: 235, reps: 5, completed: true });
  // Completing a set starts the exercise's rest timer, which then shows on the watch.
  expect(useRestTimer.getState().endsAt).not.toBeNull();

  await handleWatchAction({ action: 'adjustRest', delta: 30 });
  expect(useRestTimer.getState().durationSec).toBe(210);
  await handleWatchAction({ action: 'skipRest' });
  expect(useRestTimer.getState().endsAt).toBeNull();
});

it('ignores a duplicate completion and does not start a second workout', async () => {
  await handleWatchAction({ action: 'startRoutine', routineId: 9 });
  const squat = useActiveWorkout.getState().workout!.exercises[0]!;
  const setId = squat.sets[0]!.id;
  await handleWatchAction({ action: 'completeSet', exerciseKey: squat.key, setId, weight: null, reps: null });
  await handleWatchAction({ action: 'completeSet', exerciseKey: squat.key, setId, weight: null, reps: null });
  expect(useActiveWorkout.getState().workout!.exercises[0]!.sets[0]!.completed).toBe(true);
  const id = useActiveWorkout.getState().workout!.id;
  await handleWatchAction({ action: 'startRoutine', routineId: 9 });
  expect(useActiveWorkout.getState().workout!.id).toBe(id);
});

it('finishes the workout from the watch', async () => {
  await handleWatchAction({ action: 'startRoutine', routineId: 9 });
  const squat = useActiveWorkout.getState().workout!.exercises[0]!;
  await handleWatchAction({ action: 'completeSet', exerciseKey: squat.key, setId: squat.sets[0]!.id, weight: null, reps: null });
  await handleWatchAction({ action: 'finishWorkout' });
  expect(useActiveWorkout.getState().workout).toBeNull();
  expect(router.replace).toHaveBeenCalledWith('/history/42?finished=1');
});
