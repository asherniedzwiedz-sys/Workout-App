import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colors, font, radius, space, TOUCH } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
  size = 'md',
  testID,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'md' | 'lg' | 'sm';
  testID?: string;
}) {
  const palette = BUTTON_COLORS[variant];
  const height = size === 'lg' ? 56 : size === 'sm' ? 36 : TOUCH;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, height, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        variant === 'secondary' && styles.buttonBorder,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 20} color={palette.fg} /> : null}
          <Text style={[styles.buttonText, { color: palette.fg, fontSize: size === 'sm' ? 14 : 16 }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const BUTTON_COLORS: Record<ButtonVariant, { bg: string; fg: string }> = {
  primary: { bg: colors.accent, fg: '#fff' },
  secondary: { bg: colors.surfaceRaised, fg: colors.text },
  ghost: { bg: 'transparent', fg: colors.accent },
  danger: { bg: colors.dangerDim, fg: colors.danger },
  success: { bg: colors.success, fg: '#062414' },
};

export function IconButton({
  icon,
  onPress,
  color = colors.textDim,
  size = 22,
  label,
  style,
  testID,
}: {
  icon: IconName;
  onPress: () => void;
  color?: string;
  size?: number;
  label: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }, style]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Card({ children, style, onPress, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string }) {
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color = colors.accent,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[
        styles.chip,
        selected ? { backgroundColor: color, borderColor: color } : null,
      ]}
    >
      <Text style={[styles.chipText, selected ? { color: '#fff' } : null]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  style,
  inputStyle,
  ...props
}: TextInputProps & { label?: string; style?: StyleProp<ViewStyle>; inputStyle?: StyleProp<TextStyle> }) {
  return (
    <View style={style}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.accent}
        keyboardAppearance="dark"
        {...props}
        style={[styles.input, inputStyle]}
      />
    </View>
  );
}

export function Stat({ label, value, style }: { label: string; value: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.stat, style]}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={44} color={colors.textFaint} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {action}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function ListItem({
  title,
  subtitle,
  right,
  onPress,
  icon,
  iconColor = colors.textDim,
  testID,
  capitalize,
}: {
  title: string;
  subtitle?: string;
  /** Capitalize each word of the subtitle (for tag lists like "chest · barbell"). */
  capitalize?: boolean;
  right?: ReactNode;
  onPress?: () => void;
  icon?: IconName;
  iconColor?: string;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.listItem, { opacity: pressed ? 0.7 : 1 }]}
    >
      {icon ? <Ionicons name={icon} size={22} color={iconColor} style={{ marginRight: space.md }} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.listTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.listSubtitle, capitalize && { textTransform: 'capitalize' }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null)}
    </Pressable>
  );
}

export function SwitchRow({
  title,
  subtitle,
  value,
  onChange,
  icon,
  testID,
  disabled,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  icon?: IconName;
  testID?: string;
  disabled?: boolean;
}) {
  return (
    <ListItem
      title={title}
      subtitle={subtitle}
      icon={icon}
      right={
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          testID={testID}
          trackColor={{ true: colors.accent, false: colors.input }}
          thumbColor="#fff"
          ios_backgroundColor={colors.input}
        />
      }
    />
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Badge({ label, color = colors.gold, bg = colors.goldDim, icon }: { label: string; color?: string; bg?: string; icon?: IconName }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={color} /> : null}
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  testIDPrefix?: string;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  buttonBorder: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  buttonText: { fontWeight: '700' },
  iconButton: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  sectionTitle: { ...font.tiny, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  chip: {
    paddingHorizontal: space.md,
    height: 36,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: { color: colors.textDim, fontWeight: '600', fontSize: 14, textTransform: 'capitalize' },
  fieldLabel: { ...font.small, marginBottom: space.xs, fontWeight: '600' },
  input: {
    backgroundColor: colors.input,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    height: TOUCH,
    fontSize: 17,
  },
  stat: { flex: 1 },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  statLabel: { ...font.tiny, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.xl, gap: space.sm },
  emptyTitle: { ...font.subheading, textAlign: 'center' },
  emptyBody: { ...font.small, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
  },
  listTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  listSubtitle: { ...font.small, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: space.lg },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11, fontWeight: '800' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  segment: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segmentSelected: { backgroundColor: colors.surfaceRaised },
  segmentText: { color: colors.textDim, fontWeight: '600' },
  segmentTextSelected: { color: colors.text },
});
