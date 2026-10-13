// Apple Health sync. Implemented in phase 7; until then every call is a no-op.

export async function syncRunToHealth(_runId: number): Promise<boolean> {
  return false;
}

export async function syncWorkoutToHealth(_workoutId: number): Promise<boolean> {
  return false;
}
