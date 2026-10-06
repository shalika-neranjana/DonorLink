import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { cn } from '@gluestack-ui/utils/nativewind-utils';

import type { ColorToken } from '@/theme/tokens';
import { DonorLinkButton } from './DonorLinkButton';
import { DonorLinkCard } from './DonorLinkCard';
import { DonorLinkIcon, type IconName } from './DonorLinkIcon';
import { DonorLinkText } from './DonorLinkText';

export interface DonorLinkSectionProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
  className?: string;
}

/** A titled group of content with an optional "See all" style action. */
export function DonorLinkSection({ title, description, actionLabel, onAction, children, className }: DonorLinkSectionProps) {
  return (
    <View className={cn('gap-3', className)}>
      {title ? (
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <DonorLinkText variant="title" accessibilityRole="header">
              {title}
            </DonorLinkText>
            {description ? (
              <DonorLinkText variant="bodySmall" tone="secondary">
                {description}
              </DonorLinkText>
            ) : null}
          </View>
          {actionLabel && onAction ? <DonorLinkButton title={actionLabel} variant="ghost" size="sm" onPress={onAction} /> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export interface DonorLinkListRowProps {
  icon?: IconName;
  iconColor?: ColorToken;
  title: string;
  subtitle?: string;
  value?: string;
  /** Right-aligned custom element (badge, switch...). */
  trailing?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
  last?: boolean;
}

/** Row used in settings/profile style lists (≥56px tall touch target). */
export function DonorLinkListRow({
  icon,
  iconColor = 'primary',
  title,
  subtitle,
  value,
  trailing,
  onPress,
  destructive,
  showChevron = true,
  last,
}: DonorLinkListRowProps) {
  const content = (
    <View className={cn('min-h-[56px] flex-row items-center gap-3 px-4 py-3', !last && 'border-b border-border')}>
      {icon ? (
        <View className="h-9 w-9 items-center justify-center rounded-md bg-subtle">
          <DonorLinkIcon name={icon} size={20} color={destructive ? 'error' : iconColor} />
        </View>
      ) : null}
      <View className="flex-1">
        <DonorLinkText variant="bodyStrong" tone={destructive ? 'error' : 'default'}>
          {title}
        </DonorLinkText>
        {subtitle ? (
          <DonorLinkText variant="bodySmall" tone="secondary">
            {subtitle}
          </DonorLinkText>
        ) : null}
      </View>
      {value ? (
        <DonorLinkText variant="bodySmall" tone="muted" numberOfLines={1} className="max-w-[40%]">
          {value}
        </DonorLinkText>
      ) : null}
      {trailing}
      {onPress && showChevron ? <DonorLinkIcon name="chevron-forward" size={18} color="fgMuted" /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, value].filter(Boolean).join(', ')}
      className="active:bg-subtle"
    >
      {content}
    </Pressable>
  );
}

/** Card that groups ListRows with shared borders. */
export function DonorLinkListGroup({ children }: { children: ReactNode }) {
  return (
    <DonorLinkCard padded={false} className="overflow-hidden">
      {children}
    </DonorLinkCard>
  );
}
