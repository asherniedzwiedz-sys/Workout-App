import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { showActionSheet } from '@/components/ActionSheet';
import { notify } from '@/components/dialogs';
import { formatRest } from '@/components/RestTimer';
import { TimeField } from '@/components/TimeField';
import { Button, Card, Chip, SectionTitle, Segmented, SwitchRow } from '@/components/ui';
import { getKv, setKv } from '@/db/kv';
import { listRoutines, saveRoutine } from '@/db/routines';
import { getRecentBestE1rm } from '@/db/workouts';
import { formatWeight, weekdayShort } from '@/domain/format';
import {
  adjustExercise,
  alternativesFor,
  estimateMinutes,
  findBackToBackConflicts,
  generateProgram,
  regenerateDay,
  removeExerciseFromProgram,
  SPLIT_LABEL,
  splitOptions,
  swapExerciseInProgram,
  type Goal,
  type GeneratorContext,
  type GeneratorInput,
  type Program,
} from '@/domain/generator';
import { EQUIPMENT, type Equipment } from '@/domain/types';
import { useData } from '@/hooks/useData';
import { removeRoutine, upsertReminder } from '@/services/reminders';
import { notifyDataChanged } from '@/state/dataVersion';
import { useExercises } from '@/state/exercises';
import { colors, font, radius, space } from '@/theme';

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6];
const LENGTH_OPTIONS = [30, 45, 60, 75, 90];
const INPUT_KEY = 'ai_builder_input';

const DEFAULT_INPUT: GeneratorInput = {
  goal: 'hypertrophy',
  daysPerWeek: 4,
  equipment: [...EQUIPMENT],
  sessionMinutes: 60,
  split: 'upper_lower',
};

function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export default function AiBuilderScreen() {
  const library = useExercises((s) => s.list);
  const byId = useExercises((s) => s.byId);
  const [input, setInput] = useState<GeneratorInput>(DEFAULT_INPUT);
  const [program, setProgram] = useState<Program | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [remind, setRemind] = useState(false);
  const [remindAt, setRemindAt] = useState({ hour: 18, minute: 0 });
  const [saving, setSaving] = useState(false);
  const { data: extras } = useData(async () => {
    const [recentE1rm, routines] = await Promise.all([getRecentBestE1rm(Date.now() - 90 * 86_400_000), listRoutines()]);
    return { recentE1rm, aiRoutines: routines.filter((r) => r.source === 'ai') };
  });

  useEffect(() => {
    void getKv<GeneratorInput | null>(INPUT_KEY, null).then((saved) => {
      if (saved) setInput({ ...DEFAULT_INPUT, ...saved });
    });
  }, []);

  const ctx: GeneratorContext = useMemo(
    () => ({ library: library.filter((e) => !e.isCustom && !e.archived), recentE1rm: extras?.recentE1rm ?? {} }),
    [library, extras?.recentE1rm],
  );

  const setField = (patch: Partial<GeneratorInput>) =>
    setInput((current) => {
      const next = { ...current, ...patch };
      const splits = splitOptions(next.daysPerWeek);
      if (!splits.includes(next.split)) next.split = splits[0] ?? 'full_body';
      return next;
    });

  const generate = () => {
    if (input.equipment.length === 0) {
      notify('Pick some equipment', 'Select at least one type of equipment you have access to.');
      return;
    }
    void setKv(INPUT_KEY, input);
    setProgram(generateProgram(input, ctx, newSeed()));
  };

  const conflicts = program ? findBackToBackConflicts(program, ctx.library) : [];

  const exerciseMenu = (dayIndex: number, exerciseIndex: number) => {
    if (!program) return;
    const current = program.days[dayIndex]?.exercises[exerciseIndex];
    if (!current) return;
    const alternatives = alternativesFor(program, dayIndex, exerciseIndex, ctx).slice(0, 6);
    showActionSheet({
      title: byId[current.exerciseId]?.name,
      message: `${current.sets} sets × ${current.reps} reps`,
      options: [
        ...alternatives.map((alt) => ({
          label: `Swap for ${alt.name}`,
          icon: 'swap-horizontal' as const,
          onPress: () => setProgram((p) => (p ? swapExerciseInProgram(p, dayIndex, exerciseIndex, alt.id, ctx) : p)),
        })),
        { label: 'Add a set', icon: 'add', onPress: () => setProgram((p) => (p ? adjustExercise(p, dayIndex, exerciseIndex, { sets: current.sets + 1 }, ctx) : p)) },
        { label: 'Remove a set', icon: 'remove', onPress: () => setProgram((p) => (p ? adjustExercise(p, dayIndex, exerciseIndex, { sets: current.sets - 1 }, ctx) : p)) },
        { label: `More reps (${current.reps + 2})`, icon: 'trending-up', onPress: () => setProgram((p) => (p ? adjustExercise(p, dayIndex, exerciseIndex, { reps: current.reps + 2 }, ctx) : p)) },
        { label: `Fewer reps (${Math.max(1, current.reps - 2)})`, icon: 'trending-down', onPress: () => setProgram((p) => (p ? adjustExercise(p, dayIndex, exerciseIndex, { reps: current.reps - 2 }, ctx) : p)) },
        { label: 'Remove exercise', icon: 'trash-outline', destructive: true, onPress: () => setProgram((p) => (p ? removeExerciseFromProgram(p, dayIndex, exerciseIndex) : p)) },
      ],
    });
  };

  const save = async () => {
    if (!program) return;
    setSaving(true);
    try {
      if (replaceExisting) {
        for (const r of extras?.aiRoutines ?? []) await removeRoutine(r.id);
      }
      const goalLabel = program.input.goal === 'strength' ? 'Strength' : 'Hypertrophy';
      for (const day of program.days) {
        const routineId = await saveRoutine({
          name: day.name,
          notes: `AI plan · ${weekdayShort(day.weekday)} · ${goalLabel} · ~${estimateMinutes(day.exercises)} min`,
          source: 'ai',
          exercises: day.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            sets: e.sets,
            reps: e.reps,
            weight: e.weight,
            restSec: e.restSec,
          })),
        });
        if (remind) {
          await upsertReminder({ routineId, weekdays: [day.weekday], hour: remindAt.hour, minute: remindAt.minute, enabled: true });
        }
      }
      notifyDataChanged();
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.scroll}>
      <Stack.Screen options={{ title: 'AI workout builder' }} />
      <Text style={font.small}>
        Builds a weekly plan on your phone from the exercise library. Nothing leaves the device.
      </Text>

      <SectionTitle>Goal</SectionTitle>
      <Segmented<Goal>
        options={[
          { label: 'Strength', value: 'strength' },
          { label: 'Hypertrophy', value: 'hypertrophy' },
        ]}
        value={input.goal}
        onChange={(goal) => setField({ goal })}
        testIDPrefix="goal"
      />
      <Text style={styles.hint}>
        {input.goal === 'strength'
          ? 'Heavy compounds for 5s and 6s with longer rest; accessories for 10.'
          : 'Moderate weights for 8–15 reps with shorter rest and more accessory work.'}
      </Text>

      <SectionTitle>Days per week</SectionTitle>
      <View style={styles.wrap}>
        {DAY_OPTIONS.map((d) => (
          <Chip key={d} label={String(d)} selected={input.daysPerWeek === d} onPress={() => setField({ daysPerWeek: d })} testID={`days-${d}`} />
        ))}
      </View>

      <SectionTitle>Split</SectionTitle>
      <View style={styles.wrap}>
        {splitOptions(input.daysPerWeek).map((s) => (
          <Chip key={s} capitalize={false} label={SPLIT_LABEL[s]} selected={input.split === s} onPress={() => setField({ split: s })} testID={`split-${s}`} />
        ))}
      </View>

      <SectionTitle>Session length</SectionTitle>
      <View style={styles.wrap}>
        {LENGTH_OPTIONS.map((m) => (
          <Chip key={m} capitalize={false} label={`${m} min`} selected={input.sessionMinutes === m} onPress={() => setField({ sessionMinutes: m })} testID={`length-${m}`} />
        ))}
      </View>

      <SectionTitle>Equipment</SectionTitle>
      <View style={styles.wrap}>
        {EQUIPMENT.map((e: Equipment) => {
          const selected = input.equipment.includes(e);
          return (
            <Chip
              key={e}
              label={e}
              selected={selected}
              testID={`equipment-${e}`}
              onPress={() => setField({ equipment: selected ? input.equipment.filter((x) => x !== e) : [...input.equipment, e] })}
            />
          );
        })}
      </View>

      <Button
        title={program ? 'Regenerate plan' : 'Generate plan'}
        icon="sparkles"
        size="lg"
        onPress={generate}
        style={{ marginTop: space.xl }}
        testID="generate-plan"
      />

      {program ? (
        <View testID="generated-plan">
          <SectionTitle>Your week</SectionTitle>
          <View style={[styles.check, conflicts.length > 0 && { borderColor: colors.danger }]} testID="adjacency-check">
            <Ionicons
              name={conflicts.length ? 'warning' : 'checkmark-circle'}
              size={18}
              color={conflicts.length ? colors.danger : colors.success}
            />
            <Text style={styles.checkText}>
              {conflicts.length
                ? `Back-to-back: ${conflicts.map((c) => `${program.days[c.first]?.name} & ${program.days[c.second]?.name} (${c.muscles.join(', ')})`).join('; ')}`
                : 'No muscle group is trained on back-to-back days.'}
            </Text>
          </View>

          <View style={{ gap: space.md, marginTop: space.md }}>
            {program.days.map((day, dayIndex) => (
              <Card key={`${day.weekday}-${day.name}`} testID={`plan-day-${dayIndex}`}>
                <View style={styles.dayHeader}>
                  <View style={styles.weekday}>
                    <Text style={styles.weekdayText}>{weekdayShort(day.weekday)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={font.subheading}>{day.name}</Text>
                    <Text style={font.tiny}>
                      {day.exercises.length} exercises · ~{estimateMinutes(day.exercises)} min
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setProgram((p) => (p ? regenerateDay(p, dayIndex, ctx, newSeed()) : p))}
                    style={styles.iconButton}
                    accessibilityLabel={`Regenerate ${day.name}`}
                    testID={`regenerate-day-${dayIndex}`}
                  >
                    <Ionicons name="refresh" size={20} color={colors.accent} />
                  </Pressable>
                </View>
                {day.exercises.map((e, exerciseIndex) => (
                  <Pressable
                    key={`${e.exerciseId}-${exerciseIndex}`}
                    style={({ pressed }) => [styles.exercise, pressed && { opacity: 0.7 }]}
                    onPress={() => exerciseMenu(dayIndex, exerciseIndex)}
                    testID={`plan-ex-${dayIndex}-${exerciseIndex}`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exerciseName}>{byId[e.exerciseId]?.name ?? e.exerciseId}</Text>
                      <Text style={font.tiny}>
                        {e.sets} × {e.reps}
                        {e.weight > 0 ? ` · ${formatWeight(e.weight)} lb` : ''} · rest {formatRest(e.restSec)}
                        {e.slot.role === 'main' ? ' · main lift' : ''}
                      </Text>
                    </View>
                    <Ionicons name="swap-horizontal" size={18} color={colors.textFaint} />
                  </Pressable>
                ))}
              </Card>
            ))}
          </View>

          <Text style={[font.tiny, { marginTop: space.md }]}>
            Tap an exercise to swap it or change sets and reps. Weights are suggested from your last 90 days; blank ones
            reuse whatever you lift.
          </Text>

          {(extras?.aiRoutines.length ?? 0) > 0 ? (
            <Card style={{ padding: 0, overflow: 'hidden', marginTop: space.lg }}>
              <SwitchRow
                title="Replace my previous AI routines"
                subtitle={`${extras?.aiRoutines.length} saved from an earlier plan`}
                value={replaceExisting}
                onChange={setReplaceExisting}
              />
            </Card>
          ) : null}

          <Card style={{ padding: 0, overflow: 'hidden', marginTop: space.md }}>
            <SwitchRow
              title="Remind me on training days"
              subtitle={program.days.map((d) => weekdayShort(d.weekday)).join(', ')}
              value={remind}
              onChange={setRemind}
              testID="plan-remind"
            />
          </Card>
          {remind ? (
            <View style={{ marginTop: space.md }}>
              <TimeField hour={remindAt.hour} minute={remindAt.minute} onChange={(hour, minute) => setRemindAt({ hour, minute })} />
            </View>
          ) : null}

          <Button
            title={`Save ${program.days.length} routine${program.days.length === 1 ? '' : 's'}`}
            icon="checkmark"
            variant="success"
            size="lg"
            loading={saving}
            onPress={save}
            style={{ marginTop: space.lg }}
            testID="save-plan"
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, paddingBottom: 80 },
  hint: { ...font.tiny, marginTop: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.successDim,
    backgroundColor: colors.surface,
  },
  checkText: { color: colors.textDim, fontSize: 13, flex: 1 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
  weekday: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center' },
  weekdayText: { color: colors.accent, fontWeight: '800' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  exercise: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: space.sm,
  },
  exerciseName: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
