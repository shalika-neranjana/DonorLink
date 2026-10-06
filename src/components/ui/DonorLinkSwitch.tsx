import { createSwitch } from '@gluestack-ui/core/switch/creator';
import { Switch as RNSwitch, View } from 'react-native';

import { useThemeColors } from '@/theme/useThemeColors';
import { DonorLinkText } from './DonorLinkText';

const UISwitch = createSwitch({ Root: RNSwitch });

// react-native-web reads the active thumb colour from this extra prop (ignored on native).
const WEB_THUMB = { activeThumbColor: '#ffffff' } as object;

export interface DonorLinkSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
}

/** gluestack switch primitive themed with DonorLink tokens. */
export function DonorLinkSwitch({ value, onValueChange, disabled, accessibilityLabel }: DonorLinkSwitchProps) {
  const colors = useThemeColors();
  return (
    <UISwitch
      value={value}
      disabled={disabled}
      onValueChange={onValueChange}
      accessibilityLabel={accessibilityLabel}
      trackColor={{ false: colors.borderStrong, true: colors.primary }}
      thumbColor="#ffffff"
      {...WEB_THUMB}
      ios_backgroundColor={colors.borderStrong}
    />
  );
}

export interface DonorLinkSwitchRowProps extends DonorLinkSwitchProps {
  title: string;
  description?: string;
}

/** Title + description + switch on one row; the whole row reads as one control. */
export function DonorLinkSwitchRow({ title, description, ...switchProps }: DonorLinkSwitchRowProps) {
  return (
    <View className="min-h-[56px] flex-row items-center gap-3 py-2">
      <View className="flex-1">
        <DonorLinkText variant="bodyStrong">{title}</DonorLinkText>
        {description ? (
          <DonorLinkText variant="bodySmall" tone="secondary">
            {description}
          </DonorLinkText>
        ) : null}
      </View>
      <DonorLinkSwitch {...switchProps} accessibilityLabel={switchProps.accessibilityLabel || title} />
    </View>
  );
}
