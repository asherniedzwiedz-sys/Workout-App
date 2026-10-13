import { create } from 'zustand';

import { listAllExercises } from '@/db/exercises';
import type { Exercise } from '@/domain/types';

// In-memory copy of the exercise table. Almost every screen needs names and tags,
// so it is loaded once at startup and refreshed after edits.
interface ExerciseState {
  list: Exercise[];
  byId: Record<string, Exercise>;
  load: () => Promise<void>;
}

export const useExercises = create<ExerciseState>((set) => ({
  list: [],
  byId: {},
  load: async () => {
    const all = await listAllExercises();
    const byId: Record<string, Exercise> = {};
    for (const e of all) byId[e.id] = e;
    set({ list: all.sort((a, b) => a.name.localeCompare(b.name)), byId });
  },
}));

export function getExercise(id: string): Exercise | undefined {
  return useExercises.getState().byId[id];
}

export function exerciseName(id: string): string {
  return useExercises.getState().byId[id]?.name ?? 'Unknown exercise';
}
