import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CustomExerciseModal } from '@/components/CustomExerciseModal';
import { filterExercises } from '@/components/ExercisePicker';
import { Button, Chip, Divider, Field, ListItem } from '@/components/ui';
import { EQUIPMENT, MUSCLE_GROUPS, type Equipment, type MuscleGroup } from '@/domain/types';
import { useExercises } from '@/state/exercises';
import { colors, font, space } from '@/theme';

export default function ExercisesTab() {
  const all = useExercises((s) => s.list);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [creating, setCreating] = useState(false);

  // The store keeps archived customs so old history still has names; hide them here.
  const visible = useMemo(() => all.filter((e) => !e.archived), [all]);
  const results = useMemo(() => filterExercises(visible, query, muscle, equipment), [visible, query, muscle, equipment]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <Field value={query} onChangeText={setQuery} placeholder={`Search ${all.length} exercises`} autoCorrect={false} clearButtonMode="while-editing" testID="exercise-search" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chips}>
        <Chip label="All muscles" selected={muscle === null} onPress={() => setMuscle(null)} />
        {MUSCLE_GROUPS.map((m) => (
          <Chip key={m} label={m} selected={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} testID={`filter-${m}`} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chips}>
        <Chip label="All equipment" selected={equipment === null} onPress={() => setEquipment(null)} />
        {EQUIPMENT.map((e) => (
          <Chip key={e} label={e} selected={equipment === e} onPress={() => setEquipment(equipment === e ? null : e)} testID={`filter-${e}`} />
        ))}
      </ScrollView>
      <Text style={[font.tiny, { paddingHorizontal: space.lg, paddingTop: space.sm }]}>{results.length} exercises</Text>
      <FlatList
        data={results}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: space.sm }}
        ItemSeparatorComponent={Divider}
        keyboardDismissMode="on-drag"
        ListFooterComponent={
          <Button title="Create custom exercise" icon="add-circle-outline" variant="ghost" onPress={() => setCreating(true)} style={{ marginTop: space.md }} testID="create-custom-exercise" />
        }
        renderItem={({ item }) => (
          <ListItem
            title={item.name}
            subtitle={`${item.primaryMuscle} · ${item.equipment}${item.isCustom ? ' · custom' : ''}`}
            capitalize
            onPress={() => router.push(`/exercise/${item.id}`)}
            testID={`exercise-row-${item.id}`}
          />
        )}
      />
      <CustomExerciseModal visible={creating} onClose={() => setCreating(false)} onCreated={(id) => router.push(`/exercise/${id}`)} />
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md },
});
