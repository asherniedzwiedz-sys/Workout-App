import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

export type Hand = 'left' | 'right';
export type Settings = {
  healthSync: boolean;
  /** Which wrist the Watch is on; flips the sign of motion axes, so it's sent with every recording. */
  wrist: Hand;
  dominantHand: Hand;
  /** Watch auto-detects sets (predict-and-confirm). Off = manual logging on the Watch. */
  autoDetect: boolean;
  /** Unlocks the hidden Collect Data screens on phone + watch. */
  devMode: boolean;
};

const DEFAULTS: Settings = { healthSync: true, wrist: 'left', dominantHand: 'right', autoDetect: true, devMode: false };

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(Storage.getItemSync('settings') ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

let current = load();
const listeners = new Set<() => void>();

export const getSettings = () => current;

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  Storage.setItemSync('settings', JSON.stringify(current));
  listeners.forEach((l) => l());
}

export function onSettingsChange(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}

export const useSettings = () => useSyncExternalStore(onSettingsChange, getSettings);
