import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '@/theme/useThemeColors';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'dashboard', title: 'Overview', icon: 'speedometer-outline', iconActive: 'speedometer' },
  { name: 'users', title: 'Users', icon: 'people-outline', iconActive: 'people' },
  { name: 'requests', title: 'Requests', icon: 'water-outline', iconActive: 'water' },
  { name: 'verification', title: 'Verify', icon: 'shield-checkmark-outline', iconActive: 'shield-checkmark' },
  { name: 'more', title: 'More', icon: 'grid-outline', iconActive: 'grid' },
];

const HIDDEN = ['organizations', 'inventory', 'analytics', 'audit', 'tickets', 'settings', 'request/[id]', 'user/[id]'];

export default function AdminTabsLayout() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.fgMuted,
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginBottom: Platform.OS === 'ios' ? 0 : 4 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 58 + insets.bottom, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 6) },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title, tabBarIcon: ({ focused, color }) => <Ionicons name={focused ? tab.iconActive : tab.icon} size={24} color={color} /> }} />
      ))}
      {HIDDEN.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}
