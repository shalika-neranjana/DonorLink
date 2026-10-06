import { View } from 'react-native';

import { VerificationBadge } from '@/components/common/StatusBadges';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkIcon } from '@/components/ui/DonorLinkIcon';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { ORGANIZATION_TYPE_LABELS } from '@/domain';
import type { Organization } from '@/types/entities';

export function HospitalCard({ organization, onPress }: { organization: Organization; onPress?: () => void }) {
  return (
    <DonorLinkCard
      onPress={onPress}
      accessibilityLabel={`${organization.name}, ${ORGANIZATION_TYPE_LABELS[organization.type]}, ${organization.district}`}
      className="gap-2"
    >
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-md bg-primary-soft">
          <DonorLinkIcon name={organization.type === 'hospital' ? 'medkit' : 'water'} size={22} color="primary" />
        </View>
        <View className="flex-1">
          <DonorLinkText variant="bodyStrong" numberOfLines={2}>
            {organization.name}
          </DonorLinkText>
          <DonorLinkText variant="bodySmall" tone="secondary">
            {ORGANIZATION_TYPE_LABELS[organization.type]} · {organization.city ? `${organization.city}, ` : ''}
            {organization.district}
          </DonorLinkText>
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <VerificationBadge
          status={organization.verificationStatus}
          size="sm"
          label={organization.claimed ? undefined : 'Directory listing'}
        />
      </View>
    </DonorLinkCard>
  );
}
