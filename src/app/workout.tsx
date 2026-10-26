import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import * as Notifications from 'expo-notifications';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  addExerciseToWorkout, addSet, deleteSet, deleteWorkout, finishWorkout, loadWorkout, loggedSets,
  removeWorkoutExercise, setDone, setRest, setSkipped, startWorkout, swapExercise, updateSet, type WorkoutExercise,
} from '@/db';
import { pickExercise } from '@/ExerciseList';
import { saveWorkoutToHealth } from '@/health';
import { useNow, useQuery } from '@/hooks';
import { fmtDuration, fmtWeight, prSetIds } from '@/logic/stats';
import { adjustRest, startRest, stopRest, useRest } from '@/restTimer';
import { C, TAP } from '@/theme';
import { Button, Ionicons, NumInput, s } from '@/ui';
import { useWatchReachable } from '@/watch';

const REST_PRESETS = [0, 30, 60, 90, 120, 180, 300];
const fmtRest = (sec: number) => (sec ? fmtDuration(sec * 1000) : 'Off');

export default function WorkoutScreen() {
  useKeepAwake();
  const { routineId } = useLocalSearchParams<{ routineId?: string }>();
  // startWorkout resumes the in-progress workout if there is one, so a repeated initializer call is harmless.
  const [workoutId] = useState(() => startWorkout(routineId ? Number(routineId) : null));
  const data = useQuery(() => loadWorkout(workoutId));
  const watch = useWatchReachable();
  // The rest timer needs notifications to alert while the phone is locked; no prompt once granted.
  useEffect(() => void Notifications.requestPermissionsAsync().catch(() => {}), []);
  if (!data) return <View style={s.screen} />;
  const { workout, exercises } = data;
  if (workout.ended_at) return <View style={s.screen} />;

  const finish = () => {
    const pending = exercises.reduce((n, e) => n + e.sets.filter((x) => !x.done).length, 0);
    Alert.alert('Finish workout?', pending ? `${pending} unchecked set${pending > 1 ? 's' : ''} will be dropped.` : undefined, [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Finish',
        onPress: () => {
          stopRest();
          const done = finishWorkout(workout.id);
          if (!done) {
            router.back();
            return;
          }
          void saveWorkoutToHealth(done.id);
          router.replace({ pathname: '/history/[id]', params: { id: String(done.id) } });
        },
      },
    ]);
  };

  const discard = () =>
    Alert.alert('Discard workout?', 'Everything logged in this workout will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => (stopRest(), deleteWorkout(workout.id), router.back()) },
    ]);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={st.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Minimize workout">
          <Ionicons name="chevron-down" size={30} color={C.text} />
        </Pressable>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={st.title} numberOfLines={1}>{workout.name}</Text>
          <Text style={s.muted}>
            <Elapsed since={workout.started_at} />{watch ? '  ·  ⌚︎ Watch connected' : ''}
          </Text>
        </View>
        <Button title="Finish" variant="success" onPress={finish} style={{ minHeight: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 160 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {exercises.map((we) => <ExerciseCard key={we.id} we={we} />)}
        <Button title="Add Exercise" icon="add" variant="secondary" onPress={() => pickExercise((id) => addExerciseToWorkout(workout.id, id))} />
        <Button title="Discard Workout" variant="ghost" onPress={discard} />
      </ScrollView>
      <RestBar />
    </SafeAreaView>
  );
}

function ExerciseCard({ we }: { we: WorkoutExercise }) {
  const prs = useQuery(() => prSetIds(loggedSets(we.exercise_id)));

  const menu = () =>
    Alert.alert(we.name, undefined, [
      { text: 'Swap exercise', onPress: () => pickExercise((id) => swapExercise(we.id, id)) },
      { text: we.skipped ? 'Unskip' : 'Skip exercise', onPress: () => setSkipped(we.id, !we.skipped) },
      { text: 'Remove', style: 'destructive', onPress: () => removeWorkoutExercise(we.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const restMenu = () =>
    Alert.alert('Rest timer', `For ${we.name}`, [
      ...REST_PRESETS.map((sec) => ({ text: fmtRest(sec), onPress: () => setRest(we.id, sec) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  if (we.skipped) {
    return (
      <Pressable style={[st.card, { opacity: 0.6 }]} onPress={() => setSkipped(we.id, false)}>
        <Text style={st.exName}>{we.name}</Text>
        <Text style={s.muted}>Skipped — tap to restore</Text>
      </Pressable>
    );
  }

  return (
    <View style={st.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[st.exName, { flex: 1 }]} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: we.exercise_id } })}>
          {we.name}
        </Text>
        <Pressable onPress={restMenu} style={st.restChip} accessibilityLabel="Rest timer duration">
          <Ionicons name="timer-outline" size={16} color={C.accent} />
          <Text style={{ color: C.accent, fontWeight: '700' }}>{fmtRest(we.rest_sec)}</Text>
        </Pressable>
        <Pressable onPress={menu} hitSlop={10} style={{ padding: 6 }} accessibilityLabel="Exercise options">
          <Ionicons name="ellipsis-horizontal" size={22} color={C.text} />
        </Pressable>
      </View>
      <View style={st.setRow}>
        <Text style={[st.colHead, { width: 34 }]}>SET</Text>
        <Text style={[st.colHead, { flex: 1 }]}>PREVIOUS</Text>
        <Text style={[st.colHead, st.colInput]}>LBS</Text>
        <Text style={[st.colHead, st.colInput]}>REPS</Text>
        <View style={{ width: TAP }} />
      </View>
      {we.sets.map((set, i) => {
        const prev = we.previous[i];
        return (
          <View key={set.id} style={[st.setRow, set.done ? { backgroundColor: C.successBg } : null]}>
            <Pressable
              style={{ width: 34 }}
              onPress={() => Alert.alert(`Set ${i + 1}`, undefined, [{ text: 'Delete set', style: 'destructive', onPress: () => deleteSet(set.id) }, { text: 'Cancel', style: 'cancel' }])}
            >
              <Text style={st.setNum}>{i + 1}</Text>
              {prs.has(set.id) && <Ionicons name="trophy" size={14} color={C.pr} accessibilityLabel="Personal record" />}
            </Pressable>
            <Pressable
              style={{ flex: 1 }}
              disabled={!prev}
              onPress={() => prev && (updateSet(set.id, 'weight', prev.weight), updateSet(set.id, 'reps', prev.reps))}
            >
              <Text style={s.muted}>{prev ? `${fmtWeight(prev.weight)} × ${prev.reps}` : '—'}</Text>
            </Pressable>
            <NumInput decimal value={set.weight} onChange={(v) => updateSet(set.id, 'weight', v)} style={st.colInput} accessibilityLabel={`Set ${i + 1} weight`} />
            <NumInput value={set.reps} onChange={(v) => updateSet(set.id, 'reps', v)} style={st.colInput} accessibilityLabel={`Set ${i + 1} reps`} />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!set.done }}
              accessibilityLabel={`Complete set ${i + 1}`}
              style={[st.check, set.done ? { backgroundColor: C.success } : null]}
              onPress={() => {
                setDone(set.id, !set.done);
                if (!set.done) {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  startRest(we.rest_sec);
                }
              }}
            >
              <Ionicons name="checkmark" size={26} color={set.done ? '#fff' : C.muted} />
            </Pressable>
          </View>
        );
      })}
      <Button title="Add Set" icon="add" variant="secondary" onPress={() => addSet(we.id)} style={{ minHeight: 44 }} />
    </View>
  );
}

function Elapsed({ since }: { since: number }) {
  const now = useNow();
  return <>{fmtDuration(now - since)}</>;
}

function RestBar() {
  const rest = useRest();
  const now = useNow(250);
  if (!rest) return null;
  const left = Math.max(0, rest.endsAt - now);
  return (
    <View style={st.restBar}>
      <View style={[st.restFill, { width: `${Math.min(100, (left / (rest.total * 1000)) * 100)}%` }]} />
      <Pressable onPress={() => adjustRest(-15)} style={st.restBtn}><Text style={st.restBtnText}>−15</Text></Pressable>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={s.muted}>Rest</Text>
        <Text style={st.restTime}>{fmtDuration(left)}</Text>
      </View>
      <Pressable onPress={() => adjustRest(15)} style={st.restBtn}><Text style={st.restBtnText}>+15</Text></Pressable>
      <Pressable onPress={stopRest} style={[st.restBtn, { backgroundColor: C.accent }]}><Text style={[st.restBtnText, { color: '#fff' }]}>Skip</Text></Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  title: { color: C.text, fontSize: 20, fontWeight: '800' },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 12, gap: 6 },
  exName: { color: C.accent, fontSize: 18, fontWeight: '800' },
  restChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: C.card2 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 4, minHeight: TAP },
  colHead: { color: C.muted, fontSize: 12, fontWeight: '700' },
  colInput: { width: 72, textAlign: 'center' },
  setNum: { color: C.text, fontSize: 17, fontWeight: '700' },
  check: { width: TAP, height: 44, borderRadius: 10, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  restBar: { position: 'absolute', left: 12, right: 12, bottom: 28, minHeight: 76, borderRadius: 18, backgroundColor: C.card2, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, overflow: 'hidden' },
  restFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#1E3A66' },
  restTime: { color: C.text, fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  restBtn: { minWidth: TAP, height: TAP, borderRadius: 12, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  restBtnText: { color: C.text, fontSize: 17, fontWeight: '800' },
});
