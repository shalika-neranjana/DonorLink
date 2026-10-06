import { View } from 'react-native';

import { BloodGroupBadge } from '@/components/blood/BloodGroupBadge';
import { DonationStatusBadge, ResponseStatusBadge } from '@/components/common/StatusBadges';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { formatDateTime } from '@/lib/format';
import { formatDistance } from '@/domain';
import type { Donation, RequestResponse } from '@/types/entities';


function Count({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1 items-center rounded-md bg-subtle py-2" accessible accessibilityLabel={`${label}: ${value}`}>
      <DonorLinkText variant="heading">{value}</DonorLinkText>
      <DonorLinkText variant="caption" tone="muted">
        {label}
      </DonorLinkText>
    </View>
  );
}

export interface ResponseSummaryProps {
  responses: RequestResponse[];
  donations: Donation[];
  /** Requester / hospital staff / admin: may confirm that a donation happened. */
  canManage?: boolean;
  confirmingId?: string | null;
  onConfirm?: (donation: Donation) => void;
  onFindMore?: () => void;
}

/** Donor response summary: counts first, then each donor with status and next step. */
export function ResponseSummary({ responses, donations, canManage, confirmingId, onConfirm, onFindMore }: ResponseSummaryProps) {
  const count = (status: RequestResponse['status']) => responses.filter((r) => r.status === status).length;
  const accepted = count('accepted') + count('completed');
  const donationByResponse = new Map(donations.map((d) => [d.responseId, d]));

  return (
    <View className="gap-3">
      <View className="flex-row gap-2">
        <Count label="Contacted" value={responses.length} />
        <Count label="Accepted" value={accepted} />
        <Count label="Waiting" value={count('pending')} />
        <Count label="Declined" value={count('declined')} />
      </View>

      {responses.length === 0 ? (
        <DonorLinkText variant="bodySmall" tone="secondary">
          No donors have been contacted yet.
        </DonorLinkText>
      ) : (
        <View className="gap-2">
          {responses.map((response) => {
            const donation = donationByResponse.get(response.$id);
            return (
              <DonorLinkCard key={response.$id} className="gap-2" accessibilityLabel={`${response.donorName}, ${response.status}`}>
                <View className="flex-row items-center gap-3">
                  <BloodGroupBadge group={response.donorBloodGroup} size="sm" />
                  <View className="flex-1">
                    <DonorLinkText variant="bodyStrong">{response.donorName}</DonorLinkText>
                    <DonorLinkText variant="caption" tone="muted">
                      {response.distanceKm != null ? `${formatDistance(response.distanceKm)} away` : 'Distance unknown'}
                      {response.respondedAt ? ` · replied ${formatDateTime(response.respondedAt)}` : ''}
                    </DonorLinkText>
                  </View>
                  <ResponseStatusBadge status={response.status} size="sm" />
                </View>
                {donation && response.status !== 'declined' ? (
                  <View className="gap-2 rounded-md bg-subtle p-2.5">
                    <View className="flex-row items-center justify-between">
                      <DonorLinkText variant="label" tone="secondary">
                        Donation
                      </DonorLinkText>
                      <DonationStatusBadge status={donation.status} size="sm" />
                    </View>
                    {donation.scheduledFor ? (
                      <DonorLinkText variant="bodySmall">Scheduled {formatDateTime(donation.scheduledFor)}</DonorLinkText>
                    ) : null}
                    {donation.coordinationNote ? (
                      <DonorLinkText variant="bodySmall" tone="secondary">
                        {donation.coordinationNote}
                      </DonorLinkText>
                    ) : null}
                    {canManage && donation.status === 'scheduled' && onConfirm ? (
                      <DonorLinkButton
                        title="Confirm donation received"
                        variant="success"
                        size="sm"
                        leftIcon="checkmark"
                        loading={confirmingId === donation.$id}
                        onPress={() => onConfirm(donation)}
                      />
                    ) : null}
                  </View>
                ) : null}
                {response.status === 'declined' && response.declineReason ? (
                  <DonorLinkText variant="caption" tone="muted">
                    Reason: {response.declineReason}
                  </DonorLinkText>
                ) : null}
              </DonorLinkCard>
            );
          })}
        </View>
      )}

      {onFindMore ? <DonorLinkButton title="Find more donors" variant="outline" leftIcon="search" onPress={onFindMore} /> : null}
    </View>
  );
}
