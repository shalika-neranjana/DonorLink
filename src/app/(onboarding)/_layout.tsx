import { Stack } from 'expo-router';

import { OnboardingProvider } from '@/features/onboarding/OnboardingContext';

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} initialRouteName="personal-info" />
    </OnboardingProvider>
  );
}
