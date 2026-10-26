import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { CSV_HEADER, parseRecordingName, type RecordingMeta } from './logic/recording';

export type Recording = RecordingMeta & { file: File; bytes: number };

/** Where react-native-watch-connectivity copies files the watch sends (app Documents, never uploaded). */
const received = () => new Directory(Paths.document, 'FilesReceived');

export function listRecordings(): Recording[] {
  const dir = received();
  if (!dir.exists) return [];
  return dir
    .list()
    .flatMap((f) => {
      const meta = f instanceof File ? parseRecordingName(f.name) : null;
      return meta && f instanceof File ? [{ ...meta, file: f, bytes: f.size ?? 0 }] : [];
    })
    .sort((a, b) => b.startedAt - a.startedAt);
}

export const deleteRecording = (r: Recording) => r.file.delete();

/** Merges every recording into one long CSV in Documents/exports and opens the Share Sheet. */
export async function exportRecordings(filter: (r: Recording) => boolean = () => true) {
  const recs = listRecordings().filter(filter);
  if (!recs.length) throw new Error('No recordings yet. Collect or calibrate a few sets first.');
  const parts = [CSV_HEADER];
  for (const r of recs) {
    const body = (await r.file.text()).split('\n').slice(1).filter(Boolean);
    parts.push(...body);
  }
  const dir = new Directory(Paths.document, 'exports');
  if (!dir.exists) dir.create();
  const out = new File(dir, `liftlog-motion-${new Date().toISOString().slice(0, 10)}-${recs.length}sets.csv`);
  if (out.exists) out.delete();
  out.create();
  await out.write(parts.join('\n') + '\n');
  await Sharing.shareAsync(out.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
}
