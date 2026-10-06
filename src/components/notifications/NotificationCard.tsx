import { Pressable, View } from 'react-native';
import { cn } from '@gluestack-ui/utils/nativewind-utils';

import { DonorLinkIcon, type IconName } from '@/components/ui/DonorLinkIcon';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { NOTIFICATION_CATEGORY_LABELS, type NotificationCategory } from '@/domain';
import type { ColorToken } from '@/theme/tokens';
import { formatRelativeTime } from '@/lib/format';
import type { AppNotification } from '@/types/entities';

const CATEGORY_STYLE: Record<NotificationCategory, { icon: IconName; color: ColorToken; bg: string }> = {
  emergency: { icon: 'alert-circle', color: 'emergency', bg: 'bg-emergency-soft' },
  requests: { icon: 'water', color: 'primary', bg: 'bg-primary-soft' },
  donations: { icon: 'heart', color: 'success', bg: 'bg-success-soft' },
  account: { icon: 'person-circle', color: 'info', bg: 'bg-info-soft' },
};

/**
 * Says what happened, when, and what you can do about it (the action label),
 * and deep-links when tapped. Unread items carry a dot AND bolder text.
 */
export function NotificationCard({ notification, onPress }: { notification: AppNotification; onPress: () => void }) {
  const style = CATEGORY_STYLE[notification.category];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${notification.read ? '' : 'Unread. '}${NOTIFICATION_CATEGORY_LABELS[notification.category]}. ${notification.title}. ${notification.body}. ${formatRelativeTime(notification.$createdAt)}.${notification.actionLabel ? ` ${notification.actionLabel}.` : ''}`}
      className={cn(
        'flex-row gap-3 rounded-lg border p-3 active:opacity-80',
        notification.read ? 'border-border bg-surface' : 'border-primary/30 bg-elevated',
      )}
    >
      <View className={cn('h-10 w-10 items-center justify-center rounded-full', style.bg)}>
        <DonorLinkIcon name={style.icon} size={22} color={style.color} />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center justify-between gap-2">
          <DonorLinkText variant={notification.read ? 'body' : 'bodyStrong'} numberOfLines={2} className="flex-1">
            {notification.title}
          </DonorLinkText>
          {!notification.read ? <View className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
        </View>
        <DonorLinkText variant="bodySmall" tone="secondary" numberOfLines={3}>
          {notification.body}
        </DonorLinkText>
        <View className="mt-1 flex-row items-center justify-between">
          <DonorLinkText variant="caption" tone="muted">
            {formatRelativeTime(notification.$createdAt)}
          </DonorLinkText>
          {notification.actionLabel ? (
            <View className="flex-row items-center gap-1">
              <DonorLinkText variant="label" tone="primary">
                {notification.actionLabel}
              </DonorLinkText>
              <DonorLinkIcon name="chevron-forward" size={14} color="primary" />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
