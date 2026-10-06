import { Pressable, View, type ViewProps } from 'react-native';
import { cn, tva, type VariantProps } from '@gluestack-ui/utils/nativewind-utils';

const cardStyle = tva({
  base: 'rounded-lg border p-4',
  variants: {
    variant: {
      default: 'border-border bg-surface',
      elevated: 'border-border bg-elevated shadow-sm',
      outline: 'border-border-strong bg-transparent',
      tinted: 'border-transparent bg-subtle',
      primary: 'border-transparent bg-primary-soft',
      emergency: 'border-emergency bg-emergency-soft',
      success: 'border-transparent bg-success-soft',
      warning: 'border-transparent bg-warning-soft',
    },
    padded: { false: 'p-0' },
  },
  defaultVariants: { variant: 'default' },
});

export interface DonorLinkCardProps extends ViewProps, VariantProps<typeof cardStyle> {
  className?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/** Surface for grouped information. Becomes a button when `onPress` is given. */
export function DonorLinkCard({
  variant,
  padded,
  className,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  children,
  ...props
}: DonorLinkCardProps) {
  const classes = cn(cardStyle({ variant, padded }), className);
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        className={cn(classes, 'active:opacity-80')}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View className={classes} {...props}>
      {children}
    </View>
  );
}
