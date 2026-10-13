import { forwardRef, useEffect, useState } from 'react';
import { Platform, StyleSheet, TextInput, type StyleProp, type TextStyle } from 'react-native';

import { formatWeight } from '@/domain/format';
import { colors, radius } from '@/theme';

export const NUMPAD_ACCESSORY_ID = 'numpad-accessory';

function display(value: number | null): string {
  return value === null ? '' : formatWeight(value);
}

/**
 * Number field that keeps its own text while focused (so "185." or "" survive
 * re-renders) and reports parsed values upward.
 */
export const NumericInput = forwardRef<
  TextInput,
  {
    value: number | null;
    placeholder: string;
    onChange: (value: number | null) => void;
    decimal?: boolean;
    style?: StyleProp<TextStyle>;
    completed?: boolean;
    testID?: string;
    accessibilityLabel?: string;
    onSubmit?: () => void;
  }
>(function NumericInput({ value, placeholder, onChange, decimal, style, completed, testID, accessibilityLabel, onSubmit }, ref) {
  const [text, setText] = useState(display(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(display(value));
  }, [value, focused]);

  return (
    <TextInput
      ref={ref}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      value={text}
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      keyboardAppearance="dark"
      selectTextOnFocus
      inputAccessoryViewID={Platform.OS === 'ios' ? NUMPAD_ACCESSORY_ID : undefined}
      returnKeyType="done"
      onSubmitEditing={onSubmit}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setText(display(value));
      }}
      onChangeText={(t) => {
        const cleaned = t.replace(',', '.').replace(decimal ? /[^0-9.]/g : /[^0-9]/g, '');
        setText(cleaned);
        if (cleaned === '' || cleaned === '.') {
          onChange(null);
          return;
        }
        const parsed = Number(cleaned);
        if (Number.isFinite(parsed)) onChange(parsed);
      }}
      style={[styles.input, completed && styles.completed, style]}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.input,
    color: colors.text,
    borderRadius: radius.sm,
    height: 44,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  completed: { backgroundColor: 'transparent' },
});
