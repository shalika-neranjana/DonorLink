import { View } from 'react-native';
import { cn, tva, type VariantProps } from '@gluestack-ui/utils/nativewind-utils';

import type { ColorToken } from '@/theme/tokens';
import { DonorLinkIcon, type IconName } from './DonorLinkIcon';
import { DonorLinkText, type TextTone } from './DonorLinkText';

const badgeStyle = tva({
  base: 'flex-row items-center gap-1 self-start rounded-full',
  variants: {
    tone: {
      neutral: 'bg-subtle',
      primary: 'bg-primary-soft',
      success: 'bg-success-soft',
      warning: 'bg-warning-soft',
      error: 'bg-error-soft',
      emergency: 'bg-emergency-soft',
      info: 'bg-info-soft',
    },
    size: {
      sm: 'px-2 py-0.5',
      md: 'px-2.5 py-1',
    },
  },
  defaultVariants: { tone: 'neutral', size: 'md' },
});

export type BadgeTone = NonNullable<VariantProps<typeof badgeStyle>['tone']>;

const TEXT_TONE: Record<BadgeTone, TextTone> = {
  neutral: 'secondary',
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  error: 'error',
  emergency: 'emergency',
  info: 'info',
};

const ICON_TOKEN: Record<BadgeTone, ColorToken> = {
  neutral: 'fgSecondary',
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  error: 'error',
  emergency: 'emergency',
  info: 'info',
};

export interface DonorLinkBadgeProps {
  label: string;
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  icon?: IconName;
  className?: string;
  accessibilityLabel?: string;
}

/**
 * Status chip. State is always conveyed by text (and usually an icon), never by
 * colour alone.
 */
export function DonorLinkBadge({ label, tone = 'neutral', size = 'md', icon, className, accessibilityLabel }: DonorLinkBadgeProps) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      className={cn(badgeStyle({ tone, size }), className)}
    >
      {icon ? <DonorLinkIcon name={icon} size={size === 'sm' ? 12 : 14} color={ICON_TOKEN[tone]} /> : null}
      <DonorLinkText variant={size === 'sm' ? 'caption' : 'label'} tone={TEXT_TONE[tone]} className="font-inter-semibold">
        {label}
      </DonorLinkText>
    </View>
  );
}
