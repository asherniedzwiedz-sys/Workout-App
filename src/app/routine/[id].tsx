import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { deleteRoutine, getExercise, getRoutine, saveRoutine, type RoutineExercise } from '@/db';
import { pickExercise } from '@/ExerciseList';
import { C } from '@/theme';
import { Button, Card, Ionicons, Muted, NumInput, s, Screen, Stepper } from '@/ui';

export default function RoutineEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = id === 'new' ? null : getRoutine(Number(id));
  const [name, setName] = useState(existing?.name ?? '');
  const [items, setItems] = useState<RoutineExercise[]>(existing?.exercises ?? []);

  const patch = (i: number, p: Partial<RoutineExercise>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) =>
    setItems((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  const add = () =>
    pickExercise((exerciseId) => {
      const e = getExercise(exerciseId);
      if (e) setItems((xs) => [...xs, { exercise_id: e.id, name: e.name, sets: 3, reps: e.compound ? 8 : 12, weight: 0, rest_sec: null }]);
    });

  const save = () => {
    if (!name.trim()) return Alert.alert('Name your routine');
    saveRoutine({ id: existing?.id, name: name.trim(), exercises: items });
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: existing ? 'Edit Routine' : 'New Routine', headerRight: () => <Button title="Save" variant="ghost" onPress={save} /> }} />
      <Screen>
        <TextInput style={s.textInput} placeholder="Routine name (e.g. Push A)" placeholderTextColor={C.muted} value={name} onChangeText={setName} />
        {items.map((it, i) => (
          <Card key={`${it.exercise_id}-${i}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: C.accent, fontSize: 17, fontWeight: '800', flex: 1 }}>{it.name}</Text>
              <Pressable onPress={() => move(i, -1)} hitSlop={8} accessibilityLabel="Move up"><Ionicons name="arrow-up" size={22} color={C.muted} /></Pressable>
              <Pressable onPress={() => move(i, 1)} hitSlop={8} accessibilityLabel="Move down"><Ionicons name="arrow-down" size={22} color={C.muted} /></Pressable>
              <Pressable onPress={() => setItems((xs) => xs.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel="Remove"><Ionicons name="trash-outline" size={22} color={C.danger} /></Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <Stepper value={it.sets} min={1} label="sets" onChange={(v) => patch(i, { sets: v })} />
              <Stepper value={it.reps} min={1} label="reps" onChange={(v) => patch(i, { reps: v })} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <NumInput decimal value={it.weight} onChange={(v) => patch(i, { weight: v })} accessibilityLabel="Default weight" />
                <Muted>lbs</Muted>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <NumInput value={it.rest_sec ?? 0} onChange={(v) => patch(i, { rest_sec: v || null })} accessibilityLabel="Rest seconds" />
                <Muted>sec rest</Muted>
              </View>
            </View>
          </Card>
        ))}
        <Muted>Weight 0 = use what you lifted last time. Rest blank = the exercise default.</Muted>
        <Button title="Add Exercise" icon="add" variant="secondary" onPress={add} />
        <Button title="Save Routine" onPress={save} />
        {existing && (
          <Button
            title="Delete Routine"
            variant="ghost"
            onPress={() =>
              Alert.alert('Delete routine?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => (deleteRoutine(existing.id), router.back()) },
              ])
            }
          />
        )}
      </Screen>
    </>
  );
}
