import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useDataVersion } from '@/state/dataVersion';

/**
 * Runs an async loader on mount, whenever `deps` change, when the screen regains
 * focus, and after any write that calls notifyDataChanged().
 */
export function useData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const version = useDataVersion((s) => s.version);
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const result = await loaderRef.current();
      if (id === requestId.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (id === requestId.current) setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, reload, ...deps]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { data, error, loading, reload };
}
