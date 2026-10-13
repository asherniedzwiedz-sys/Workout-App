// Apple Health is iOS-only; health.ios.ts holds the real implementation. This file is
// what Android and the web build get: every call reports Health as unavailable.

export type HealthSupport = 'available' | 'expo-go' | 'unsupported';

export function healthSupport(): HealthSupport {
  return 'unsupported';
}

export async function connectHealth(): Promise<boolean> {
  return false;
}

export async function syncWorkoutToHealth(_workoutId: number): Promise<boolean> {
  return false;
}

export async function syncRunToHealth(_runId: number): Promise<boolean> {
  return false;
}

export async function syncPendingToHealth(): Promise<{ workouts: number; runs: number }> {
  return { workouts: 0, runs: 0 };
}
