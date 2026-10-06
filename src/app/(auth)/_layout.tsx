import { Stack } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';

export default function AuthLayout() {
  const { status } = useAuth();
  // A signed-in user who still has to verify their email lands on that screen.
  return (
    <Stack
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      initialRouteName={status === 'signedIn' ? 'verify-email' : 'welcome'}
    />
  );
}
