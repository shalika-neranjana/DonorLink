import { View } from 'react-native';
import { cn } from '@gluestack-ui/utils/nativewind-utils';

import type { BloodGroup } from '@/domain';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { spokenBloodGroup } from '@/lib/format';

const SIZES = {
  sm: { box: 'h-7 min-w-[36px] rounded-md px-2', text: 'text-[13px] leading-[18px]' },
  md: { box: 'h-9 min-w-[44px] rounded-md px-2.5', text: 'text-[16px] leading-[22px]' },
  lg: { box: 'h-16 w-16 rounded-full', text: 'text-[24px] leading-[30px]' },
} as const;

export interface BloodGroupBadgeProps {
  group: BloodGroup | string;
  size?: keyof typeof SIZES;
  /** Filled variant for emphasis (e.g. hero in request details). */
  solid?: boolean;
}

/** The blood group, always the most recognisable element on a card. */
export function BloodGroupBadge({ group, size = 'md', solid }: BloodGroupBadgeProps) {
  const s = SIZES[size];
  return (
    <View
      accessible
      accessibilityLabel={`Blood group ${spokenBloodGroup(group)}`}
      className={cn(
        'items-center justify-center border',
        s.box,
        solid ? 'border-emergency bg-emergency' : 'border-emergency/30 bg-emergency-soft',
      )}
    >
      <DonorLinkText
        variant="bodyStrong"
        tone={solid ? 'inverse' : 'emergency'}
        className={cn('font-inter-bold', s.text, solid && 'text-emergency-foreground')}
      >
        {group}
      </DonorLinkText>
    </View>
  );
}
