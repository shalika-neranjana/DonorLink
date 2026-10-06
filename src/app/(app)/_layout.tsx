import { Stack } from 'expo-router';

import { NotificationsProvider } from '@/providers/NotificationsProvider';

export default function AppLayout() {
  return (
    <NotificationsProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </NotificationsProvider>
  );
}
