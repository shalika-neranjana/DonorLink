import { Redirect, Stack, useSegments } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';

/**
 * Route guards in the root layout only decide which groups are reachable; they
 * never move the user between screens inside a group. A user who signs up (or
 * signs in with an unverified email) stays on the screen they were on unless
 * this layout sends them on, so it owns that redirect.
 */
export default function AuthLayout() {
  const auth = useAuth();
  const segments = useSegments();
  const onVerifyScreen = segments[segments.length - 1] === 'verify-email';

  // Same condition the root layout uses to keep this group open for a signed-in user.
  const verifyingEmail =
    auth.status === 'signedIn' && auth.needsOnboarding && !auth.emailVerified && !auth.emailPromptDismissed;

  if (verifyingEmail && !onVerifyScreen) return <Redirect href="/verify-email" />;
  // "Use a different account" signs out while the verify screen is open.
  if (auth.status !== 'signedIn' && onVerifyScreen) return <Redirect href="/welcome" />;

  return (
    <Stack
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      initialRouteName={auth.status === 'signedIn' ? 'verify-email' : 'welcome'}
    />
  );
}
