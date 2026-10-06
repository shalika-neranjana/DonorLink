import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNotifications } from '@/providers/NotificationsProvider';
import { useThemeColors } from '@/theme/useThemeColors';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'requests', title: 'Requests', icon: 'water-outline', iconActive: 'water' },
  { name: 'notifications', title: 'Alerts', icon: 'notifications-outline', iconActive: 'notifications' },
  { name: 'profile', title: 'Profile', icon: 'person-outline', iconActive: 'person' },
];

/**
 * Four tabs, same labels and positions on every screen (Milestone 02: keep
 * navigation consistent). Everything else is reached from inside these.
 */
export default function TabsLayout() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.fgMuted,
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginBottom: Platform.OS === 'ios' ? 0 : 4 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 58 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.name === 'notifications' && unreadCount ? `Alerts, ${unreadCount} unread` : tab.title,
            tabBarBadge: tab.name === 'notifications' && unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : undefined,
            tabBarBadgeStyle: { backgroundColor: colors.emergency, color: colors.emergencyForeground, fontFamily: 'Inter_700Bold', fontSize: 10 },
            tabBarIcon: ({ focused, color }) => <Ionicons name={focused ? tab.iconActive : tab.icon} size={24} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
