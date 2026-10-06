import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { BloodGroupBadge } from '@/components/blood/BloodGroupBadge';
import { RequestTimeline } from '@/components/requests/RequestTimeline';
import { RequestStatusHero } from '@/components/requests/RequestStatusHero';
import { ResponseSummary } from '@/components/requests/ResponseSummary';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkSection } from '@/components/ui/DonorLinkSection';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { buildTimeline, canVerifyRequest, parseStatusHistory } from '@/domain';
import { useRequestDetail } from '@/hooks/useRequestDetail';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { pluralize } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { donationService } from '@/services/donationService';
import type { Donation } from '@/types/entities';

/** Request Tracking: vertical timeline (Milestone 02 design) with live updates. */
export default function RequestTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user, labels } = useAuth();
  const { data, error, loading, refreshing, reload } = useRequestDetail(id);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const request = data?.request;
  const stages = useMemo(() => (request ? buildTimeline(request.status, parseStatusHistory(request.statusHistory)) : []), [request]);
  const canManage =
    !!request &&
    (request.requesterId === user?.$id ||
      canVerifyRequest({ userId: user?.$id ?? '', labels, requesterId: request.requesterId, hospitalOrganizationId: request.hospitalId }));

  async function confirm(donation: Donation) {
    setConfirmingId(donation.$id);
    try {
      await donationService.confirm(donation.$id);
      toast.success('Donation confirmed');
      await reload();
    } catch (e) {
      toast.error("We couldn't confirm that donation", getErrorMessage(e));
    } finally {
      setConfirmingId(null);
    }
  }

  if (loading) {
    return (
      <DonorLinkScreen header={{ title: 'Request tracking' }}>
        <DonorLinkListSkeleton count={3} />
      </DonorLinkScreen>
    );
  }
  if (error && !data) {
    return (
      <DonorLinkScreen header={{ title: 'Request tracking' }}>
        <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
      </DonorLinkScreen>
    );
  }
  if (!request) {
    return (
      <DonorLinkScreen header={{ title: 'Request tracking' }}>
        <DonorLinkEmptyState icon="search-outline" title="Request not found" actionLabel="Back to requests" onAction={() => router.replace('/requests')} />
      </DonorLinkScreen>
    );
  }

  const open = ['verified', 'matching', 'donors_contacted', 'partially_fulfilled'].includes(request.status);

  return (
    <DonorLinkScreen
      refreshing={refreshing}
      onRefresh={() => void reload()}
      header={{ title: 'Request tracking', subtitle: `${pluralize(request.units, 'unit')} · ${request.hospitalName}` }}
      footer={<DonorLinkButton title="View request details" variant="outline" fullWidth leftIcon="document-text-outline" onPress={() => router.push(`/requests/${request.$id}` as Href)} />}
    >
      <RequestStatusHero request={request} />

      <View className="flex-row items-center gap-2" accessible accessibilityLabel="Live updates are on">
        <View className="h-2 w-2 rounded-full bg-success" />
        <DonorLinkText variant="caption" tone="muted">
          Live updates on. This screen refreshes by itself.
        </DonorLinkText>
      </View>

      <DonorLinkCard className="gap-3">
        <View className="flex-row items-center gap-3">
          <BloodGroupBadge group={request.bloodGroup} />
          <DonorLinkText variant="title" className="flex-1">
            Progress
          </DonorLinkText>
        </View>
        <RequestTimeline stages={stages} />
      </DonorLinkCard>

      {canManage ? (
        <DonorLinkSection title="Donors" description={`${request.unitsAccepted} of ${request.units} accepted`}>
          <ResponseSummary
            responses={data?.responses ?? []}
            donations={data?.donations ?? []}
            canManage={canManage}
            confirmingId={confirmingId}
            onConfirm={(d) => void confirm(d)}
            onFindMore={request.requesterId === user?.$id && open ? () => router.push(`/requests/matching?id=${request.$id}` as Href) : undefined}
          />
        </DonorLinkSection>
      ) : null}
    </DonorLinkScreen>
  );
}
