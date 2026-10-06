import { Text as RNText, type TextProps } from 'react-native';
import { cn, tva, type VariantProps } from '@gluestack-ui/utils/nativewind-utils';

/**
 * Typography. Variants are the only place type sizes are defined, so every
 * screen shares one scale. Text scales with the system font size setting up to
 * a cap that keeps layouts intact.
 */
export const textStyle = tva({
  base: '',
  variants: {
    variant: {
      display: 'font-inter-bold text-[30px] leading-[36px] tracking-tight',
      heading: 'font-inter-bold text-[22px] leading-[28px]',
      title: 'font-inter-semibold text-[17px] leading-[24px]',
      body: 'font-inter text-[15px] leading-[22px]',
      bodyStrong: 'font-inter-semibold text-[15px] leading-[22px]',
      bodySmall: 'font-inter text-[13px] leading-[19px]',
      label: 'font-inter-medium text-[13px] leading-[18px]',
      caption: 'font-inter text-[12px] leading-[16px]',
      button: 'font-inter-semibold text-[15px] leading-[20px]',
      overline: 'font-inter-semibold text-[11px] leading-[14px] uppercase tracking-wider',
    },
    tone: {
      default: 'text-fg',
      secondary: 'text-fg-secondary',
      muted: 'text-fg-muted',
      primary: 'text-primary',
      success: 'text-success',
      warning: 'text-warning',
      error: 'text-error',
      emergency: 'text-emergency',
      info: 'text-info',
      inverse: 'text-primary-foreground',
    },
    align: {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
    },
  },
  defaultVariants: { variant: 'body', tone: 'default' },
});

export type TextVariant = NonNullable<VariantProps<typeof textStyle>['variant']>;
export type TextTone = NonNullable<VariantProps<typeof textStyle>['tone']>;

export interface DonorLinkTextProps extends TextProps, VariantProps<typeof textStyle> {
  className?: string;
}

export function DonorLinkText({ variant, tone, align, className, maxFontSizeMultiplier = 1.4, ...props }: DonorLinkTextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      className={cn(textStyle({ variant, tone, align }), className)}
      {...props}
    />
  );
}
