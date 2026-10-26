import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useState } from 'react';

/** Runs a sync DB query on every render and re-renders whenever any table changes (watch sets, imports, edits). */
export function useQuery<T>(query: () => T): T {
  const [, setTick] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = addDatabaseChangeListener(() => {
      timer ??= setTimeout(() => {
        timer = undefined;
        setTick((t) => t + 1);
      }, 30);
    });
    return () => {
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, []);
  return query();
}

/** Current time, refreshed every `ms` (elapsed workout time, countdowns). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
