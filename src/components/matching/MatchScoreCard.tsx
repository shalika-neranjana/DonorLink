import { View } from 'react-native';

import { MatchQualityBadge } from '@/components/common/StatusBadges';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkIcon } from '@/components/ui/DonorLinkIcon';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { MATCHING_DISCLAIMER } from '@/domain';
import type { MatchedDonor } from '@/types/entities';

/**
 * Explains *why* a donor is suggested. There is deliberately no percentage:
 * the label is derived from the visible reasons, so nothing implies clinical
 * precision.
 */
export function MatchScoreCard({ donor }: { donor: Pick<MatchedDonor, 'quality' | 'reasons' | 'recentlyDonated'> }) {
  return (
    <DonorLinkCard variant="primary" className="gap-3">
      <View className="flex-row items-center justify-between">
        <DonorLinkText variant="title">Why this donor</DonorLinkText>
        <MatchQualityBadge quality={donor.quality} />
      </View>
      <View className="gap-2">
        {donor.reasons.map((reason) => {
          const caution = /recent|pending|not yet|unknown/i.test(reason);
          return (
            <View key={reason} className="flex-row items-center gap-2">
              <DonorLinkIcon name={caution ? 'alert-circle-outline' : 'checkmark-circle'} size={18} color={caution ? 'warning' : 'success'} />
              <DonorLinkText variant="body" className="flex-1">
                {reason}
              </DonorLinkText>
            </View>
          );
        })}
      </View>
      <DonorLinkText variant="caption" tone="secondary">
        {MATCHING_DISCLAIMER}
      </DonorLinkText>
    </DonorLinkCard>
  );
}
