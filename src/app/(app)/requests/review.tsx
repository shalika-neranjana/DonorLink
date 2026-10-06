import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { BloodGroupBadge } from '@/components/blood/BloodGroupBadge';
import { Divider, InfoRow, MedicalDisclaimer } from '@/components/common/InfoRow';
import { UrgencyBadge } from '@/components/common/StatusBadges';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { validateCreateRequest } from '@/domain';
import { useRequestDraft } from '@/features/requester/RequestDraftContext';
import { AppError, getErrorMessage } from '@/lib/appwrite/errors';
import { formatDateTime, pluralize } from '@/lib/format';
import { requestService } from '@/services/requestService';

export default function ReviewRequestScreen() {
  const router = useRouter();
  const toast = useToast();
  const { draft, clientId, reset } = useRequestDraft();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; duplicate: boolean } | null>(null);

  const result = validateCreateRequest({
    bloodGroup: draft.bloodGroup ?? undefined,
    units: draft.units,
    urgency: draft.urgency ?? undefined,
    hospitalId: draft.hospitalId,
    hospitalName: draft.hospitalName,
    district: draft.district,
    wardUnit: draft.wardUnit,
    requiredBy: draft.requiredBy,
    notes: draft.notes,
    relationship: draft.relationship,
  });

  async function submit() {
    if (submitting || !result.ok) return;
    setError(null);
    setSubmitting(true);
    try {
      const { request } = await requestService.createEmergencyRequest(result.value, clientId);
      reset();
      toast.success('Request submitted', request.status === 'pending_verification' ? "We're verifying it now." : 'Donors are being contacted.');
      // Create -> Review -> Submit -> Matching Donors (Milestone 02 flow).
      router.replace(`/requests/matching?id=${request.$id}&fresh=1` as Href);
    } catch (e) {
      const appError = e instanceof AppError ? e : null;
      setError({ message: getErrorMessage(e, "We couldn't submit your request."), duplicate: appError?.code === 'duplicate_request' });
    } finally {
      setSubmitting(false);
    }
  }

  if (!result.ok) {
    return (
      <DonorLinkScreen header={{ title: 'Review request' }}>
        <DonorLinkBanner tone="warning" title="Details missing" message="Go back and complete the highlighted details." actionLabel="Back to form" onAction={() => router.back()} />
      </DonorLinkScreen>
    );
  }

  const r = result.value;
  return (
    <DonorLinkScreen
      header={{ title: 'Review request', subtitle: 'Check the details before sending' }}
      footer={
        <>
          <DonorLinkButton
            title="Submit request"
            variant={r.urgency === 'critical' ? 'emergency' : 'primary'}
            size="lg"
            leftIcon="paper-plane"
            fullWidth
            loading={submitting}
            onPress={() => void submit()}
          />
          <DonorLinkButton title="Edit details" variant="ghost" fullWidth disabled={submitting} onPress={() => router.back()} />
        </>
      }
    >
      {error ? (
        <DonorLinkBanner
          tone="error"
          title="Request not sent"
          message={error.message}
          actionLabel={error.duplicate ? 'Open my requests' : undefined}
          onAction={error.duplicate ? () => router.replace('/requests') : undefined}
        />
      ) : null}

      <DonorLinkCard variant="elevated" className="gap-4">
        <View className="flex-row items-center gap-4">
          <BloodGroupBadge group={r.bloodGroup} size="lg" solid />
          <View className="flex-1 gap-1">
            <DonorLinkText variant="heading">{pluralize(r.units, 'unit')}</DonorLinkText>
            <UrgencyBadge urgency={r.urgency} />
          </View>
        </View>
        <Divider />
        <InfoRow icon="business-outline" label="Hospital" value={r.hospitalName} />
        <InfoRow icon="location-outline" label="District" value={r.district} />
        {r.wardUnit ? <InfoRow icon="bed-outline" label="Ward / unit" value={r.wardUnit} /> : null}
        {r.requiredBy ? <InfoRow icon="time-outline" label="Needed by" value={formatDateTime(r.requiredBy)} /> : null}
        {r.relationship ? <InfoRow icon="people-outline" label="Request is for" value={r.relationship} /> : null}
        {r.notes ? <InfoRow icon="document-text-outline" label="Notes for donors" value={r.notes} /> : null}
      </DonorLinkCard>

      <DonorLinkBanner
        tone="info"
        title="What happens next"
        message="Your request is checked by the hospital or a DonorLink reviewer. Once verified, we notify compatible donors nearby and you can follow progress in real time."
      />
      <MedicalDisclaimer compact />
    </DonorLinkScreen>
  );
}
