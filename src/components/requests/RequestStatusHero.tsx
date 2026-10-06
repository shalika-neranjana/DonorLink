import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { cn } from '@gluestack-ui/utils/nativewind-utils';

import { DonorLinkIcon, type IconName } from '@/components/ui/DonorLinkIcon';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { REQUEST_STATUS_LABELS, type RequestStatus } from '@/domain';
import type { ColorToken } from '@/theme/tokens';
import { formatRelativeTime } from '@/lib/format';
import type { BloodRequest } from '@/types/entities';

const STYLE: Record<RequestStatus, { icon: IconName; color: ColorToken; box: string }> = {
  draft: { icon: 'create-outline', color: 'fgSecondary', box: 'border-border bg-surface' },
  submitted: { icon: 'paper-plane', color: 'info', box: 'border-transparent bg-info-soft' },
  pending_verification: { icon: 'hourglass-outline', color: 'warning', box: 'border-transparent bg-warning-soft' },
  verified: { icon: 'shield-checkmark', color: 'success', box: 'border-transparent bg-success-soft' },
  matching: { icon: 'search', color: 'primary', box: 'border-transparent bg-primary-soft' },
  donors_contacted: { icon: 'people', color: 'primary', box: 'border-transparent bg-primary-soft' },
  partially_fulfilled: { icon: 'water', color: 'info', box: 'border-transparent bg-info-soft' },
  fulfilled: { icon: 'checkmark-circle', color: 'success', box: 'border-transparent bg-success-soft' },
  completed: { icon: 'checkmark-done', color: 'success', box: 'border-transparent bg-success-soft' },
  cancelled: { icon: 'close-circle-outline', color: 'fgSecondary', box: 'border-border bg-subtle' },
  expired: { icon: 'time-outline', color: 'fgSecondary', box: 'border-border bg-subtle' },
  rejected: { icon: 'close-circle', color: 'error', box: 'border-transparent bg-error-soft' },
};

export function describeStatus(request: Pick<BloodRequest, 'status' | 'units' | 'unitsAccepted' | 'cancelledReason'>): string {
  const accepted = request.unitsAccepted ?? 0;
  switch (request.status) {
    case 'draft':
      return 'This request has not been sent yet.';
    case 'submitted':
      return 'We received your request.';
    case 'pending_verification':
      return 'A reviewer is checking your request. Donors are contacted as soon as it is verified.';
    case 'verified':
      return 'Verified. Starting donor matching.';
    case 'matching':
      return 'Looking for compatible, available donors nearby.';
    case 'donors_contacted':
      return 'Donors have been notified. Waiting for their responses.';
    case 'partially_fulfilled':
      return `${accepted} of ${request.units} donors have accepted. We are still looking for more.`;
    case 'fulfilled':
      return 'Enough donors have accepted. The hospital or you confirm each donation once it happens.';
    case 'completed':
      return 'All donations were confirmed. Thank you to everyone who helped.';
    case 'cancelled':
      return request.cancelledReason ? `Cancelled: ${request.cancelledReason}` : 'This request was cancelled.';
    case 'expired':
      return 'This request expired before it was fulfilled. You can submit a new one.';
    case 'rejected':
      return 'This request could not be verified. Check the notification for the reason.';
  }
}

/**
 * Current status, big and impossible to miss (Milestone 02, UI-03). Re-animates
 * when the status changes so updates are noticed.
 */
export function RequestStatusHero({ request }: { request: BloodRequest }) {
  const style = STYLE[request.status];
  return (
    <Animated.View
      key={request.status}
      entering={FadeIn.duration(260)}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Status: ${REQUEST_STATUS_LABELS[request.status]}. ${describeStatus(request)}`}
      className={cn('gap-2 rounded-lg border p-4', style.box)}
    >
      <View className="flex-row items-center gap-3">
        <DonorLinkIcon name={style.icon} size={30} color={style.color} />
        <View className="flex-1">
          <DonorLinkText variant="overline" tone="secondary">
            Current status
          </DonorLinkText>
          <DonorLinkText variant="heading">{REQUEST_STATUS_LABELS[request.status]}</DonorLinkText>
        </View>
      </View>
      <DonorLinkText variant="body" tone="secondary">
        {describeStatus(request)}
      </DonorLinkText>
      <DonorLinkText variant="caption" tone="muted">
        Updated {formatRelativeTime(request.$updatedAt)}
      </DonorLinkText>
    </Animated.View>
  );
}
