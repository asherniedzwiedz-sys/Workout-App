import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createCustomExercise } from '@/db/exercises';
import { EQUIPMENT, MUSCLE_GROUPS, type Equipment, type ExerciseCategory, type MuscleGroup } from '@/domain/types';
import { notifyDataChanged } from '@/state/dataVersion';
import { useExercises } from '@/state/exercises';
import { colors, font, space } from '@/theme';

import { Button, Chip, Field, Segmented } from './ui';

export function CustomExerciseModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup>('chest');
  const [equipment, setEquipment] = useState<Equipment>('barbell');
  const [category, setCategory] = useState<ExerciseCategory>('compound');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const id = await createCustomExercise({
        name,
        primaryMuscle: muscle,
        secondaryMuscles: [],
        equipment,
        category,
      });
      await useExercises.getState().load();
      notifyDataChanged();
      setName('');
      onCreated?.(id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.header}>
            <Button title="Cancel" variant="ghost" onPress={onClose} size="sm" />
            <Text style={font.subheading}>New exercise</Text>
            <Button title="Save" variant="ghost" onPress={save} disabled={!name.trim()} loading={saving} size="sm" testID="custom-exercise-save" />
          </View>
          <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
            <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Landmine Press" autoFocus testID="custom-exercise-name" />
            <View>
              <Text style={styles.label}>Primary muscle</Text>
              <View style={styles.wrap}>
                {MUSCLE_GROUPS.map((m) => (
                  <Chip key={m} label={m} selected={m === muscle} onPress={() => setMuscle(m)} />
                ))}
              </View>
            </View>
            <View>
              <Text style={styles.label}>Equipment</Text>
              <View style={styles.wrap}>
                {EQUIPMENT.map((e) => (
                  <Chip key={e} label={e} selected={e === equipment} onPress={() => setEquipment(e)} />
                ))}
              </View>
            </View>
            <View>
              <Text style={styles.label}>Type</Text>
              <Segmented
                options={[
                  { label: 'Compound', value: 'compound' },
                  { label: 'Isolation', value: 'isolation' },
                ]}
                value={category}
                onChange={setCategory}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
  label: { ...font.small, fontWeight: '600', marginBottom: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
