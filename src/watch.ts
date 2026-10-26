/**
 * Phone side of the Apple Watch link (Phases 8 + 9F). The phone stays the source of truth:
 * the watch sends confirmed sets, the phone writes them with the same code path as phone-logged sets
 * and pushes the current workout / routines / rest timer back as WCSession application context.
 */
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useSyncExternalStore } from 'react';
import {
  activeWorkout, finishWorkout, getRoutine, lastWeight, listRoutines, loadWorkout, logWatchSet, startWorkout, type WatchSet,
} from './db';
import { saveWorkoutToHealth } from './health';
import { EXERCISE_BY_ID, WRIST_SEED_IDS } from './logic/exercises';
import { hasDevBuildModules } from './native';
import { getRest, onRestChange, startRest } from './restTimer';
import { getSettings, onSettingsChange } from './settings';

type RNWC = typeof import('react-native-watch-connectivity');
type Payload = Record<string, unknown>;

let W: RNWC | null = null;
let reachable = false;
let pushTimer: ReturnType<typeof setTimeout> | undefined;
const acks: string[] = [];
const reachListeners = new Set<() => void>();
const eventListeners = new Set<(msg: Payload) => void>();

export function initWatch() {
  if (W || !hasDevBuildModules) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must not load in Expo Go
    W = require('react-native-watch-connectivity') as RNWC;
  } catch {
    return;
  }
  W.watchEvents.on('message', (msg, reply) => reply?.(handle(msg)));
  W.watchEvents.on('user-info', (items) => items.forEach(handle));
  W.watchEvents.on('file-received', () => eventListeners.forEach((l) => l({ type: 'file' })));
  W.watchEvents.on('reachability', setReachable);
  void W.getReachability().then(setReachable, () => {});
  addDatabaseChangeListener(schedulePush);
  onSettingsChange(schedulePush);
  onRestChange(schedulePush);
  schedulePush();
}

function setReachable(r: boolean) {
  reachable = r;
  reachListeners.forEach((l) => l());
  if (r) schedulePush();
}

export const useWatchReachable = () =>
  useSyncExternalStore(
    (l) => (reachListeners.add(l), () => void reachListeners.delete(l)),
    () => reachable,
  );

/** Live events from the watch (data collection status, received files). */
export function onWatchEvent(l: (msg: Payload) => void) {
  eventListeners.add(l);
  return () => void eventListeners.delete(l);
}

/** Request/response to the watch app; rejects when it isn't reachable (watch app must be open). */
export function sendToWatch(msg: Payload): Promise<Payload> {
  return new Promise((resolve, reject) => {
    if (!W || !reachable) return reject(new Error('Open Liftlog on your Apple Watch first.'));
    W.sendMessage(clean(msg), (reply) => resolve(reply), reject);
  });
}

/** Uids the phone has stored; sent back in the app context so the watch can clear its outbox. */
function ack(uid: string) {
  acks.push(uid);
  acks.splice(0, Math.max(0, acks.length - 200));
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Every inbound message; must never throw (it answers the watch's reply handler). */
function handle(msg: Payload): Payload {
  try {
    switch (msg.type) {
      case 'set': {
        const set = msg as unknown as WatchSet;
        const rest = logWatchSet(set);
        ack(set.uid);
        // Same as a phone-logged set: start the rest timer, unless this is a late queued delivery.
        if (rest !== null && Date.now() - set.endedAt < 120_000) startRest(rest);
        schedulePush();
        return { ok: true, uid: set.uid };
      }
      case 'start':
        startWorkout(num(msg.routineId) ?? null, num(msg.at) ?? Date.now());
        return { ok: true, uid: msg.uid };
      case 'finish': {
        const active = activeWorkout();
        if (active && active.started_at <= (num(msg.at) ?? Date.now())) {
          const done = finishWorkout(active.id, num(msg.at));
          if (done) void saveWorkoutToHealth(done.id);
        }
        if (typeof msg.uid === 'string') ack(msg.uid);
        schedulePush();
        return { ok: true, uid: msg.uid };
      }
      case 'collect':
        eventListeners.forEach((l) => l(msg));
        return { ok: true };
      default:
        return { ok: false, error: `unknown message type ${String(msg.type)}` };
    }
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function schedulePush() {
  if (!W) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushContext, 300);
}

type CtxExercise = { id: string; name: string; motion?: string; restSec: number; sets: number; done?: number; reps: number; weight: number };

function pushContext() {
  if (!W) return;
  const s = getSettings();
  const active = activeWorkout();
  const loaded = active ? loadWorkout(active.id) : null;
  const ctx = {
    v: 1,
    sentAt: Date.now(),
    settings: { wrist: s.wrist, dominantHand: s.dominantHand, autoDetect: s.autoDetect, devMode: s.devMode },
    active: loaded && {
      workoutId: loaded.workout.id,
      name: loaded.workout.name,
      routineId: loaded.workout.routine_id,
      startedAt: loaded.workout.started_at,
      exercises: loaded.exercises
        .filter((we) => !we.skipped)
        .map((we): CtxExercise => {
          const next = we.sets.find((x) => !x.done) ?? we.sets[we.sets.length - 1];
          return {
            id: we.exercise_id, name: we.name, motion: we.motion ?? undefined, restSec: we.rest_sec, sets: we.sets.length,
            done: we.sets.filter((x) => x.done).length, reps: next?.reps ?? 10, weight: next?.weight ?? lastWeight(we.exercise_id),
          };
        }),
    },
    routines: listRoutines().map((r) => ({
      id: r.id,
      name: r.name,
      exercises: (getRoutine(r.id)?.exercises ?? []).map((e): CtxExercise => {
        const def = EXERCISE_BY_ID.get(e.exercise_id);
        return {
          id: e.exercise_id, name: e.name, motion: def?.motion, restSec: e.rest_sec ?? def?.restSec ?? 90,
          sets: e.sets, reps: e.reps, weight: e.weight > 0 ? e.weight : lastWeight(e.exercise_id),
        };
      }),
    })),
    lastWeights: Object.fromEntries(WRIST_SEED_IDS.map((id) => [id, lastWeight(id)])),
    restEndsAt: getRest()?.endsAt,
    acks,
  };
  try {
    W.updateApplicationContext(clean(ctx));
  } catch (e) {
    console.warn('watch context push failed', e);
  }
}

/** WCSession payloads must be property lists: no null (NSNull) or undefined anywhere. */
const clean = (v: object): Payload => JSON.parse(JSON.stringify(v, (_k, x) => (x === null ? undefined : x)));
