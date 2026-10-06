import { forwardRef, useId, useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { cn } from '@gluestack-ui/utils/nativewind-utils';

import { useThemeColors } from '@/theme/useThemeColors';
import { DonorLinkIcon, type IconName } from './DonorLinkIcon';
import { DonorLinkText } from './DonorLinkText';

export interface DonorLinkInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  helperText?: string;
  error?: string;
  leftIcon?: IconName;
  required?: boolean;
  /** Optional suffix, e.g. "units". */
  suffix?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Labelled text field with helper text, inline error, focus ring and an
 * accessible password reveal. Errors are announced and shown in text, not just
 * as a red border.
 */
export const DonorLinkInput = forwardRef<TextInput, DonorLinkInputProps>(function DonorLinkInput(
  { label, helperText, error, leftIcon, required, suffix, disabled, secureTextEntry, multiline, className, onFocus, onBlur, ...props },
  ref,
) {
  const colors = useThemeColors();
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isSecret = !!secureTextEntry;

  return (
    <View className={cn('gap-1.5', className)}>
      <View className="flex-row items-center">
        <DonorLinkText variant="label" tone="secondary" nativeID={`${id}-label`}>
          {label}
        </DonorLinkText>
        {required ? (
          <DonorLinkText variant="label" tone="emergency" accessibilityElementsHidden>
            {' *'}
          </DonorLinkText>
        ) : null}
      </View>

      <View
        className={cn(
          'min-h-[48px] flex-row items-center gap-2 rounded-md border bg-surface px-3',
          multiline && 'items-start py-2',
          focused ? 'border-primary' : 'border-border-strong',
          error && 'border-error',
          disabled && 'bg-subtle opacity-70',
        )}
      >
        {leftIcon ? <DonorLinkIcon name={leftIcon} size={18} color="fgMuted" /> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={helperText}
          accessibilityState={{ disabled: !!disabled }}
          aria-invalid={!!error}
          editable={!disabled}
          multiline={multiline}
          secureTextEntry={isSecret && !revealed}
          placeholderTextColor={colors.fgMuted}
          selectionColor={colors.primary}
          maxFontSizeMultiplier={1.4}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          className={cn(
            'flex-1 py-2.5 font-inter text-[15px] text-fg',
            multiline && 'min-h-[88px] py-1',
          )}
          style={multiline ? { textAlignVertical: 'top' } : undefined}
          {...props}
        />
        {suffix ? (
          <DonorLinkText variant="bodySmall" tone="muted">
            {suffix}
          </DonorLinkText>
        ) : null}
        {isSecret ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center"
          >
            <DonorLinkIcon name={revealed ? 'eye-off-outline' : 'eye-outline'} size={20} color="fgMuted" />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <View className="flex-row items-center gap-1" accessibilityLiveRegion="polite">
          <DonorLinkIcon name="alert-circle" size={14} color="error" />
          <DonorLinkText variant="bodySmall" tone="error" className="flex-1">
            {error}
          </DonorLinkText>
        </View>
      ) : helperText ? (
        <DonorLinkText variant="caption" tone="muted">
          {helperText}
        </DonorLinkText>
      ) : null}
    </View>
  );
});
