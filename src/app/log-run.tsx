import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { addRun } from '@/db';
import { fmtPace, METERS_PER_MILE, parseDuration } from '@/logic/stats';
import { C } from '@/theme';
import { Button, Chip, H, Muted, s, Screen } from '@/ui';

const DAYS = ['Today', 'Yesterday', '2 days ago', '3 days ago'];

export default function LogRun() {
  const [distance, setDistance] = useState('');
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [daysAgo, setDaysAgo] = useState(0);
  const meters = Number(distance.replace(',', '.')) * METERS_PER_MILE;
  const seconds = parseDuration(time);
  const valid = meters > 0 && seconds > 0;

  const save = () => {
    if (!valid) return Alert.alert('Enter a distance and a time like 25:30 or 1:05:00.');
    const started = new Date();
    started.setDate(started.getDate() - daysAgo);
    started.setTime(started.getTime() - seconds * 1000);
    addRun({ strava_id: null, name: name.trim() || 'Run', started_at: started.getTime(), distance_m: meters, duration_s: Math.round(seconds), source: 'manual' });
    router.back();
  };

  return (
    <Screen>
      <H>Distance (miles)</H>
      <TextInput style={s.textInput} keyboardType="decimal-pad" placeholder="3.1" placeholderTextColor={C.muted} value={distance} onChangeText={setDistance} autoFocus />
      <H>Time</H>
      <TextInput style={s.textInput} keyboardType="numbers-and-punctuation" placeholder="25:30" placeholderTextColor={C.muted} value={time} onChangeText={setTime} />
      {valid && <Muted>Pace {fmtPace(meters, seconds)}</Muted>}
      <H>When</H>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {DAYS.map((d, i) => <Chip key={d} label={d} active={daysAgo === i} onPress={() => setDaysAgo(i)} />)}
      </View>
      <TextInput style={s.textInput} placeholder="Name (optional)" placeholderTextColor={C.muted} value={name} onChangeText={setName} />
      <Button title="Save Run" onPress={save} disabled={!valid} />
    </Screen>
  );
}
