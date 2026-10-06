import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '@/theme/useThemeColors';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'dashboard', title: 'Overview', icon: 'speedometer-outline', iconActive: 'speedometer' },
  { name: 'requests', title: 'Requests', icon: 'water-outline', iconActive: 'water' },
  { name: 'inventory', title: 'Inventory', icon: 'cube-outline', iconActive: 'cube' },
  { name: 'donors', title: 'Donors', icon: 'people-outline', iconActive: 'people' },
  { name: 'profile', title: 'Organization', icon: 'business-outline', iconActive: 'business' },
];

export default function OrganizationTabsLayout() {
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
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{ title: tab.title, tabBarIcon: ({ focused, color }) => <Ionicons name={focused ? tab.iconActive : tab.icon} size={24} color={color} /> }}
        />
      ))}
      <Tabs.Screen name="verification" options={{ href: null }} />
      <Tabs.Screen name="request/[id]" options={{ href: null }} />
    </Tabs>
  );
}
