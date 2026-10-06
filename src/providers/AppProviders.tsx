import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';
import { ToastProvider } from '@gluestack-ui/core/toast/creator';
import type { ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RequestDraftProvider } from '@/features/requester/RequestDraftContext';
import { AuthProvider } from './AuthProvider';

/**
 * Provider stack: gestures → safe areas → gluestack overlay/toast → auth.
 * Colour theming is handled by CSS variables in global.css (light/dark follow
 * the system setting), so there is no separate theme provider.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <OverlayProvider>
          <ToastProvider>
            <AuthProvider>
              <RequestDraftProvider>{children}</RequestDraftProvider>
            </AuthProvider>
          </ToastProvider>
        </OverlayProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
