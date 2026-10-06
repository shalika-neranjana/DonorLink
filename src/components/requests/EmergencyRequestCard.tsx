import { View } from 'react-native';
import { cn } from '@gluestack-ui/utils/nativewind-utils';

import { BloodGroupBadge } from '@/components/blood/BloodGroupBadge';
import { RequestStatusBadge, UrgencyBadge, VerificationBadge } from '@/components/common/StatusBadges';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkIcon } from '@/components/ui/DonorLinkIcon';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { isActiveRequestStatus } from '@/domain';
import { formatRelativeTime, formatTimeUntil, pluralize } from '@/lib/format';
import type { BloodRequest } from '@/types/entities';

export interface EmergencyRequestCardProps {
  request: BloodRequest;
  onPress?: () => void;
  /** Show who asked (used for donors and organizations). */
  showRequester?: boolean;
  /** Extra line, e.g. distance for donors. */
  footnote?: string;
}

/**
 * The request summary used on Home, Requests, the donor dashboard and the
 * organization queue. Critical requests get a strong left accent so emergencies
 * stand out without turning the whole screen red.
 */
export function EmergencyRequestCard({ request, onPress, showRequester, footnote }: EmergencyRequestCardProps) {
  const active = isActiveRequestStatus(request.status);
  const critical = request.urgency === 'critical' && active;
  const progress = request.units > 0 ? Math.min(1, (request.unitsAccepted ?? 0) / request.units) : 0;

  return (
    <DonorLinkCard
      variant="elevated"
      className={cn('gap-3', critical && 'border-l-4 border-l-emergency')}
      onPress={onPress}
      accessibilityLabel={`${request.urgency} request for ${request.units} units of ${request.bloodGroup} at ${request.hospitalName}. Status: ${request.status.replace(/_/g, ' ')}`}
      accessibilityHint="Opens request details"
    >
      <View className="flex-row items-center gap-3">
        <BloodGroupBadge group={request.bloodGroup} size="lg" />
        <View className="flex-1 gap-1">
          <DonorLinkText variant="title" numberOfLines={1}>
            {pluralize(request.units, 'unit')} needed
          </DonorLinkText>
          <View className="flex-row items-center gap-1">
            <DonorLinkIcon name="business-outline" size={14} color="fgMuted" />
            <DonorLinkText variant="bodySmall" tone="secondary" numberOfLines={1} className="flex-1">
              {request.hospitalName}
            </DonorLinkText>
          </View>
          {showRequester ? (
            <DonorLinkText variant="caption" tone="muted" numberOfLines={1}>
              Requested by {request.requesterName}
            </DonorLinkText>
          ) : null}
        </View>
        <UrgencyBadge urgency={request.urgency} size="sm" />
      </View>

      <View className="flex-row flex-wrap items-center gap-2">
        <RequestStatusBadge status={request.status} size="sm" />
        {request.verificationStatus !== 'pending' || request.status === 'pending_verification' ? (
          <VerificationBadge status={request.verificationStatus} size="sm" label={request.verificationStatus === 'verified' ? 'Verified request' : undefined} />
        ) : null}
      </View>

      {active && request.status !== 'pending_verification' && request.status !== 'submitted' ? (
        <View className="gap-1" accessible accessibilityLabel={`${request.unitsAccepted ?? 0} of ${request.units} donors accepted`}>
          <View className="h-1.5 overflow-hidden rounded-full bg-subtle">
            <View className="h-full rounded-full bg-success" style={{ width: `${Math.round(progress * 100)}%` }} />
          </View>
          <DonorLinkText variant="caption" tone="muted">
            {request.unitsAccepted ?? 0} of {request.units} donors accepted
          </DonorLinkText>
        </View>
      ) : null}

      <View className="flex-row items-center justify-between">
        <DonorLinkText variant="caption" tone="muted">
          {request.requiredBy && active ? `Needed ${formatTimeUntil(request.requiredBy)}` : formatRelativeTime(request.$createdAt)}
        </DonorLinkText>
        {footnote ? (
          <DonorLinkText variant="caption" tone="secondary">
            {footnote}
          </DonorLinkText>
        ) : null}
      </View>
    </DonorLinkCard>
  );
}
