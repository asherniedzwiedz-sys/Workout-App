import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { C, TAP } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export { Ionicons };

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return scroll ? (
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
      {children}
    </ScrollView>
  ) : (
    <View style={[s.screen, s.content]}>{children}</View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
export function Button({ title, onPress, variant = 'primary', icon, disabled, style }: {
  title: string; onPress: () => void; variant?: Variant; icon?: IconName; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const bg = { primary: C.accent, secondary: C.card2, danger: C.danger, success: C.success, ghost: 'transparent' }[variant];
  const fg = variant === 'ghost' ? C.accent : variant === 'secondary' ? C.text : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.button, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }, style]}
    >
      {icon && <Ionicons name={icon} size={20} color={fg} />}
      <Text style={[s.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Row({ title, subtitle, right, onPress, onLongPress, icon }: {
  title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; onLongPress?: () => void; icon?: IconName;
}) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => [s.row, pressed && onPress && { backgroundColor: C.card2 }]}>
      {icon && <Ionicons name={icon} size={22} color={C.accent} style={{ marginRight: 12 }} />}
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={s.muted} numberOfLines={2}>{subtitle}</Text>}
      </View>
      {right ?? (onPress && <Ionicons name="chevron-forward" size={18} color={C.muted} />)}
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && { backgroundColor: C.accent, borderColor: C.accent }]}>
      <Text style={{ color: active ? '#fff' : C.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function NumInput({ value, onChange, decimal, style, ...rest }: {
  value: number; onChange: (n: number) => void; decimal?: boolean; style?: TextInputProps['style'];
} & Omit<TextInputProps, 'value' | 'onChange' | 'style'>) {
  return (
    <TextInput
      {...rest}
      style={[s.input, style]}
      defaultValue={value ? String(value) : ''}
      key={value}
      placeholder="0"
      placeholderTextColor={C.muted}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      selectTextOnFocus
      returnKeyType="done"
      onEndEditing={(e) => {
        const n = Number(e.nativeEvent.text.replace(',', '.'));
        if (Number.isFinite(n) && n >= 0 && n !== value) onChange(n);
      }}
    />
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, label }: { value: number; onChange: (n: number) => void; step?: number; min?: number; label?: string }) {
  return (
    <View style={s.stepper}>
      <Pressable accessibilityLabel={`Decrease ${label ?? ''}`} onPress={() => onChange(Math.max(min, value - step))} style={s.stepBtn}>
        <Ionicons name="remove" size={22} color={C.text} />
      </Pressable>
      <Text style={s.stepValue}>{value}{label ? ` ${label}` : ''}</Text>
      <Pressable accessibilityLabel={`Increase ${label ?? ''}`} onPress={() => onChange(value + step)} style={s.stepBtn}>
        <Ionicons name="add" size={22} color={C.text} />
      </Pressable>
    </View>
  );
}

export const H = ({ children }: { children: ReactNode }) => <Text style={s.h}>{children}</Text>;
export const Muted = ({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) => <Text style={[s.muted, style]}>{children}</Text>;
export const Body = ({ children }: { children: ReactNode }) => <Text style={s.body}>{children}</Text>;

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 14, gap: 10 },
  button: { minHeight: TAP, borderRadius: 12, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonText: { fontSize: 17, fontWeight: '700' },
  row: { minHeight: TAP + 8, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, backgroundColor: C.card, borderRadius: 12 },
  rowTitle: { color: C.text, fontSize: 17, fontWeight: '600' },
  muted: { color: C.muted, fontSize: 14 },
  body: { color: C.text, fontSize: 16, lineHeight: 22 },
  h: { color: C.text, fontSize: 22, fontWeight: '800', marginTop: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  input: { minHeight: 44, minWidth: 64, backgroundColor: C.card2, color: C.text, borderRadius: 10, paddingHorizontal: 10, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  textInput: { minHeight: TAP, backgroundColor: C.card2, color: C.text, borderRadius: 10, paddingHorizontal: 14, fontSize: 17 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card2, borderRadius: 10 },
  stepBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepValue: { color: C.text, fontSize: 17, fontWeight: '700', minWidth: 40, textAlign: 'center' },
});
