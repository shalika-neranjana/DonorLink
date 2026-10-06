import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { BloodGroupBadge } from '@/components/blood/BloodGroupBadge';
import { Divider, InfoRow, MedicalDisclaimer } from '@/components/common/InfoRow';
import { RequestStatusBadge, UrgencyBadge, VerificationBadge } from '@/components/common/StatusBadges';
import { RequestStatusHero } from '@/components/requests/RequestStatusHero';
import { ResponseSummary } from '@/components/requests/ResponseSummary';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { DonorLinkConfirmDialog } from '@/components/ui/DonorLinkModal';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkSection } from '@/components/ui/DonorLinkSection';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { canCancelRequest, canVerifyRequest, isActiveRequestStatus } from '@/domain';
import { useRequestDetail } from '@/hooks/useRequestDetail';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { formatDateTime, pluralize } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { donationService } from '@/services/donationService';
import { requestService } from '@/services/requestService';
import type { Donation } from '@/types/entities';

export default function RequestDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user, labels } = useAuth();
  const { data, error, loading, refreshing, reload } = useRequestDetail(id);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectError, setRejectError] = useState<string | undefined>();

  const request = data?.request;
  const responses = data?.responses ?? [];
  const donations = data?.donations ?? [];
  const isOwner = !!request && request.requesterId === user?.$id;
  const canVerify =
    !!request &&
    ['submitted', 'pending_verification'].includes(request.status) &&
    canVerifyRequest({ userId: user?.$id ?? '', labels, requesterId: request.requesterId, hospitalOrganizationId: request.hospitalId });
  const canManage = !!request && (isOwner || canVerifyRequest({ userId: user?.$id ?? '', labels, requesterId: request.requesterId, hospitalOrganizationId: request.hospitalId }));

  async function run<T>(key: string, action: () => Promise<T>, success: string, successDetail?: string) {
    if (busy) return;
    setBusy(key);
    try {
      await action();
      toast.success(success, successDetail);
      await reload();
    } catch (e) {
      toast.error("That didn't work", getErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function confirmDonation(donation: Donation) {
    setConfirmingId(donation.$id);
    try {
      await donationService.confirm(donation.$id);
      toast.success('Donation confirmed', 'Thank you. The donor has been notified.');
      await reload();
    } catch (e) {
      toast.error("We couldn't confirm that donation", getErrorMessage(e));
    } finally {
      setConfirmingId(null);
    }
  }

  if (loading) {
    return (
      <DonorLinkScreen header={{ title: 'Request details' }}>
        <DonorLinkListSkeleton count={3} />
      </DonorLinkScreen>
    );
  }
  if (error && !data) {
    return (
      <DonorLinkScreen header={{ title: 'Request details' }}>
        <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
      </DonorLinkScreen>
    );
  }
  if (!request) {
    return (
      <DonorLinkScreen header={{ title: 'Request details' }}>
        <DonorLinkEmptyState icon="search-outline" title="Request not found" description="It may have been removed, or you may not have access to it." actionLabel="Back to requests" onAction={() => router.replace('/requests')} />
      </DonorLinkScreen>
    );
  }

  const active = isActiveRequestStatus(request.status);
  const openForDonors = ['verified', 'matching', 'donors_contacted', 'partially_fulfilled'].includes(request.status);

  return (
    <DonorLinkScreen
      refreshing={refreshing}
      onRefresh={() => void reload()}
      header={{ title: 'Request details', subtitle: `${pluralize(request.units, 'unit')} of ${request.bloodGroup}` }}
      footer={
        isOwner && active ? (
          <DonorLinkButton title="Track this request" size="lg" leftIcon="git-commit" fullWidth onPress={() => router.push(`/requests/tracking?id=${request.$id}` as Href)} />
        ) : undefined
      }
    >
      <RequestStatusHero request={request} />

      {canVerify ? (
        <DonorLinkCard variant="warning" className="gap-3">
          <DonorLinkText variant="bodyStrong">This request is waiting for verification</DonorLinkText>
          <DonorLinkText variant="bodySmall" tone="secondary">
            Confirm the hospital and patient need before donors are contacted.
          </DonorLinkText>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <DonorLinkButton title="Verify" variant="success" leftIcon="shield-checkmark" loading={busy === 'verify'} onPress={() => void run('verify', () => requestService.verifyRequest(request.$id, true), 'Request verified', 'Matching donors now.')} fullWidth />
            </View>
            <View className="flex-1">
              <DonorLinkButton title="Reject" variant="outline" leftIcon="close" disabled={!!busy} onPress={() => setRejectOpen(true)} fullWidth />
            </View>
          </View>
        </DonorLinkCard>
      ) : null}

      <DonorLinkCard variant="elevated" className="gap-3">
        <View className="flex-row items-center gap-4">
          <BloodGroupBadge group={request.bloodGroup} size="lg" solid />
          <View className="flex-1 gap-1.5">
            <DonorLinkText variant="heading">{pluralize(request.units, 'unit')}</DonorLinkText>
            <View className="flex-row flex-wrap gap-1.5">
              <UrgencyBadge urgency={request.urgency} size="sm" />
              <RequestStatusBadge status={request.status} size="sm" />
              <VerificationBadge status={request.verificationStatus} size="sm" label={request.verificationStatus === 'verified' ? 'Verified request' : request.verificationStatus === 'pending' ? 'Not yet verified' : undefined} />
            </View>
          </View>
        </View>
        <Divider />
        <InfoRow icon="business-outline" label="Hospital" value={request.hospitalName} />
        <InfoRow icon="location-outline" label="Location" value={[request.wardUnit, request.city, request.district].filter(Boolean).join(', ')} />
        {request.requiredBy ? <InfoRow icon="time-outline" label="Needed by" value={formatDateTime(request.requiredBy)} /> : null}
        <InfoRow icon="person-outline" label="Requested by" value={request.requesterName} />
        {request.relationship ? <InfoRow icon="people-outline" label="Request is for" value={request.relationship} /> : null}
        {request.notes ? <InfoRow icon="document-text-outline" label="Notes" value={request.notes} /> : null}
        <Divider />
        <InfoRow icon="calendar-outline" label="Created" value={formatDateTime(request.$createdAt)} />
        {request.verifiedAt ? <InfoRow icon="shield-checkmark-outline" label="Verified" value={formatDateTime(request.verifiedAt)} /> : null}
      </DonorLinkCard>

      {canManage ? (
        <DonorLinkSection title="Donor responses" description={`${request.unitsAccepted} of ${request.units} donors accepted`}>
          <ResponseSummary
            responses={responses}
            donations={donations}
            canManage={canManage}
            confirmingId={confirmingId}
            onConfirm={(d) => void confirmDonation(d)}
            onFindMore={isOwner && openForDonors ? () => router.push(`/requests/matching?id=${request.$id}` as Href) : undefined}
          />
        </DonorLinkSection>
      ) : null}

      {isOwner && request.status === 'fulfilled' ? (
        <DonorLinkButton
          title="Mark request as completed"
          variant="outline"
          leftIcon="checkmark-done"
          loading={busy === 'complete'}
          onPress={() => void run('complete', () => requestService.completeRequest(request.$id), 'Request completed')}
        />
      ) : null}

      {isOwner && canCancelRequest(request.status) ? (
        <DonorLinkButton title="Cancel this request" variant="danger" leftIcon="close-circle-outline" onPress={() => setCancelOpen(true)} />
      ) : null}

      <MedicalDisclaimer compact />

      <DonorLinkConfirmDialog
        visible={cancelOpen}
        title="Cancel this request?"
        message="Donors who were contacted or accepted will be told it was cancelled. This can't be undone."
        confirmLabel="Yes, cancel request"
        cancelLabel="Keep request"
        tone="danger"
        loading={busy === 'cancel'}
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => {
          void run('cancel', () => requestService.cancelRequest(request.$id, cancelReason.trim() || undefined), 'Request cancelled').then(() => setCancelOpen(false));
        }}
      >
        <DonorLinkInput label="Reason (optional)" value={cancelReason} onChangeText={setCancelReason} placeholder="e.g. Blood arranged elsewhere" maxLength={200} />
      </DonorLinkConfirmDialog>

      <DonorLinkConfirmDialog
        visible={rejectOpen}
        title="Reject this request?"
        message="The requester is told the reason, so they can correct and resubmit."
        confirmLabel="Reject request"
        cancelLabel="Go back"
        tone="danger"
        loading={busy === 'reject'}
        onCancel={() => setRejectOpen(false)}
        onConfirm={() => {
          if (!rejectNote.trim()) {
            setRejectError('Add a short reason.');
            return;
          }
          void run('reject', () => requestService.verifyRequest(request.$id, false, rejectNote.trim()), 'Request rejected').then(() => setRejectOpen(false));
        }}
      >
        <DonorLinkInput label="Reason" required value={rejectNote} onChangeText={(v) => { setRejectNote(v); setRejectError(undefined); }} error={rejectError} maxLength={200} />
      </DonorLinkConfirmDialog>
    </DonorLinkScreen>
  );
}
