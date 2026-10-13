import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EQUIPMENT, MUSCLE_GROUPS, type Equipment, type Exercise, type MuscleGroup } from '@/domain/types';
import { useExercises } from '@/state/exercises';
import { colors, font, space } from '@/theme';

import { CustomExerciseModal } from './CustomExerciseModal';
import { Button, Chip, Field } from './ui';

export function filterExercises(
  list: Exercise[],
  query: string,
  muscle: MuscleGroup | null,
  equipment: Equipment | null,
): Exercise[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((e) => {
    if (muscle && e.primaryMuscle !== muscle && !e.secondaryMuscles.includes(muscle)) return false;
    if (equipment && e.equipment !== equipment) return false;
    if (terms.length === 0) return true;
    const haystack = `${e.name} ${e.primaryMuscle} ${e.equipment}`.toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}

const NO_IDS: string[] = [];

export function ExercisePicker({
  visible,
  onClose,
  onPick,
  multi = true,
  title = 'Add exercises',
  initialMuscle = null,
  excludeIds = NO_IDS,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (ids: string[]) => void;
  multi?: boolean;
  title?: string;
  initialMuscle?: MuscleGroup | null;
  excludeIds?: string[];
}) {
  const all = useExercises((s) => s.list);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(initialMuscle);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelected([]);
      setQuery('');
      setMuscle(initialMuscle);
      setEquipment(null);
    }
  }, [visible, initialMuscle]);

  const active = useMemo(() => all.filter((e) => !e.archived && !excludeIds.includes(e.id)), [all, excludeIds]);
  const results = useMemo(() => filterExercises(active, query, muscle, equipment), [active, query, muscle, equipment]);

  const toggle = (id: string) => {
    if (!multi) {
      onPick([id]);
      onClose();
      return;
    }
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Button title="Cancel" variant="ghost" size="sm" onPress={onClose} />
          <Text style={font.subheading}>{title}</Text>
          {multi ? (
            <Button
              title={selected.length ? `Add (${selected.length})` : 'Add'}
              variant="ghost"
              size="sm"
              disabled={selected.length === 0}
              testID="picker-add"
              onPress={() => {
                onPick(selected);
                onClose();
              }}
            />
          ) : (
            <View style={{ width: 70 }} />
          )}
        </View>
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
          <Field
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises"
            autoCorrect={false}
            clearButtonMode="while-editing"
            testID="picker-search"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
          <Chip label="All muscles" selected={muscle === null} onPress={() => setMuscle(null)} />
          {MUSCLE_GROUPS.map((m) => (
            <Chip key={m} label={m} selected={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
          <Chip label="All equipment" selected={equipment === null} onPress={() => setEquipment(null)} />
          {EQUIPMENT.map((e) => (
            <Chip key={e} label={e} selected={equipment === e} onPress={() => setEquipment(equipment === e ? null : e)} />
          ))}
        </ScrollView>
        <FlatList
          data={results}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: space.xxl }}
          ListFooterComponent={
            <Button
              title="Create custom exercise"
              icon="add-circle-outline"
              variant="ghost"
              onPress={() => setCreating(true)}
              style={{ marginTop: space.md }}
            />
          }
          renderItem={({ item }) => {
            const isSelected = selected.includes(item.id);
            return (
              <Pressable
                testID={`pick-${item.id}`}
                onPress={() => toggle(item.id)}
                style={({ pressed }) => [styles.item, (pressed || isSelected) && { backgroundColor: colors.surfaceRaised }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>
                    {item.primaryMuscle} · {item.equipment}
                    {item.isCustom ? ' · custom' : ''}
                  </Text>
                </View>
                {multi ? (
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={26}
                    color={isSelected ? colors.accent : colors.textFaint}
                  />
                ) : null}
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
      <CustomExerciseModal
        visible={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          if (multi) setSelected((s) => [...s, id]);
          else {
            onPick([id]);
            onClose();
          }
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chipScroll: { flexGrow: 0 },
  chips: { gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    minHeight: 60,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  itemMeta: { ...font.small, textTransform: 'capitalize', marginTop: 2 },
});
