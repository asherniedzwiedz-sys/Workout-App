import { Stack } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { EXERCISE_BY_ID, WRIST_SEED_IDS } from '@/logic/exercises';
import { RecordPanel } from '@/RecordPanel';
import { C } from '@/theme';
import { Body, Button, Card, Chip, H, Muted, Screen } from '@/ui';

const SETS_PER_EXERCISE = 2;

export default function Calibrate() {
  const [picked, setPicked] = useState<string[]>(['dumbbell-curl', 'dumbbell-bench-press', 'dumbbell-row']);
  const [step, setStep] = useState<number | null>(null);
  const total = picked.length * SETS_PER_EXERCISE;

  if (step === null)
    return (
      <>
        <Stack.Screen options={{ title: 'Calibrate' }} />
        <Screen>
          <Body>
            Calibration records {SETS_PER_EXERCISE} sets × 8–10 reps of each exercise you pick, labeled automatically, as your personal dataset. Wear the Watch on the wrist you set, use your normal form and a normal working weight.
          </Body>
          <Muted>Calibration does not retrain anything on the Watch. Export the CSV and rebuild ExerciseClassifier.mlmodel on your Mac (ml/README.md); the training script weights your personal sets above the generic data.</Muted>
          <H>Exercises</H>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {WRIST_SEED_IDS.map((id) => {
              const on = picked.includes(id);
              return <Chip key={id} label={EXERCISE_BY_ID.get(id)!.name} active={on} onPress={() => setPicked(on ? picked.filter((x) => x !== id) : [...picked, id])} />;
            })}
          </View>
          <Button title={`Start (${total} sets)`} disabled={!picked.length} onPress={() => setStep(0)} />
        </Screen>
      </>
    );

  if (step >= total)
    return (
      <Screen>
        <H>Calibration recorded</H>
        <Body>{total} labeled sets were saved to your personal dataset on this phone.</Body>
        <Muted>Next: Motion Detection → Export, AirDrop the CSV to your Mac, run ml/train.ipynb, then rebuild the watch app with the new ExerciseClassifier.mlmodel.</Muted>
        <Button title="Done" onPress={() => setStep(null)} />
      </Screen>
    );

  const exerciseId = picked[Math.floor(step / SETS_PER_EXERCISE)]!;
  const setNo = (step % SETS_PER_EXERCISE) + 1;
  return (
    <Screen>
      <Muted>Step {step + 1} of {total}</Muted>
      <Text style={{ color: C.accent, fontSize: 24, fontWeight: '800' }}>{EXERCISE_BY_ID.get(exerciseId)!.name}</Text>
      <Body>Set {setNo} of {SETS_PER_EXERCISE}: do 8–10 controlled reps. Stand still for 3 seconds before you start and after you finish.</Body>
      <Card>
        <RecordPanel key={step} exerciseId={exerciseId} kind="calibration" onSaved={() => setStep(step + 1)} />
      </Card>
      <Button title="Skip this set" variant="ghost" onPress={() => setStep(step + 1)} />
    </Screen>
  );
}
