import {
  AVAILABILITY_LABELS,
  DONATION_STATUS_LABELS,
  MATCH_QUALITY_LABELS,
  REQUEST_STATUS_LABELS,
  RESPONSE_STATUS_LABELS,
  STOCK_STATE_LABELS,
  URGENCY_LABELS,
  VERIFICATION_LABELS,
  type Availability,
  type DonationStatus,
  type MatchQuality,
  type RequestStatus,
  type ResponseStatus,
  type StockState,
  type Urgency,
  type VerificationStatus,
} from '@/domain';
import { DonorLinkBadge, type BadgeTone } from '@/components/ui/DonorLinkBadge';
import type { IconName } from '@/components/ui/DonorLinkIcon';

type Meta = { tone: BadgeTone; icon: IconName };

const URGENCY_META: Record<Urgency, Meta> = {
  critical: { tone: 'emergency', icon: 'alert-circle' },
  urgent: { tone: 'warning', icon: 'time' },
  standard: { tone: 'neutral', icon: 'calendar-outline' },
};

const VERIFICATION_META: Record<VerificationStatus, Meta> = {
  not_submitted: { tone: 'neutral', icon: 'shield-outline' },
  pending: { tone: 'warning', icon: 'hourglass-outline' },
  verified: { tone: 'success', icon: 'shield-checkmark' },
  needs_attention: { tone: 'warning', icon: 'alert-circle' },
  rejected: { tone: 'error', icon: 'close-circle' },
};

const AVAILABILITY_META: Record<Availability, Meta> = {
  available: { tone: 'success', icon: 'checkmark-circle' },
  unavailable: { tone: 'neutral', icon: 'remove-circle-outline' },
  temporarily_unavailable: { tone: 'warning', icon: 'pause-circle-outline' },
  unknown: { tone: 'neutral', icon: 'help-circle-outline' },
};

const REQUEST_META: Record<RequestStatus, Meta> = {
  draft: { tone: 'neutral', icon: 'create-outline' },
  submitted: { tone: 'info', icon: 'paper-plane' },
  pending_verification: { tone: 'warning', icon: 'hourglass-outline' },
  verified: { tone: 'success', icon: 'shield-checkmark' },
  matching: { tone: 'primary', icon: 'search' },
  donors_contacted: { tone: 'primary', icon: 'people' },
  partially_fulfilled: { tone: 'info', icon: 'water' },
  fulfilled: { tone: 'success', icon: 'checkmark-circle' },
  completed: { tone: 'success', icon: 'checkmark-done' },
  cancelled: { tone: 'neutral', icon: 'close-circle-outline' },
  expired: { tone: 'neutral', icon: 'time-outline' },
  rejected: { tone: 'error', icon: 'close-circle' },
};

const DONATION_META: Record<DonationStatus, Meta> = {
  scheduled: { tone: 'primary', icon: 'calendar' },
  completed: { tone: 'success', icon: 'checkmark-done' },
  cancelled: { tone: 'neutral', icon: 'close-circle-outline' },
  no_show: { tone: 'warning', icon: 'alert-circle-outline' },
};

const RESPONSE_META: Record<ResponseStatus, Meta> = {
  pending: { tone: 'warning', icon: 'hourglass-outline' },
  accepted: { tone: 'success', icon: 'checkmark-circle' },
  declined: { tone: 'neutral', icon: 'close-circle-outline' },
  withdrawn: { tone: 'neutral', icon: 'return-up-back' },
  completed: { tone: 'success', icon: 'checkmark-done' },
  expired: { tone: 'neutral', icon: 'time-outline' },
};

const STOCK_META: Record<StockState, Meta> = {
  out: { tone: 'emergency', icon: 'close-circle' },
  critical: { tone: 'emergency', icon: 'alert-circle' },
  low: { tone: 'warning', icon: 'trending-down' },
  ok: { tone: 'success', icon: 'checkmark-circle' },
};

const QUALITY_META: Record<MatchQuality, Meta> = {
  excellent: { tone: 'success', icon: 'star' },
  good: { tone: 'primary', icon: 'thumbs-up' },
  fair: { tone: 'neutral', icon: 'ellipse-outline' },
};

type Common = { size?: 'sm' | 'md'; className?: string };

export const UrgencyBadge = ({ urgency, ...rest }: { urgency: Urgency } & Common) => (
  <DonorLinkBadge label={URGENCY_LABELS[urgency]} {...URGENCY_META[urgency]} {...rest} />
);

export const VerificationBadge = ({ status, label, ...rest }: { status: VerificationStatus; label?: string } & Common) => (
  <DonorLinkBadge label={label ?? VERIFICATION_LABELS[status]} {...VERIFICATION_META[status]} {...rest} />
);

export const AvailabilityBadge = ({ availability, ...rest }: { availability: Availability } & Common) => (
  <DonorLinkBadge label={AVAILABILITY_LABELS[availability]} {...AVAILABILITY_META[availability]} {...rest} />
);

export const RequestStatusBadge = ({ status, ...rest }: { status: RequestStatus } & Common) => (
  <DonorLinkBadge label={REQUEST_STATUS_LABELS[status]} {...REQUEST_META[status]} {...rest} />
);

export const DonationStatusBadge = ({ status, ...rest }: { status: DonationStatus } & Common) => (
  <DonorLinkBadge label={DONATION_STATUS_LABELS[status]} {...DONATION_META[status]} {...rest} />
);

export const ResponseStatusBadge = ({ status, ...rest }: { status: ResponseStatus } & Common) => (
  <DonorLinkBadge label={RESPONSE_STATUS_LABELS[status]} {...RESPONSE_META[status]} {...rest} />
);

export const StockBadge = ({ state, ...rest }: { state: StockState } & Common) => (
  <DonorLinkBadge label={STOCK_STATE_LABELS[state]} {...STOCK_META[state]} {...rest} />
);

export const MatchQualityBadge = ({ quality, ...rest }: { quality: MatchQuality } & Common) => (
  <DonorLinkBadge label={MATCH_QUALITY_LABELS[quality]} {...QUALITY_META[quality]} {...rest} />
);
