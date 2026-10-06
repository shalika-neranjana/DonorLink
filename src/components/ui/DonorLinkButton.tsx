import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Platform, Pressable, View, type PressableProps } from 'react-native';
import { cn, tva, type VariantProps } from '@gluestack-ui/utils/nativewind-utils';

import { useThemeColors } from '@/theme/useThemeColors';
import type { ColorToken } from '@/theme/tokens';
import { DonorLinkIcon, type IconName } from './DonorLinkIcon';
import { DonorLinkText, type TextTone } from './DonorLinkText';

const buttonStyle = tva({
  base: 'flex-row items-center justify-center gap-2 rounded-md border',
  variants: {
    variant: {
      primary: 'border-primary bg-primary active:bg-primary-pressed',
      emergency: 'border-emergency bg-emergency active:opacity-85',
      success: 'border-success bg-success active:opacity-85',
      secondary: 'border-secondary bg-secondary active:bg-subtle',
      outline: 'border-border-strong bg-surface active:bg-subtle',
      ghost: 'border-transparent bg-transparent active:bg-subtle',
      danger: 'border-error bg-error-soft active:opacity-85',
    },
    size: {
      sm: 'min-h-[40px] px-3 py-2',
      md: 'min-h-[48px] px-4 py-3',
      lg: 'min-h-[56px] px-5 py-4',
    },
    fullWidth: { true: 'w-full self-stretch' },
    disabled: { true: 'border-disabled bg-disabled opacity-70' },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

type Variant = NonNullable<VariantProps<typeof buttonStyle>['variant']>;

const LABEL_TONE: Record<Variant, TextTone> = {
  primary: 'inverse',
  emergency: 'inverse',
  success: 'inverse',
  secondary: 'default',
  outline: 'default',
  ghost: 'primary',
  danger: 'error',
};

// Foreground colour for icons / spinner, per variant. The emergency button uses
// its own foreground token so contrast holds in both colour schemes.
const ICON_COLOR: Record<Variant, ColorToken> = {
  primary: 'primaryForeground',
  emergency: 'emergencyForeground',
  success: 'primaryForeground',
  secondary: 'secondaryForeground',
  outline: 'fg',
  ghost: 'primary',
  danger: 'error',
};

export interface DonorLinkButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: IconName;
  rightIcon?: IconName;
  className?: string;
  /** Spoken label if it should differ from the visible title. */
  accessibilityLabel?: string;
  haptic?: boolean;
}

/**
 * The one button used everywhere. 48px minimum touch target, visible loading
 * state, and while loading it ignores presses so an emergency action can't be
 * submitted twice.
 */
export function DonorLinkButton({
  title,
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading,
  disabled,
  leftIcon,
  rightIcon,
  className,
  accessibilityLabel,
  haptic = true,
  onPress,
  ...props
}: DonorLinkButtonProps) {
  const colors = useThemeColors();
  const isDisabled = !!disabled && !loading;
  const inert = loading || disabled;
  const iconColor: ColorToken = isDisabled ? 'disabledForeground' : ICON_COLOR[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inert, busy: !!loading }}
      disabled={inert ?? false}
      hitSlop={size === 'sm' ? { top: 4, bottom: 4, left: 4, right: 4 } : undefined}
      onPress={(event) => {
        if (haptic && Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress?.(event);
      }}
      className={cn(buttonStyle({ variant, size, fullWidth, disabled: isDisabled }), className)}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors[ICON_COLOR[variant]]} />
      ) : leftIcon ? (
        <DonorLinkIcon name={leftIcon} size={size === 'lg' ? 22 : 20} color={iconColor} />
      ) : null}
      <View className="shrink">
        <DonorLinkText
          variant="button"
          tone={isDisabled ? 'muted' : LABEL_TONE[variant]}
          numberOfLines={1}
          className={size === 'lg' ? 'text-[16px]' : undefined}
        >
          {title}
        </DonorLinkText>
      </View>
      {rightIcon && !loading ? <DonorLinkIcon name={rightIcon} size={20} color={iconColor} /> : null}
    </Pressable>
  );
}
