import { View } from 'react-native';
import { cn, tva, type VariantProps } from '@gluestack-ui/utils/nativewind-utils';

import type { ColorToken } from '@/theme/tokens';
import { DonorLinkButton } from './DonorLinkButton';
import { DonorLinkIcon, type IconName } from './DonorLinkIcon';
import { DonorLinkText } from './DonorLinkText';

export interface DonorLinkEmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  compact?: boolean;
}

/** Helpful empty state: says what is missing and what to do next. */
export function DonorLinkEmptyState({
  icon = 'file-tray-outline',
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  compact,
}: DonorLinkEmptyStateProps) {
  return (
    <View className={cn('items-center px-6', compact ? 'gap-2 py-6' : 'gap-3 py-12')} accessibilityRole="summary">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-subtle">
        <DonorLinkIcon name={icon} size={26} color="fgMuted" />
      </View>
      <DonorLinkText variant="title" align="center">
        {title}
      </DonorLinkText>
      {description ? (
        <DonorLinkText variant="body" tone="secondary" align="center">
          {description}
        </DonorLinkText>
      ) : null}
      {actionLabel && onAction ? (
        <View className="mt-2 self-stretch">
          <DonorLinkButton title={actionLabel} onPress={onAction} />
        </View>
      ) : null}
      {secondaryActionLabel && onSecondaryAction ? (
        <DonorLinkButton title={secondaryActionLabel} variant="ghost" onPress={onSecondaryAction} />
      ) : null}
    </View>
  );
}

export interface DonorLinkErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
}

/** Error with a plain-language message and a retry action. */
export function DonorLinkErrorState({ title = 'Something went wrong', message, onRetry, retrying, compact }: DonorLinkErrorStateProps) {
  return (
    <View
      className={cn('items-center px-6', compact ? 'gap-2 py-6' : 'gap-3 py-12')}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View className="h-14 w-14 items-center justify-center rounded-full bg-error-soft">
        <DonorLinkIcon name="cloud-offline-outline" size={26} color="error" />
      </View>
      <DonorLinkText variant="title" align="center">
        {title}
      </DonorLinkText>
      <DonorLinkText variant="body" tone="secondary" align="center">
        {message}
      </DonorLinkText>
      {onRetry ? (
        <View className="mt-2 self-stretch">
          <DonorLinkButton title="Try again" variant="outline" leftIcon="refresh" loading={retrying} onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

const bannerStyle = tva({
  base: 'flex-row items-start gap-3 rounded-md border p-3',
  variants: {
    tone: {
      info: 'border-transparent bg-info-soft',
      success: 'border-transparent bg-success-soft',
      warning: 'border-transparent bg-warning-soft',
      error: 'border-transparent bg-error-soft',
      emergency: 'border-emergency bg-emergency-soft',
      neutral: 'border-border bg-subtle',
    },
  },
  defaultVariants: { tone: 'info' },
});

type BannerTone = NonNullable<VariantProps<typeof bannerStyle>['tone']>;

const BANNER_ICON: Record<BannerTone, { name: IconName; color: ColorToken }> = {
  info: { name: 'information-circle', color: 'info' },
  success: { name: 'checkmark-circle', color: 'success' },
  warning: { name: 'warning', color: 'warning' },
  error: { name: 'alert-circle', color: 'error' },
  emergency: { name: 'alert-circle', color: 'emergency' },
  neutral: { name: 'information-circle-outline', color: 'fgSecondary' },
};

export interface DonorLinkBannerProps {
  tone?: BannerTone;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/** Inline message that stays in the page flow (preferred over modal dialogs). */
export function DonorLinkBanner({ tone = 'info', title, message, actionLabel, onAction, className }: DonorLinkBannerProps) {
  const icon = BANNER_ICON[tone];
  return (
    <View
      accessibilityRole={tone === 'error' || tone === 'emergency' ? 'alert' : 'summary'}
      accessibilityLiveRegion="polite"
      className={cn(bannerStyle({ tone }), className)}
    >
      <DonorLinkIcon name={icon.name} size={20} color={icon.color} />
      <View className="flex-1 gap-1">
        {title ? <DonorLinkText variant="bodyStrong">{title}</DonorLinkText> : null}
        <DonorLinkText variant="bodySmall" tone="secondary">
          {message}
        </DonorLinkText>
        {actionLabel && onAction ? (
          <DonorLinkButton title={actionLabel} variant="ghost" size="sm" onPress={onAction} className="-ml-3 self-start" />
        ) : null}
      </View>
    </View>
  );
}
