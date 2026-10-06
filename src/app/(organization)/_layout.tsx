import { Stack } from 'expo-router';

import { OrganizationProvider } from '@/features/organization/OrganizationContext';
import { NotificationsProvider } from '@/providers/NotificationsProvider';

/** Organization workspace: separate navigation from the individual app. */
export default function OrganizationGroupLayout() {
  return (
    <NotificationsProvider>
      <OrganizationProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="org" />
        </Stack>
      </OrganizationProvider>
    </NotificationsProvider>
  );
}
