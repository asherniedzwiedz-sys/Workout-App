import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatDateLong, formatTimeOfDay } from '@/domain/format';
import { colors, radius, space } from '@/theme';

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Date + time picker: native compact picker on iOS, dialogs on Android, text on web. */
export function DateTimeField({ value, onChange, label }: { value: Date; onChange: (d: Date) => void; label?: string }) {
  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {Platform.OS === 'ios' ? (
        <View style={styles.iosRow}>
          <DateTimePicker
            value={value}
            mode="datetime"
            display="compact"
            themeVariant="dark"
            accentColor={colors.accent}
            maximumDate={new Date()}
            onValueChange={(_, date) => onChange(date)}
          />
        </View>
      ) : Platform.OS === 'android' ? (
        <Pressable
          style={styles.button}
          onPress={() =>
            DateTimePickerAndroid.open({
              value,
              mode: 'date',
              maximumDate: new Date(),
              onValueChange: (_, date) => {
                DateTimePickerAndroid.open({
                  value: date,
                  mode: 'time',
                  onValueChange: (__, time) => onChange(time),
                });
              },
            })
          }
        >
          <Text style={styles.buttonText}>
            {formatDateLong(value.getTime())} · {formatTimeOfDay(value.getHours(), value.getMinutes())}
          </Text>
        </Pressable>
      ) : (
        <TextInput
          defaultValue={toLocalInput(value)}
          placeholder="YYYY-MM-DD HH:MM"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          testID="run-date"
          onChangeText={(text) => {
            const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(text.trim());
            if (!match) return;
            const [, y, mo, d, h = '12', mi = '0'] = match;
            const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
            if (!Number.isNaN(date.getTime())) onChange(date);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textDim, fontSize: 14, fontWeight: '600', marginBottom: space.xs },
  iosRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  button: { backgroundColor: colors.input, borderRadius: radius.md, height: 48, justifyContent: 'center', paddingHorizontal: space.md },
  buttonText: { color: colors.text, fontSize: 16 },
  input: { backgroundColor: colors.input, color: colors.text, borderRadius: radius.md, height: 48, paddingHorizontal: space.md, fontSize: 16 },
});
