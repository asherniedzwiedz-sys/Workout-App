import { Tabs } from 'expo-router';
import { C } from '@/theme';
import { Ionicons, type IconName } from '@/ui';

const tab = (title: string, icon: IconName) => ({
  title,
  // React Navigation always passes the tint color string here.
  tabBarIcon: ({ color, size }: { color: unknown; size: number }) => <Ionicons name={icon} size={size} color={color as string} />,
});

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.border },
        headerStyle: { backgroundColor: C.bg },
        headerTintColor: C.text,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Tabs.Screen name="index" options={tab('Workout', 'barbell')} />
      <Tabs.Screen name="history" options={tab('History', 'time')} />
      <Tabs.Screen name="running" options={tab('Running', 'walk')} />
      <Tabs.Screen name="exercises" options={tab('Exercises', 'list')} />
      <Tabs.Screen name="settings" options={tab('Settings', 'settings')} />
    </Tabs>
  );
}
