import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { useThemeColors } from '@/theme/useThemeColors';
import type { ColorToken } from '@/theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export interface DonorLinkIconProps {
  name: IconName;
  size?: number;
  /** Semantic colour token, resolved for the current light/dark scheme. */
  color?: ColorToken;
}

/**
 * One icon set (Ionicons) with semantic colour tokens. Icons are decorative by
 * default (hidden from screen readers); pair them with visible text or give the
 * parent control an accessibilityLabel.
 */
export function DonorLinkIcon({ name, size = 20, color = 'fg' }: DonorLinkIconProps) {
  const colors = useThemeColors();
  return (
    <Ionicons
      name={name}
      size={size}
      color={colors[color]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
