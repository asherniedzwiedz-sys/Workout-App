import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { saveRoutine } from '@/db';
import { EQUIPMENT, EXERCISE_BY_ID, type Equipment } from '@/logic/exercises';
import { alternatives, dayMinutes, generatePlan, replaceExercise, WEEKDAYS, type GenInput, type PlanDay } from '@/logic/generator';
import { fmtDuration } from '@/logic/stats';
import { C } from '@/theme';
import { Button, Card, Chip, H, Muted, Row, Screen } from '@/ui';

const cap = (t: string) => t[0]!.toUpperCase() + t.slice(1);
const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export default function Generate() {
  const [input, setInput] = useState<GenInput>({ goal: 'hypertrophy', days: 3, equipment: [...EQUIPMENT], minutes: 60, seed: newSeed() });
  const [plan, setPlan] = useState<PlanDay[] | null>(null);
  const set = (p: Partial<GenInput>) => {
    const next = { ...input, ...p };
    setInput(next);
    if (plan) setPlan(generatePlan(next));
  };
  const toggleGear = (g: Equipment) =>
    set({ equipment: input.equipment.includes(g) ? input.equipment.filter((x) => x !== g) : [...input.equipment, g] });

  const tweak = (di: number, ei: number) => {
    if (!plan) return;
    const alts = alternatives(plan, di, ei, input);
    const current = EXERCISE_BY_ID.get(plan[di]!.exercises[ei]!.exerciseId)!;
    if (!alts.length) return Alert.alert(current.name, 'No other exercise fits this slot with your equipment.');
    const pick = (id: string) => setPlan(replaceExercise(plan, di, ei, id, input.goal));
    Alert.alert(`Replace ${current.name}`, undefined, [
      { text: 'Shuffle', onPress: () => pick(alts[Math.floor(Math.random() * alts.length)]!.id) },
      ...alts.slice(0, 6).map((a) => ({ text: a.name, onPress: () => pick(a.id) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const save = () => {
    if (!plan) return;
    for (const d of plan) {
      saveRoutine({ name: `${d.name} (${WEEKDAYS[d.weekday]})`, exercises: d.exercises.map((e) => ({ exercise_id: e.exerciseId, sets: e.sets, reps: e.reps, weight: 0, rest_sec: e.restSec })) });
    }
    Alert.alert('Saved', `${plan.length} routine${plan.length > 1 ? 's' : ''} added. Weights pre-fill from your last session.`);
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: 'AI Workout Builder' }} />
      <Screen>
        <Muted>Runs on your phone, no account or API key. Builds a push/pull/legs-based split, varies exercises across the week, and never hits the same muscle on back-to-back days.</Muted>
        <H>Goal</H>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['strength', 'hypertrophy'] as const).map((g) => <Chip key={g} label={cap(g)} active={input.goal === g} onPress={() => set({ goal: g })} />)}
        </View>
        <H>Days per week</H>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[1, 2, 3, 4, 5, 6].map((d) => <Chip key={d} label={String(d)} active={input.days === d} onPress={() => set({ days: d })} />)}
        </View>
        <H>Equipment</H>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {EQUIPMENT.map((g) => <Chip key={g} label={cap(g)} active={input.equipment.includes(g)} onPress={() => toggleGear(g)} />)}
        </View>
        <H>Session length</H>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[30, 45, 60, 75, 90].map((m) => <Chip key={m} label={`${m} min`} active={input.minutes === m} onPress={() => set({ minutes: m })} />)}
        </View>
        <Button title={plan ? 'Regenerate' : 'Generate'} icon="sparkles" onPress={() => { const next = { ...input, seed: newSeed() }; setInput(next); setPlan(generatePlan(next)); }} />

        {plan?.map((d, di) => (
          <Card key={`${d.name}-${di}`}>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '800' }}>
              {WEEKDAYS[d.weekday]} · {d.name} <Text style={{ color: C.muted, fontWeight: '400' }}>~{Math.round(dayMinutes(d))} min</Text>
            </Text>
            {d.exercises.map((e, ei) => (
              <Row
                key={`${e.exerciseId}-${ei}`}
                title={EXERCISE_BY_ID.get(e.exerciseId)?.name ?? e.exerciseId}
                subtitle={`${e.sets} × ${e.reps} · rest ${fmtDuration(e.restSec * 1000)} · tap to swap`}
                onPress={() => tweak(di, ei)}
              />
            ))}
          </Card>
        ))}
        {plan && <Button title={`Save ${plan.length} Routine${plan.length > 1 ? 's' : ''}`} variant="success" onPress={save} />}
      </Screen>
    </>
  );
}
