import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { MedicalDisclaimer } from '@/components/common/InfoRow';
import { DonorCard } from '@/components/matching/DonorCard';
import { RequestStatusBadge, UrgencyBadge } from '@/components/common/StatusBadges';
import { BloodGroupBadge } from '@/components/blood/BloodGroupBadge';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkChip } from '@/components/ui/DonorLinkPickers';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkBanner, DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { matchCache } from '@/features/requester/matchCache';
import { useRequestDetail } from '@/hooks/useRequestDetail';
import { useResource } from '@/hooks/useResource';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { pluralize } from '@/lib/format';
import { matchingService } from '@/services/matchingService';

const RADII = [10, 25, 50, 100];

/** Matching Donors: compare blood group, distance and availability side by side. */
export default function MatchingDonorsScreen() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const router = useRouter();
  const toast = useToast();
  const detail = useRequestDetail(id);
  const [radius, setRadius] = useState(25);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [contactingId, setContactingId] = useState<string | null>(null);

  const matches = useResource(
    async () => {
      const result = await matchingService.getMatches(id!, { radiusKm: radius, verifiedOnly });
      matchCache.set(id!, result.matches);
      return result;
    },
    [id, radius, verifiedOnly],
    { enabled: !!id, reloadOnFocus: true },
  );

  const request = detail.data?.request;
  const waiting = request && ['submitted', 'pending_verification'].includes(request.status);
  const closed = request && ['completed', 'cancelled', 'expired', 'rejected'].includes(request.status);

  async function contact(donorId: string) {
    if (contactingId) return;
    setContactingId(donorId);
    try {
      await matchingService.contactDonor(id!, donorId);
      toast.success('Donor notified', 'You will see their answer here and in Alerts.');
      await Promise.all([matches.reload(), detail.reload()]);
    } catch (e) {
      toast.error("We couldn't notify that donor", getErrorMessage(e));
    } finally {
      setContactingId(null);
    }
  }

  return (
    <DonorLinkScreen
      refreshing={matches.refreshing}
      onRefresh={() => void matches.reload()}
      header={{ title: 'Matching donors', subtitle: request ? `${pluralize(request.units, 'unit')} of ${request.bloodGroup} · ${request.hospitalName}` : undefined, onBack: fresh ? () => router.replace('/requests') : 'auto' }}
      footer={
        <>
          <DonorLinkButton title="Continue to request details" size="lg" fullWidth rightIcon="arrow-forward" onPress={() => router.push(`/requests/${id}` as Href)} />
          <DonorLinkButton title="Track progress" variant="ghost" fullWidth leftIcon="git-commit" onPress={() => router.push(`/requests/tracking?id=${id}` as Href)} />
        </>
      }
    >
      {request ? (
        <DonorLinkCard variant="tinted" className="flex-row items-center gap-3">
          <BloodGroupBadge group={request.bloodGroup} />
          <View className="flex-1 gap-1">
            <View className="flex-row flex-wrap gap-1.5">
              <UrgencyBadge urgency={request.urgency} size="sm" />
              <RequestStatusBadge status={request.status} size="sm" />
            </View>
            <DonorLinkText variant="caption" tone="muted">
              {request.unitsAccepted} of {request.units} donors accepted
            </DonorLinkText>
          </View>
        </DonorLinkCard>
      ) : null}

      {fresh ? (
        <DonorLinkBanner tone="success" title="Request submitted" message={waiting ? "We're verifying it. Donors are contacted automatically once it is verified." : 'Donors are being contacted now.'} />
      ) : waiting ? (
        <DonorLinkBanner tone="warning" title="Waiting for verification" message="You can see who is nearby, but donors are only notified after the request is verified." />
      ) : closed ? (
        <DonorLinkBanner tone="neutral" message="This request is closed, so donors can no longer be contacted." />
      ) : null}

      <View className="gap-2">
        <DonorLinkText variant="label" tone="secondary">
          Search within
        </DonorLinkText>
        <View className="flex-row flex-wrap gap-2">
          {RADII.map((km) => (
            <DonorLinkChip key={km} label={`${km} km`} selected={radius === km} onPress={() => setRadius(km)} />
          ))}
          <DonorLinkChip label="Verified donors only" icon="shield-checkmark-outline" selected={verifiedOnly} onPress={() => setVerifiedOnly((v) => !v)} />
        </View>
      </View>

      {matches.loading ? (
        <DonorLinkListSkeleton />
      ) : matches.error && !matches.data ? (
        <DonorLinkErrorState message={matches.error.message} onRetry={() => void matches.reload()} />
      ) : matches.data && matches.data.matches.length === 0 ? (
        <DonorLinkEmptyState
          icon="people-outline"
          title="We couldn't find a suitable available donor nearby"
          description={radius < 100 ? 'Try a wider search area. We only list donors who are marked available right now.' : 'No available donors match this request right now. We will notify donors as soon as they become available.'}
          actionLabel={radius < 100 ? `Search within ${RADII.find((r) => r > radius) ?? 100} km` : undefined}
          onAction={radius < 100 ? () => setRadius(RADII.find((r) => r > radius) ?? 100) : undefined}
          secondaryActionLabel={verifiedOnly ? 'Include unverified donors' : undefined}
          onSecondaryAction={verifiedOnly ? () => setVerifiedOnly(false) : undefined}
        />
      ) : (
        <View className="gap-3">
          <DonorLinkText variant="bodySmall" tone="secondary">
            {pluralize(matches.data?.matches.length ?? 0, 'donor')} within {matches.data?.searchedRadiusKm} km, best match first
          </DonorLinkText>
          {matches.data?.matches.map((donor) => (
            <DonorCard
              key={donor.donorId}
              donor={donor}
              onPress={() => router.push(`/requests/donor/${donor.donorId}?requestId=${id}` as Href)}
              onContact={!waiting && !closed && !donor.responseStatus ? () => void contact(donor.donorId) : undefined}
              contacting={contactingId === donor.donorId}
            />
          ))}
        </View>
      )}
      <MedicalDisclaimer compact />
    </DonorLinkScreen>
  );
}
