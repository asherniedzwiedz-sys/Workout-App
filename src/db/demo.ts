import { estimateOneRepMax } from '@/domain/oneRepMax';
import type { FinishedWorkout } from '@/domain/workout';

import { saveFinishedWorkout } from './workouts';

const DAY = 86_400_000;

interface Template {
  name: string;
  lifts: { id: string; start: number; step: number; sets: number; reps: number }[];
}

const TEMPLATES: Template[] = [
  {
    name: 'Push',
    lifts: [
      { id: 'barbell-bench-press', start: 165, step: 2.5, sets: 4, reps: 6 },
      { id: 'overhead-press', start: 95, step: 1.25, sets: 3, reps: 6 },
      { id: 'dumbbell-lateral-raise', start: 15, step: 0.25, sets: 3, reps: 12 },
      { id: 'triceps-pushdown', start: 40, step: 0.75, sets: 3, reps: 12 },
    ],
  },
  {
    name: 'Pull',
    lifts: [
      { id: 'barbell-row', start: 135, step: 2.5, sets: 4, reps: 8 },
      { id: 'lat-pulldown', start: 110, step: 1.5, sets: 3, reps: 10 },
      { id: 'face-pull', start: 30, step: 0.5, sets: 3, reps: 15 },
      { id: 'dumbbell-curl', start: 25, step: 0.25, sets: 3, reps: 10 },
    ],
  },
  {
    name: 'Legs',
    lifts: [
      { id: 'back-squat', start: 205, step: 5, sets: 4, reps: 5 },
      { id: 'romanian-deadlift', start: 155, step: 2.5, sets: 3, reps: 8 },
      { id: 'leg-press', start: 270, step: 5, sets: 3, reps: 10 },
      { id: 'standing-calf-raise', start: 120, step: 2, sets: 3, reps: 12 },
    ],
  },
];

function round5(n: number): number {
  return Math.round(n / 5) * 5;
}

/**
 * Writes ~10 weeks of Push/Pull/Legs history with steady progression and the odd
 * bad day, so charts and PR badges have something to show. Used from Settings.
 */
export async function seedDemoHistory(now = Date.now(), weeks = 10): Promise<number> {
  let count = 0;
  const firstMonday = new Date(now - weeks * 7 * DAY);
  firstMonday.setHours(18, 0, 0, 0);
  firstMonday.setDate(firstMonday.getDate() - ((firstMonday.getDay() + 6) % 7));
  for (let week = 0; week < weeks; week++) {
    for (const [dayIndex, template] of TEMPLATES.entries()) {
      const start = firstMonday.getTime() + (week * 7 + dayIndex * 2) * DAY;
      if (start > now - DAY) continue;
      // Every fourth session of a lift is a slightly off day.
      const session = week;
      const exercises = template.lifts.map((lift) => {
        const off = session % 4 === 3 ? -1 : 0;
        const weight = Math.max(5, round5(lift.start + lift.step * session * 2) + off * 10);
        return {
          exerciseId: lift.id,
          notes: '',
          sets: Array.from({ length: lift.sets }, (_, i) => {
            const reps = Math.max(1, lift.reps - (i === lift.sets - 1 && session % 3 === 1 ? 1 : 0));
            return {
              type: 'normal' as const,
              weight,
              reps,
              e1rm: estimateOneRepMax(weight, reps),
              completedAt: start + (i + 1) * 3 * 60_000,
            };
          }),
        };
      });
      const totalSets = exercises.reduce((n, e) => n + e.sets.length, 0);
      const totalVolume = exercises.reduce((v, e) => v + e.sets.reduce((s, x) => s + x.weight * x.reps, 0), 0);
      const workout: FinishedWorkout = {
        name: `${template.name} Day`,
        routineId: null,
        startedAt: start,
        endedAt: start + (50 + dayIndex * 5) * 60_000,
        notes: '',
        exercises,
        totalSets,
        totalVolume,
      };
      await saveFinishedWorkout(workout);
      count++;
    }
  }
  return count;
}
