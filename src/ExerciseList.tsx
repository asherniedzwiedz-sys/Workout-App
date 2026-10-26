import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, TextInput, View } from 'react-native';
import { listExercises, type Exercise } from './db';
import { useQuery } from './hooks';
import { EQUIPMENT, MUSCLES } from './logic/exercises';
import { C } from './theme';
import { Chip, Ionicons, Row, s } from './ui';

let pending: ((exerciseId: string) => void) | null = null;

/** Opens the picker modal; the callback gets the chosen exercise id. */
export function pickExercise(onPick: (exerciseId: string) => void) {
  pending = onPick;
  router.push('/pick-exercise');
}

export function resolvePick(exerciseId: string) {
  const cb = pending;
  pending = null;
  router.back();
  cb?.(exerciseId);
}

const cap = (t: string) => t[0]!.toUpperCase() + t.slice(1);

export function ExerciseList({ onSelect }: { onSelect: (e: Exercise) => void }) {
  const all = useQuery(listExercises);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (e) => (!needle || e.name.toLowerCase().includes(needle)) && (!muscle || e.muscle === muscle || e.secondary.split(',').includes(muscle)) && (!equipment || e.equipment === equipment),
    );
  }, [all, q, muscle, equipment]);

  return (
    <FlatList
      style={s.screen}
      contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      data={items}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 6 }}>
          <TextInput style={s.textInput} placeholder="Search exercises" placeholderTextColor={C.muted} value={q} onChangeText={setQ} clearButtonMode="while-editing" autoCorrect={false} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {MUSCLES.map((m) => <Chip key={m} label={cap(m)} active={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />)}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {EQUIPMENT.map((eq) => <Chip key={eq} label={cap(eq)} active={equipment === eq} onPress={() => setEquipment(equipment === eq ? null : eq)} />)}
          </ScrollView>
        </View>
      }
      renderItem={({ item }) => (
        <Row
          title={item.name}
          subtitle={`${cap(item.muscle)} · ${cap(item.equipment)}`}
          onPress={() => onSelect(item)}
          right={item.motion === 'wrist' ? <Ionicons name="watch-outline" size={18} color={C.success} accessibilityLabel="Watch can detect" /> : undefined}
        />
      )}
    />
  );
}
