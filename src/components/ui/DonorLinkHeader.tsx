import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { DonorLinkIcon, type IconName } from './DonorLinkIcon';
import { DonorLinkText } from './DonorLinkText';

export interface HeaderAction {
  icon: IconName;
  label: string;
  onPress: () => void;
  badgeCount?: number;
}

export interface DonorLinkHeaderProps {
  title: string;
  subtitle?: string;
  /** Show a back button. Defaults to true when the router can go back. */
  onBack?: (() => void) | 'auto' | false;
  actions?: HeaderAction[];
  right?: ReactNode;
  /** `large` for top-level tab screens, `compact` for detail screens. */
  size?: 'large' | 'compact';
}

/**
 * Consistent screen header: same back button position, same title style on
 * every screen (Milestone 02: keep navigation labels and positions consistent).
 */
export function DonorLinkHeader({ title, subtitle, onBack = 'auto', actions, right, size = 'compact' }: DonorLinkHeaderProps) {
  const router = useRouter();
  const canGoBack = onBack !== false && (onBack !== 'auto' || router.canGoBack());
  const handleBack = typeof onBack === 'function' ? onBack : () => router.back();

  return (
    <View className="flex-row items-center gap-2 px-4 pb-2 pt-2">
      {canGoBack ? (
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          className="-ml-2 h-11 w-11 items-center justify-center rounded-full active:bg-subtle"
        >
          <DonorLinkIcon name="arrow-back" size={24} />
        </Pressable>
      ) : null}
      <View className="flex-1">
        <DonorLinkText variant={size === 'large' ? 'heading' : 'title'} numberOfLines={1} accessibilityRole="header">
          {title}
        </DonorLinkText>
        {subtitle ? (
          <DonorLinkText variant="bodySmall" tone="secondary" numberOfLines={1}>
            {subtitle}
          </DonorLinkText>
        ) : null}
      </View>
      {actions?.map((action) => (
        <Pressable
          key={action.label}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.badgeCount ? `${action.label}, ${action.badgeCount} unread` : action.label}
          hitSlop={6}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-subtle"
        >
          <DonorLinkIcon name={action.icon} size={24} />
          {action.badgeCount ? (
            <View className="absolute right-1 top-1 min-w-[18px] items-center rounded-full bg-emergency px-1">
              <DonorLinkText variant="caption" tone="inverse" className="text-[10px] leading-[16px]">
                {action.badgeCount > 9 ? '9+' : action.badgeCount}
              </DonorLinkText>
            </View>
          ) : null}
        </Pressable>
      ))}
      {right}
    </View>
  );
}
