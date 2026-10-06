import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { BloodGroupBadge } from '@/components/blood/BloodGroupBadge';
import { Divider, InfoRow, MedicalDisclaimer } from '@/components/common/InfoRow';
import { RequestStatusBadge, ResponseStatusBadge, UrgencyBadge, VerificationBadge } from '@/components/common/StatusBadges';
import { DonorLinkBottomSheet } from '@/components/ui/DonorLinkBottomSheet';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkIcon } from '@/components/ui/DonorLinkIcon';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { DonorLinkConfirmDialog } from '@/components/ui/DonorLinkModal';
import { DonorLinkChip } from '@/components/ui/DonorLinkPickers';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkBanner, DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { DECLINE_REASONS, formatDistance, REQUEST_STATUS_LABELS } from '@/domain';
import { useDebouncedReload } from '@/hooks/useHomeData';
import { useRealtimeRows, useResource } from '@/hooks/useResource';
import { TABLES } from '@/lib/appwrite/config';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { formatDateTime, pluralize } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { donorService } from '@/services/donorService';
import { requestService } from '@/services/requestService';

/** Incoming Emergency Request: enough information to decide, then Accept or Decline. */
export default function IncomingRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const userId = user?.$id;

  const { data, error, loading, reload } = useResource(
    async () => {
      const [request, response] = await Promise.all([requestService.getRequest(id!), donorService.getResponseForRequest(id!, userId!)]);
      return { request, response };
    },
    [id, userId],
    { enabled: !!id && !!userId, reloadOnFocus: true },
  );
  const debounced = useDebouncedReload(reload, 300);
  useRealtimeRows(TABLES.bloodRequests, id, debounced, !!id);

  const [acceptOpen, setAcceptOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [otherReason, setOtherReason] = useState('');
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [outcome, setOutcome] = useState<'accepted' | 'declined' | null>(null);

  const request = data?.request;
  const response = data?.response;

  async function accept() {
    if (busy) return;
    setBusy('accept');
    try {
      await donorService.accept(id!);
      setAcceptOpen(false);
      setOutcome('accepted');
    } catch (e) {
      setAcceptOpen(false);
      toast.error("We couldn't accept this request", getErrorMessage(e));
      await reload();
    } finally {
      setBusy(null);
    }
  }

  async function decline() {
    if (busy) return;
    setBusy('decline');
    try {
      await donorService.decline(id!, (otherReason.trim() || reason) ?? undefined);
      setDeclineOpen(false);
      setOutcome('declined');
    } catch (e) {
      setDeclineOpen(false);
      toast.error("We couldn't decline this request", getErrorMessage(e));
      await reload();
    } finally {
      setBusy(null);
    }
  }

  if (outcome) {
    const accepted = outcome === 'accepted';
    return (
      <DonorLinkScreen header={{ title: accepted ? 'Thank you' : 'Response sent', onBack: false }} footer={<DonorLinkButton title="Back to home" size="lg" fullWidth onPress={() => router.replace('/')} />}>
        <View className="items-center gap-4 py-10">
          <Animated.View entering={ZoomIn.duration(300)} className={`h-24 w-24 items-center justify-center rounded-full ${accepted ? 'bg-success-soft' : 'bg-subtle'}`}>
            <DonorLinkIcon name={accepted ? 'checkmark-circle' : 'close-circle-outline'} size={56} color={accepted ? 'success' : 'fgSecondary'} />
          </Animated.View>
          <DonorLinkText variant="heading" align="center">
            {accepted ? "You've accepted this request" : "You've declined this request"}
          </DonorLinkText>
          <DonorLinkText variant="body" tone="secondary" align="center">
            {accepted
              ? `${request?.requesterName ?? 'The requester'} and ${request?.hospitalName ?? 'the hospital'} have been told. Head to the hospital when you can; staff will confirm your donation.`
              : 'The requester has been told, and we will keep looking for other donors. Thank you for responding.'}
          </DonorLinkText>
          {accepted ? <DonorLinkButton title="See coordination details" variant="outline" leftIcon="navigate-outline" onPress={() => router.replace(`/donor/donation/${id}` as Href)} /> : null}
        </View>
      </DonorLinkScreen>
    );
  }

  if (loading) {
    return (
      <DonorLinkScreen header={{ title: 'Emergency request' }}>
        <DonorLinkListSkeleton count={3} />
      </DonorLinkScreen>
    );
  }
  if (error && !data) {
    return (
      <DonorLinkScreen header={{ title: 'Emergency request' }}>
        <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
      </DonorLinkScreen>
    );
  }
  if (!request || !response) {
    return (
      <DonorLinkScreen header={{ title: 'Emergency request' }}>
        <DonorLinkEmptyState icon="alert-circle-outline" title="This request isn't available" description="It may have been closed, or it was not sent to you." actionLabel="Back to home" onAction={() => router.replace('/')} />
      </DonorLinkScreen>
    );
  }

  const closed = ['fulfilled', 'completed', 'cancelled', 'expired', 'rejected'].includes(request.status);
  const answerable = response.status === 'pending' && !closed;

  return (
    <DonorLinkScreen
      header={{ title: 'Emergency request', subtitle: `${pluralize(request.units, 'unit')} of ${request.bloodGroup} needed` }}
      footer={
        answerable ? (
          <View className="flex-row gap-3">
            <View className="flex-1">
              <DonorLinkButton title="Decline" variant="outline" size="lg" leftIcon="close" fullWidth disabled={!!busy} accessibilityLabel="Decline this request" onPress={() => setDeclineOpen(true)} />
            </View>
            <View className="flex-[1.4]">
              <DonorLinkButton title="Accept" variant="success" size="lg" leftIcon="checkmark" fullWidth accessibilityLabel="Accept this request and donate" onPress={() => setAcceptOpen(true)} />
            </View>
          </View>
        ) : undefined
      }
    >
      {request.urgency === 'critical' ? <DonorLinkBanner tone="emergency" title="Critical request" message="Blood is needed within hours. A quick answer helps the hospital plan." /> : null}
      {!answerable ? (
        <DonorLinkBanner
          tone={response.status === 'accepted' ? 'success' : 'neutral'}
          title={response.status === 'accepted' ? "You've accepted this request" : closed ? `This request is ${REQUEST_STATUS_LABELS[request.status].toLowerCase()}` : 'You already responded'}
          message={response.status === 'accepted' ? 'See coordination details for next steps.' : 'No action is needed.'}
          actionLabel={response.status === 'accepted' ? 'Coordination details' : undefined}
          onAction={response.status === 'accepted' ? () => router.push(`/donor/donation/${id}` as Href) : undefined}
        />
      ) : null}

      <DonorLinkCard variant="elevated" className="gap-3">
        <View className="flex-row items-center gap-4">
          <BloodGroupBadge group={request.bloodGroup} size="lg" solid />
          <View className="flex-1 gap-1.5">
            <DonorLinkText variant="heading">{pluralize(request.units, 'unit')}</DonorLinkText>
            <View className="flex-row flex-wrap gap-1.5">
              <UrgencyBadge urgency={request.urgency} size="sm" />
              <VerificationBadge status={request.verificationStatus} size="sm" label={request.verificationStatus === 'verified' ? 'Verified request' : undefined} />
              <ResponseStatusBadge status={response.status} size="sm" />
            </View>
          </View>
        </View>
        <Divider />
        <InfoRow icon="business-outline" label="Hospital" value={request.hospitalName} />
        <InfoRow icon="location-outline" label="Location" value={[request.wardUnit, request.city, request.district].filter(Boolean).join(', ')} />
        <InfoRow icon="navigate-outline" label="Approximate distance from you" value={response.distanceKm != null ? `${formatDistance(response.distanceKm)} away` : 'Distance unknown'} />
        {request.requiredBy ? <InfoRow icon="time-outline" label="Needed by" value={formatDateTime(request.requiredBy)} /> : null}
        <InfoRow icon="person-outline" label="Requested by" value={request.requesterName} />
        {request.relationship ? <InfoRow icon="people-outline" label="Request is for" value={request.relationship} /> : null}
        {request.notes ? <InfoRow icon="document-text-outline" label="Notes from the requester" value={request.notes} /> : null}
        <Divider />
        <View className="flex-row items-center justify-between">
          <DonorLinkText variant="bodySmall" tone="secondary">
            Request status
          </DonorLinkText>
          <RequestStatusBadge status={request.status} size="sm" />
        </View>
        <DonorLinkText variant="caption" tone="muted">
          {request.unitsAccepted} of {request.units} donors have accepted so far.
        </DonorLinkText>
      </DonorLinkCard>

      <MedicalDisclaimer />

      <DonorLinkConfirmDialog
        visible={acceptOpen}
        title="Accept this request?"
        message={`You're offering to donate for ${request.requesterName}'s request at ${request.hospitalName}. The hospital confirms your donation; final eligibility is decided by their staff.`}
        confirmLabel="Yes, I'll donate"
        cancelLabel="Not yet"
        tone="success"
        loading={busy === 'accept'}
        onCancel={() => setAcceptOpen(false)}
        onConfirm={() => void accept()}
      />

      <DonorLinkBottomSheet
        visible={declineOpen}
        onClose={() => (busy ? undefined : setDeclineOpen(false))}
        title="Why are you declining?"
        footer={
          <>
            <DonorLinkButton title="Decline request" variant="danger" leftIcon="close" loading={busy === 'decline'} onPress={() => void decline()} />
            <DonorLinkButton title="Go back" variant="ghost" disabled={busy === 'decline'} onPress={() => setDeclineOpen(false)} />
          </>
        }
      >
        <DonorLinkText variant="body" tone="secondary">
          A reason is optional, but helps the requester.
        </DonorLinkText>
        <View className="flex-row flex-wrap gap-2">
          {DECLINE_REASONS.map((r) => (
            <DonorLinkChip key={r} label={r} selected={reason === r} onPress={() => setReason(reason === r ? null : r)} />
          ))}
        </View>
        <DonorLinkInput label="Anything else? (optional)" value={otherReason} onChangeText={setOtherReason} maxLength={200} />
      </DonorLinkBottomSheet>
    </DonorLinkScreen>
  );
}
