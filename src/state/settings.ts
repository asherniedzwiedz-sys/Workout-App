import { create } from 'zustand';

import { getKv, setKv } from '@/db/kv';
import type { DistanceUnit } from '@/domain/format';

export interface Settings {
  distanceUnit: DistanceUnit;
  /** Start the rest timer automatically when a set is checked off. */
  autoStartRest: boolean;
  restSound: boolean;
  restVibrate: boolean;
  keepAwake: boolean;
  /** Write finished workouts to Apple Health (development build only). */
  healthSync: boolean;
  /** Used for the calorie estimate sent to Apple Health. */
  bodyWeightLbs: number | null;
  barWeight: number;
  /** Mirror the active workout to the Apple Watch app (development build only). */
  watchSync: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  distanceUnit: 'mi',
  autoStartRest: true,
  restSound: true,
  restVibrate: true,
  keepAwake: true,
  healthSync: false,
  bodyWeightLbs: null,
  barWeight: 45,
  watchSync: true,
};

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  load: async () => {
    const stored = await getKv<Partial<Settings>>('settings', {});
    set({ settings: { ...DEFAULT_SETTINGS, ...stored }, loaded: true });
  },
  update: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    await setKv('settings', next);
  },
}));

export function getSettings(): Settings {
  return useSettings.getState().settings;
}
