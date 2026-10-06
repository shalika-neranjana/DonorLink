import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { BloodGroupBadge } from '@/components/blood/BloodGroupBadge';
import { Divider, InfoRow, MedicalDisclaimer } from '@/components/common/InfoRow';
import { AvailabilityBadge, ResponseStatusBadge, VerificationBadge } from '@/components/common/StatusBadges';
import { MatchScoreCard } from '@/components/matching/MatchScoreCard';
import { DonorLinkAvatar } from '@/components/ui/DonorLinkAvatar';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkBanner, DonorLinkEmptyState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { formatDistance } from '@/domain';
import { matchCache } from '@/features/requester/matchCache';
import { useResource } from '@/hooks/useResource';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { pluralize } from '@/lib/format';
import { matchingService } from '@/services/matchingService';
import type { MatchedDonor } from '@/types/entities';

/**
 * Donor details for a requester. Shows only what is needed to coordinate: no
 * phone, no address, no identity documents.
 */
export default function DonorDetailsScreen() {
  const { id: donorId, requestId } = useLocalSearchParams<{ id: string; requestId: string }>();
  const router = useRouter();
  const toast = useToast();
  const [contacting, setContacting] = useState(false);

  const { data, loading, reload } = useResource<MatchedDonor | null>(
    async () => {
      const cached = matchCache.find(requestId!, donorId!);
      if (cached) return cached;
      const result = await matchingService.getMatches(requestId!, {});
      matchCache.set(requestId!, result.matches);
      return matchCache.find(requestId!, donorId!) ?? null;
    },
    [donorId, requestId],
    { enabled: !!donorId && !!requestId },
  );

  async function contact() {
    if (contacting || !data) return;
    setContacting(true);
    try {
      await matchingService.contactDonor(requestId!, data.donorId);
      toast.success('Donor notified', 'You will see their answer in Alerts.');
      matchCache.clear();
      await reload();
    } catch (e) {
      toast.error("We couldn't notify that donor", getErrorMessage(e));
    } finally {
      setContacting(false);
    }
  }

  if (loading) {
    return (
      <DonorLinkScreen header={{ title: 'Donor details' }}>
        <DonorLinkListSkeleton count={2} />
      </DonorLinkScreen>
    );
  }
  if (!data) {
    return (
      <DonorLinkScreen header={{ title: 'Donor details' }}>
        <DonorLinkEmptyState icon="person-outline" title="Donor no longer available" description="They may have changed their availability since this list was loaded." actionLabel="Back to matches" onAction={() => router.back()} />
      </DonorLinkScreen>
    );
  }

  return (
    <DonorLinkScreen
      header={{ title: 'Donor details' }}
      footer={
        !data.responseStatus ? (
          <DonorLinkButton title="Notify this donor" size="lg" leftIcon="notifications-outline" fullWidth loading={contacting} onPress={() => void contact()} />
        ) : undefined
      }
    >
      <DonorLinkCard variant="elevated" className="gap-4">
        <View className="flex-row items-center gap-4">
          <DonorLinkAvatar name={data.displayName} size="lg" />
          <View className="flex-1 gap-1.5">
            <DonorLinkText variant="heading">{data.displayName}</DonorLinkText>
            <View className="flex-row flex-wrap gap-1.5">
              <VerificationBadge status={data.verificationStatus} size="sm" />
              <AvailabilityBadge availability={data.availability} size="sm" />
            </View>
          </View>
          <BloodGroupBadge group={data.bloodGroup} size="lg" />
        </View>
        <Divider />
        <InfoRow icon="location-outline" label="Approximate distance" value={`${formatDistance(data.distanceKm)} away`} />
        <InfoRow icon="water-outline" label="Blood group (self-reported)" value={`${data.bloodGroup}${data.exactGroup ? ' · same as the request' : ' · compatible with the request'}`} />
        <InfoRow icon="heart-outline" label="Donation history" value={data.donationCount > 0 ? `${pluralize(data.donationCount, 'donation')} through DonorLink` : 'No donations recorded yet'} />
        {data.responseStatus ? (
          <InfoRow icon="chatbubble-ellipses-outline" label="Response to your request">
            <ResponseStatusBadge status={data.responseStatus} />
          </InfoRow>
        ) : null}
      </DonorLinkCard>

      <MatchScoreCard donor={data} />

      <DonorLinkBanner tone="neutral" title="Privacy" message="DonorLink never shows a donor's phone number, address or documents. Coordination happens in the app and at the hospital." />
      <MedicalDisclaimer compact />
    </DonorLinkScreen>
  );
}
