/**
 * Motion recordings are CSV files the watch writes and sends with WCSession.transferFile.
 * Metadata rides in the file name so the phone can list them without reading 100s of KB each.
 * Keep in sync with Recording.fileName in targets/watch/MotionCore/MotionCSV.swift.
 */
export type RecordingKind = 'collect' | 'calibration' | 'correction';
export type RecordingMeta = {
  kind: RecordingKind; exerciseId: string; wrist: 'left' | 'right'; dominantHand: 'left' | 'right';
  actualReps: number; countedReps: number; startedAt: number;
};

/** Column order shared by the watch writer, the phone export and ml/train.ipynb. */
export const CSV_HEADER = 'session_id,exercise_id,kind,wrist,dominant_hand,actual_reps,counted_reps,t,ax,ay,az,rx,ry,rz,gx,gy,gz,roll,pitch,yaw';

export const recordingName = (m: RecordingMeta) =>
  `${m.kind}__${m.exerciseId}__${m.wrist}-${m.dominantHand}__a${m.actualReps}__c${m.countedReps}__${m.startedAt}.csv`;

const NAME = /^(collect|calibration|correction)__([a-z0-9-]+)__(left|right)-(left|right)__a(\d+)__c(\d+)__(\d+)\.csv$/;

export function parseRecordingName(name: string): RecordingMeta | null {
  const m = NAME.exec(name);
  if (!m) return null;
  return {
    kind: m[1] as RecordingKind, exerciseId: m[2]!, wrist: m[3] as 'left' | 'right', dominantHand: m[4] as 'left' | 'right',
    actualReps: Number(m[5]), countedReps: Number(m[6]), startedAt: Number(m[7]),
  };
}
