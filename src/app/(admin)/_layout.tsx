import { Stack } from 'expo-router';

import { NotificationsProvider } from '@/providers/NotificationsProvider';

/** Admin console: separate from the individual app, reachable only with the server-set admin label. */
export default function AdminGroupLayout() {
  return (
    <NotificationsProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="admin" />
      </Stack>
    </NotificationsProvider>
  );
}
