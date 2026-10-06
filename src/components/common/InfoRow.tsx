import type { ReactNode } from 'react';
import { View } from 'react-native';

import { DonorLinkIcon, type IconName } from '@/components/ui/DonorLinkIcon';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { MEDICAL_DISCLAIMER } from '@/domain';

/** Label/value pair used in the structured information cards (Request Details). */
export function InfoRow({ icon, label, value, children }: { icon?: IconName; label: string; value?: string | null; children?: ReactNode }) {
  return (
    <View className="min-h-[44px] flex-row items-start gap-3 py-2" accessible accessibilityLabel={value ? `${label}: ${value}` : label}>
      {icon ? (
        <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-md bg-subtle">
          <DonorLinkIcon name={icon} size={18} color="fgSecondary" />
        </View>
      ) : null}
      <View className="flex-1 gap-0.5">
        <DonorLinkText variant="caption" tone="muted">
          {label}
        </DonorLinkText>
        {value ? <DonorLinkText variant="bodyStrong">{value}</DonorLinkText> : null}
        {children}
      </View>
    </View>
  );
}

export function Divider() {
  return <View className="h-px bg-border" />;
}

/** Required wherever matching or compatibility is shown. */
export function MedicalDisclaimer({ compact }: { compact?: boolean }) {
  return compact ? (
    <DonorLinkText variant="caption" tone="muted">
      {MEDICAL_DISCLAIMER}
    </DonorLinkText>
  ) : (
    <DonorLinkBanner tone="neutral" title="Medical note" message={MEDICAL_DISCLAIMER} />
  );
}
