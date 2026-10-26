import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { labelName, WRIST_SEED_IDS } from '@/logic/exercises';
import { fmtDate } from '@/logic/stats';
import { deleteRecording, exportRecordings, listRecordings, type Recording } from '@/motion';
import { RecordPanel } from '@/RecordPanel';
import { Button, Card, Chip, H, Muted, Row, Screen } from '@/ui';
import { onWatchEvent } from '@/watch';

/** "other" = walking around, re-racking, adjusting the bench: the classifier's Other / Rest class. */
const LABELS = [...WRIST_SEED_IDS, 'other'];

export default function CollectData() {
  const [label, setLabel] = useState(LABELS[0]!);
  const [recs, setRecs] = useState<Recording[]>([]);
  const refresh = useCallback(() => setRecs(listRecordings()), []);
  useFocusEffect(refresh);
  useEffect(() => onWatchEvent((m) => m.type === 'file' && refresh()), [refresh]);

  return (
    <>
      <Stack.Screen options={{ title: 'Collect Data' }} />
      <Screen>
        <Muted>Pick the label, tap Start, do one set, tap End, confirm the real rep count. Raw 50 Hz motion is saved on this phone only.</Muted>
        <H>Label</H>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {LABELS.map((id) => <Chip key={id} label={labelName(id)} active={label === id} onPress={() => setLabel(id)} />)}
        </View>
        <Card>
          <RecordPanel exerciseId={label} kind="collect" onSaved={() => setTimeout(refresh, 1500)} />
        </Card>
        <Button title={`Export ${recs.length} as CSV`} icon="share-outline" variant="secondary" disabled={!recs.length} onPress={() => void exportRecordings().catch((e: Error) => Alert.alert('Export', e.message))} />
        <H>Recordings</H>
        {recs.length === 0 && <Muted>Files arrive from the Watch a few seconds after you save (keep both apps open the first time).</Muted>}
        {recs.map((r) => (
          <Row
            key={r.file.uri}
            title={`${labelName(r.exerciseId)} · ${r.actualReps} reps (counted ${r.countedReps})`}
            subtitle={`${r.kind} · ${r.wrist} wrist · ${fmtDate(r.startedAt)} · ${Math.round(r.bytes / 1024)} KB`}
            onLongPress={() =>
              Alert.alert('Delete recording?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => (deleteRecording(r), refresh()) },
              ])
            }
          />
        ))}
      </Screen>
    </>
  );
}
