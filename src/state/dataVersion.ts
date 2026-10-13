import { create } from 'zustand';

// A counter bumped after every write. Screens using useData() re-query when it changes,
// which keeps lists in sync without a full reactive query layer.
interface DataVersionState {
  version: number;
  bump: () => void;
}

export const useDataVersion = create<DataVersionState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

export function notifyDataChanged(): void {
  useDataVersion.getState().bump();
}
