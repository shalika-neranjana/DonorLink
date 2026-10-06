import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cn } from '@gluestack-ui/utils/nativewind-utils';

import { useThemeColors } from '@/theme/useThemeColors';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { DonorLinkHeader, type DonorLinkHeaderProps } from './DonorLinkHeader';

export interface DonorLinkScreenProps {
  children: ReactNode;
  /** Renders the standard header when provided. */
  header?: DonorLinkHeaderProps;
  /** Sticky action bar above the keyboard / home indicator. */
  footer?: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  /** Pull-to-refresh. */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Set on screens inside the tab bar, which already reserves the bottom inset. */
  inTabs?: boolean;
  /** Hide the offline banner (e.g. on auth screens). */
  hideOfflineBanner?: boolean;
  contentClassName?: string;
}

/**
 * Page scaffold: safe areas, header, scrolling, pull-to-refresh, sticky footer,
 * keyboard avoidance and the offline banner. Every screen uses this so spacing
 * and behaviour are identical across the app.
 */
export function DonorLinkScreen({
  children,
  header,
  footer,
  scroll = true,
  padded = true,
  refreshing,
  onRefresh,
  inTabs,
  hideOfflineBanner,
  contentClassName,
}: DonorLinkScreenProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const body = scroll ? (
    <ScrollView
      className="flex-1"
      contentContainerClassName={cn('grow gap-4 pb-8 pt-2', padded && 'px-4', contentClassName)}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View className={cn('flex-1 gap-4 pb-4 pt-2', padded && 'px-4', contentClassName)}>{children}</View>
  );

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ paddingTop: insets.top }}
    >
      {header ? <DonorLinkHeader {...header} /> : null}
      {hideOfflineBanner ? null : <OfflineBanner />}
      {body}
      {footer ? (
        <View
          className="gap-2 border-t border-border bg-surface px-4 pt-3"
          style={{ paddingBottom: inTabs ? 12 : Math.max(insets.bottom, 12) }}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
