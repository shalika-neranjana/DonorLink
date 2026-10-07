import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';
import { ToastProvider } from '@gluestack-ui/core/toast/creator';
import type { ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RequestDraftProvider } from '@/features/requester/RequestDraftContext';
import { ThemePreferenceProvider } from '@/theme/ThemePreferenceProvider';
import { AuthProvider } from './AuthProvider';

/**
 * Provider stack: gestures → safe areas → theme preference → gluestack
 * overlay/toast → auth. Colours themselves are CSS variables in global.css;
 * the theme preference (System / Light / Dark) only decides which set applies.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemePreferenceProvider>
          <OverlayProvider>
            <ToastProvider>
              <AuthProvider>
                <RequestDraftProvider>{children}</RequestDraftProvider>
              </AuthProvider>
            </ToastProvider>
          </OverlayProvider>
        </ThemePreferenceProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
