import { getDb, parseJson } from './client';

export async function getKv<T>(key: string, fallback: T): Promise<T> {
  const row = await getDb().getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return parseJson<T>(row?.value, fallback);
}

export async function setKv(key: string, value: unknown): Promise<void> {
  await getDb().runAsync(
    'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    JSON.stringify(value),
  );
}

export async function deleteKv(key: string): Promise<void> {
  await getDb().runAsync('DELETE FROM kv WHERE key = ?', key);
}
