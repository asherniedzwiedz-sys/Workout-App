import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { Platform, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActiveWorkoutBanner } from '@/components/ActiveWorkoutBanner';
import type { IconName } from '@/components/ui';
import { colors } from '@/theme';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 49 : 56;

function icon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color} size={size} />;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '800', fontSize: 20 },
          headerShadowVisible: false,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textFaint,
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Workout', tabBarIcon: icon('barbell'), tabBarButtonTestID: 'tab-workout' }} />
        <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('calendar'), tabBarButtonTestID: 'tab-history' }} />
        <Tabs.Screen name="exercises" options={{ title: 'Exercises', tabBarIcon: icon('list'), tabBarButtonTestID: 'tab-exercises' }} />
        <Tabs.Screen name="runs" options={{ title: 'Runs', tabBarIcon: icon('walk'), tabBarButtonTestID: 'tab-runs' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings-sharp'), tabBarButtonTestID: 'tab-settings' }} />
      </Tabs>
      <ActiveWorkoutBanner bottom={TAB_BAR_HEIGHT + insets.bottom + 10} />
    </View>
  );
}
