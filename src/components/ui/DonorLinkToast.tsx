import { createToastHook } from '@gluestack-ui/core/toast/creator';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { AccessibilityInfo, Platform, Pressable, useWindowDimensions, View } from 'react-native';

import type { ColorToken } from '@/theme/tokens';
import { DonorLinkIcon, type IconName } from './DonorLinkIcon';
import { DonorLinkText } from './DonorLinkText';

const useGluestackToast = createToastHook(View);

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

const TONES: Record<ToastTone, { icon: IconName; color: ColorToken; bar: string }> = {
  success: { icon: 'checkmark-circle', color: 'success', bar: 'bg-success' },
  error: { icon: 'alert-circle', color: 'error', bar: 'bg-error' },
  info: { icon: 'information-circle', color: 'info', bar: 'bg-info' },
  warning: { icon: 'warning', color: 'warning', bar: 'bg-warning' },
};

const SIDE_MARGIN = 16;
const MAX_WIDTH = 420;

/**
 * The toast list wraps every toast in views that shrink to their content
 * (`alignItems: 'center'`). A percentage width has no definite parent to
 * resolve against there, so on native it collapsed to zero and only the 4px
 * colour bar was left: the "thin vertical line". An explicit width derived
 * from the window is definite on every platform. Enter/exit animation comes
 * from the toast list itself.
 */
export function ToastCard({ tone, title, message, onClose }: { tone: ToastTone; title: string; message?: string; onClose: () => void }) {
  const t = TONES[tone];
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(240, Math.min(windowWidth - SIDE_MARGIN * 2, MAX_WIDTH));
  return (
    <View testID="toast-card" style={{ width }} className="mt-2 self-center">
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        className="flex-row overflow-hidden rounded-md border border-border bg-elevated shadow-md"
      >
        <View className={`w-1 ${t.bar}`} />
        <View className="flex-1 flex-row items-start gap-3 p-3">
          <DonorLinkIcon name={t.icon} size={22} color={t.color} />
          <View className="flex-1">
            <DonorLinkText variant="bodyStrong">{title}</DonorLinkText>
            {message ? (
              <DonorLinkText variant="bodySmall" tone="secondary">
                {message}
              </DonorLinkText>
            ) : null}
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss message" hitSlop={10}>
            <DonorLinkIcon name="close" size={18} color="fgMuted" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/**
 * Brief, non-blocking feedback after an action ("Request submitted").
 * Built on the gluestack toast primitive; announced to screen readers.
 */
export function useToast() {
  const toast = useGluestackToast();
  return useMemo(() => {
    const show = (tone: ToastTone, title: string, message?: string, duration = 4000) => {
      const id = `${tone}-${title}`;
      if (toast.isActive(id)) return;
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(
          tone === 'error' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success,
        ).catch(() => undefined);
      }
      AccessibilityInfo.announceForAccessibility(message ? `${title}. ${message}` : title);
      toast.show({
        id,
        placement: 'top',
        duration,
        render: ({ id: toastId }) => <ToastCard tone={tone} title={title} message={message} onClose={() => toast.close(toastId)} />,
      });
    };
    return {
      success: (title: string, message?: string) => show('success', title, message),
      error: (title: string, message?: string) => show('error', title, message, 6000),
      info: (title: string, message?: string) => show('info', title, message),
      warning: (title: string, message?: string) => show('warning', title, message, 5000),
    };
  }, [toast]);
}
