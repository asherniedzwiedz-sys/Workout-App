import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { colors, radius, space } from '@/theme';

import type { IconName } from './ui';

export interface SheetOption {
  label: string;
  icon?: IconName;
  destructive?: boolean;
  selected?: boolean;
  onPress: () => void;
  testID?: string;
}

interface SheetState {
  visible: boolean;
  title?: string;
  message?: string;
  options: SheetOption[];
  show: (config: { title?: string; message?: string; options: SheetOption[] }) => void;
  hide: () => void;
}

const useSheet = create<SheetState>((set) => ({
  visible: false,
  options: [],
  show: (config) => set({ visible: true, title: config.title, message: config.message, options: config.options }),
  hide: () => set({ visible: false }),
}));

/** Opens a bottom action sheet. Works the same on iOS, Android and web. */
export function showActionSheet(config: { title?: string; message?: string; options: SheetOption[] }): void {
  useSheet.getState().show(config);
}

/** Mount once near the root of the app. */
export function ActionSheetHost() {
  const { visible, title, message, options, hide } = useSheet();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={hide}>
      <Pressable style={styles.backdrop} onPress={hide} testID="sheet-backdrop" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <ScrollView style={{ maxHeight: 480 }} bounces={false}>
          {options.map((o) => (
            <Pressable
              key={o.label}
              testID={o.testID}
              accessibilityRole="button"
              onPress={() => {
                hide();
                // Let the sheet close before running actions that open other modals.
                setTimeout(o.onPress, 250);
              }}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surfaceRaised }]}
            >
              {o.icon ? (
                <Ionicons name={o.icon} size={22} color={o.destructive ? colors.danger : colors.textDim} />
              ) : null}
              <Text style={[styles.optionText, o.destructive && { color: colors.danger }]}>{o.label}</Text>
              {o.selected ? <Ionicons name="checkmark" size={22} color={colors.accent} /> : null}
            </Pressable>
          ))}
        </ScrollView>
        <Pressable onPress={hide} style={styles.cancel} accessibilityRole="button">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: space.md,
    paddingHorizontal: space.sm,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center', paddingVertical: space.sm },
  message: { color: colors.textDim, fontSize: 14, textAlign: 'center', paddingBottom: space.sm, paddingHorizontal: space.lg },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 54,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
  },
  optionText: { color: colors.text, fontSize: 17, flex: 1 },
  cancel: {
    marginTop: space.sm,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  cancelText: { color: colors.text, fontSize: 17, fontWeight: '700' },
});
