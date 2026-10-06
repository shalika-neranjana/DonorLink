import { View } from 'react-native';

import { BloodGroupBadge } from '@/components/blood/BloodGroupBadge';
import { AvailabilityBadge, MatchQualityBadge, ResponseStatusBadge, VerificationBadge } from '@/components/common/StatusBadges';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkIcon, type IconName } from '@/components/ui/DonorLinkIcon';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { formatDistance } from '@/domain';
import type { MatchedDonor } from '@/types/entities';

function Fact({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View className="flex-1 gap-0.5" accessible accessibilityLabel={`${label}: ${value}`}>
      <DonorLinkText variant="caption" tone="muted">
        {label}
      </DonorLinkText>
      <View className="flex-row items-center gap-1">
        <DonorLinkIcon name={icon} size={14} color="fgSecondary" />
        <DonorLinkText variant="bodyStrong" numberOfLines={1}>
          {value}
        </DonorLinkText>
      </View>
    </View>
  );
}

export interface DonorCardProps {
  donor: MatchedDonor;
  onPress?: () => void;
  onContact?: () => void;
  contacting?: boolean;
}

/**
 * Donor comparison card. Milestone 02 testing found people needed blood group,
 * distance and availability side by side, so those three are always the first
 * row, in the same positions on every card.
 */
export function DonorCard({ donor, onPress, onContact, contacting }: DonorCardProps) {
  const contacted = donor.responseStatus !== null;
  return (
    <DonorLinkCard
      variant="elevated"
      onPress={onPress}
      accessibilityLabel={`${donor.displayName}, blood group ${donor.bloodGroup}, ${formatDistance(donor.distanceKm)}, ${donor.availability}`}
      accessibilityHint="Opens donor details"
      className="gap-3"
    >
      <View className="flex-row items-center gap-3">
        <BloodGroupBadge group={donor.bloodGroup} size="md" />
        <View className="flex-1">
          <DonorLinkText variant="title" numberOfLines={1}>
            {donor.displayName}
          </DonorLinkText>
          <View className="mt-1 flex-row flex-wrap gap-1.5">
            <MatchQualityBadge quality={donor.quality} size="sm" />
            <VerificationBadge status={donor.verificationStatus} size="sm" />
          </View>
        </View>
      </View>

      <View className="flex-row gap-3 rounded-md bg-subtle p-3">
        <Fact icon="water" label="Blood group" value={`${donor.bloodGroup}${donor.exactGroup ? ' (exact)' : ''}`} />
        <Fact icon="location" label="Distance" value={formatDistance(donor.distanceKm)} />
        <View className="flex-1 gap-0.5">
          <DonorLinkText variant="caption" tone="muted">
            Availability
          </DonorLinkText>
          <AvailabilityBadge availability={donor.availability} size="sm" />
        </View>
      </View>

      {contacted ? (
        <View className="flex-row items-center gap-2">
          <DonorLinkText variant="bodySmall" tone="secondary">
            Contacted:
          </DonorLinkText>
          <ResponseStatusBadge status={donor.responseStatus!} size="sm" />
        </View>
      ) : onContact ? (
        <DonorLinkButton title="Notify this donor" variant="primary" leftIcon="notifications-outline" size="md" loading={contacting} onPress={onContact} fullWidth />
      ) : null}
    </DonorLinkCard>
  );
}
