import '@/global.css';

import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Platform, View } from 'react-native';

import { DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { AppProviders } from '@/providers/AppProviders';
import { useAuth } from '@/providers/AuthProvider';
import { useResolvedColorScheme, useThemePreference } from '@/theme/ThemePreferenceProvider';
import { useThemeColors } from '@/theme/useThemeColors';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  return (
    <AppProviders>
      <ThemedStatusBar />
      <PhoneFrame>
        <RootNavigator fontsReady={fontsLoaded || !!fontError} />
      </PhoneFrame>
    </AppProviders>
  );
}

/** Status-bar icons follow the scheme the app is showing, which may differ from the device's. */
function ThemedStatusBar() {
  return <StatusBar style={useResolvedColorScheme() === 'dark' ? 'light' : 'dark'} />;
}

/** On the web (development preview only) keep the app at phone width, centred. */
function PhoneFrame({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View className="flex-1 items-center bg-subtle">
      <View className="w-full max-w-[430px] flex-1 overflow-hidden bg-background">{children}</View>
    </View>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const auth = useAuth();
  const colors = useThemeColors();
  const { ready: themeReady } = useThemePreference();
  const scheme = useResolvedColorScheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: colors.background, card: colors.surface, text: colors.fg, border: colors.border, primary: colors.primary },
  };
  // Hold the splash until the saved theme is applied, so there is no light→dark flash.
  const ready = fontsReady && themeReady && auth.status !== 'loading';

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-background px-10">
        <DonorLinkSkeleton width={160} height={14} />
        <DonorLinkSkeleton width={100} height={10} />
      </View>
    );
  }

  if (auth.status === 'error') {
    return (
      <View className="flex-1 justify-center bg-background">
        <DonorLinkErrorState
          title="We couldn't open DonorLink"
          message={auth.bootError?.message ?? 'Please check your connection and try again.'}
          onRetry={() => void auth.retryBoot()}
        />
      </View>
    );
  }

  const signedOut = auth.status === 'signedOut';
  const signedIn = auth.status === 'signedIn';
  const verifyingEmail = signedIn && auth.needsOnboarding && !auth.emailVerified && !auth.emailPromptDismissed;
  const onboarding = signedIn && auth.needsOnboarding && !verifyingEmail;
  const inApp = signedIn && !auth.needsOnboarding;

  return (
    <ThemeProvider value={navTheme}>
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Protected guard={signedOut || verifyingEmail}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={onboarding}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={inApp}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={inApp && auth.isOrganizationMember}>
        <Stack.Screen name="(organization)" />
      </Stack.Protected>
      <Stack.Protected guard={inApp && auth.isAdmin}>
        <Stack.Screen name="(admin)" />
      </Stack.Protected>
      <Stack.Protected guard={__DEV__}>
        <Stack.Screen name="gallery" />
      </Stack.Protected>
    </Stack>
    </ThemeProvider>
  );
}
