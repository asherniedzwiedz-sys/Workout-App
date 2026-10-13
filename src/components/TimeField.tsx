import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatTimeOfDay } from '@/domain/format';
import { colors, radius, space } from '@/theme';

/** Hour + minute picker: native on iOS/Android, "HH:MM" text on web. */
export function TimeField({
  hour,
  minute,
  onChange,
}: {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}) {
  const value = new Date();
  value.setHours(hour, minute, 0, 0);

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.iosRow}>
        <DateTimePicker
          value={value}
          mode="time"
          display="spinner"
          themeVariant="dark"
          textColor={colors.text}
          minuteInterval={5}
          onValueChange={(_, d) => onChange(d.getHours(), d.getMinutes())}
          style={{ flex: 1 }}
        />
      </View>
    );
  }
  if (Platform.OS === 'android') {
    return (
      <Pressable
        style={styles.button}
        onPress={() =>
          DateTimePickerAndroid.open({ value, mode: 'time', onValueChange: (_, d) => onChange(d.getHours(), d.getMinutes()) })
        }
      >
        <Text style={styles.big}>{formatTimeOfDay(hour, minute)}</Text>
      </Pressable>
    );
  }
  return <WebTimeInput hour={hour} minute={minute} onChange={onChange} />;
}

function clock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Text entry for the browser build; keeps typed text while focused, follows props otherwise. */
function WebTimeInput({ hour, minute, onChange }: { hour: number; minute: number; onChange: (h: number, m: number) => void }) {
  const [text, setText] = useState(clock(hour, minute));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(clock(hour, minute));
  }, [hour, minute, focused]);
  return (
    <TextInput
      value={text}
      placeholder="18:30"
      placeholderTextColor={colors.textFaint}
      style={[styles.button, styles.big]}
      testID="reminder-time"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChangeText={(value) => {
        setText(value);
        const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
        if (!match) return;
        const h = Number(match[1]);
        const m = Number(match[2]);
        if (h < 24 && m < 60) onChange(h, m);
      }}
    />
  );
}

const styles = StyleSheet.create({
  iosRow: { alignItems: 'center' },
  button: {
    backgroundColor: colors.input,
    borderRadius: radius.md,
    height: 64,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    color: colors.text,
  },
  big: { color: colors.text, fontSize: 28, fontWeight: '800', textAlign: 'center' },
});
