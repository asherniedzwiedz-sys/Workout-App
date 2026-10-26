import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useNow } from './hooks';
import { fmtDuration } from './logic/stats';
import type { RecordingKind } from './logic/recording';
import { C } from './theme';
import { Button, Muted, Stepper } from './ui';
import { onWatchEvent, sendToWatch } from './watch';

type Phase = { name: 'idle' } | { name: 'recording'; since: number } | { name: 'review'; counted: number; actual: number };

/**
 * Remote control for a labeled recording on the watch: Start Set → End Set → confirm actual reps → Save.
 * The watch records 50 Hz deviceMotion and transfers the CSV to this phone's Documents folder.
 */
export function RecordPanel({ exerciseId, kind, hint, onSaved }: { exerciseId: string; kind: RecordingKind; hint?: string; onSaved?: () => void }) {
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [live, setLive] = useState(0);
  const now = useNow(500);
  useEffect(() => onWatchEvent((m) => m.type === 'collect' && typeof m.counted === 'number' && setLive(m.counted)), []);

  const call = async (msg: Record<string, unknown>) => {
    const reply = await sendToWatch(msg);
    if (reply.ok !== true) throw new Error(String(reply.error ?? 'Watch refused the command'));
    return reply;
  };
  const run = (f: () => Promise<void>) => f().catch((e: Error) => Alert.alert('Apple Watch', e.message));

  if (phase.name === 'idle')
    return (
      <View style={{ gap: 8 }}>
        {hint && <Muted>{hint}</Muted>}
        <Button title="Start Set" icon="radio-button-on" onPress={() => run(async () => { await call({ cmd: 'record', exerciseId, kind }); setLive(0); setPhase({ name: 'recording', since: Date.now() }); })} />
      </View>
    );

  if (phase.name === 'recording')
    return (
      <View style={{ gap: 8, alignItems: 'center' }}>
        <Text style={{ color: C.danger, fontWeight: '800' }}>● Recording {fmtDuration(now - phase.since)}</Text>
        <Text style={{ color: C.text, fontSize: 48, fontWeight: '800' }}>{live}</Text>
        <Muted>reps counted live on the watch</Muted>
        <Button
          title="End Set"
          variant="danger"
          style={{ alignSelf: 'stretch' }}
          onPress={() => run(async () => {
            const r = await call({ cmd: 'stop' });
            const counted = typeof r.counted === 'number' ? r.counted : live;
            setPhase({ name: 'review', counted, actual: counted });
          })}
        />
      </View>
    );

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: C.text, fontSize: 16 }}>Watch counted <Text style={{ fontWeight: '800' }}>{phase.counted}</Text>. How many reps did you actually do?</Text>
      <Stepper value={phase.actual} onChange={(actual) => setPhase({ ...phase, actual })} label="reps" />
      <Button title="Save labeled set" variant="success" onPress={() => run(async () => { await call({ cmd: 'save', actualReps: phase.actual }); setPhase({ name: 'idle' }); onSaved?.(); })} />
      <Button title="Discard" variant="ghost" onPress={() => run(async () => { await call({ cmd: 'discard' }); setPhase({ name: 'idle' }); })} />
    </View>
  );
}
