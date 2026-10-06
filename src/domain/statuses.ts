/**
 * Finite vocabularies used across the app, the Appwrite schema and the
 * server-side Function. Labels live here so terminology stays consistent
 * everywhere (Milestone 02 lesson: consistent status wording).
 */

// --- Requests -------------------------------------------------------------

export const REQUEST_STATUSES = [
  'draft',
  'submitted',
  'pending_verification',
  'verified',
  'matching',
  'donors_contacted',
  'partially_fulfilled',
  'fulfilled',
  'completed',
  'cancelled',
  'expired',
  'rejected',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  pending_verification: 'Awaiting verification',
  verified: 'Verified',
  matching: 'Finding donors',
  donors_contacted: 'Donors contacted',
  partially_fulfilled: 'Partly fulfilled',
  fulfilled: 'Blood secured',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
  rejected: 'Not verified',
};

/** Statuses in which a request is still being worked on. */
export const ACTIVE_REQUEST_STATUSES: readonly RequestStatus[] = [
  'submitted',
  'pending_verification',
  'verified',
  'matching',
  'donors_contacted',
  'partially_fulfilled',
  'fulfilled',
];

export const TERMINAL_REQUEST_STATUSES: readonly RequestStatus[] = [
  'completed',
  'cancelled',
  'expired',
  'rejected',
];

export function isActiveRequestStatus(status: RequestStatus): boolean {
  return ACTIVE_REQUEST_STATUSES.includes(status);
}

export const URGENCY_LEVELS = ['critical', 'urgent', 'standard'] as const;
export type Urgency = (typeof URGENCY_LEVELS)[number];

export const URGENCY_LABELS: Record<Urgency, string> = {
  critical: 'Critical',
  urgent: 'Urgent',
  standard: 'Standard',
};

export const URGENCY_DESCRIPTIONS: Record<Urgency, string> = {
  critical: 'Life-threatening. Blood needed within hours.',
  urgent: 'Needed within about 24 hours.',
  standard: 'Planned need. Within a few days.',
};

/** Higher = more urgent. Used for sorting and scoring. */
export const URGENCY_RANK: Record<Urgency, number> = { critical: 3, urgent: 2, standard: 1 };

// --- Verification ----------------------------------------------------------

export const VERIFICATION_STATUSES = [
  'not_submitted',
  'pending',
  'verified',
  'needs_attention',
  'rejected',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  not_submitted: 'Not submitted',
  pending: 'Pending review',
  verified: 'Verified',
  needs_attention: 'Needs attention',
  rejected: 'Rejected',
};

export const VERIFICATION_SUBJECTS = ['user', 'donor', 'organization'] as const;
export type VerificationSubject = (typeof VERIFICATION_SUBJECTS)[number];

export const VERIFICATION_DOCUMENT_TYPES = [
  'national_id',
  'passport',
  'driving_licence',
  'donor_card',
  'organization_registration',
  'other',
] as const;
export type VerificationDocumentType = (typeof VERIFICATION_DOCUMENT_TYPES)[number];

export const VERIFICATION_DOCUMENT_LABELS: Record<VerificationDocumentType, string> = {
  national_id: 'National ID',
  passport: 'Passport',
  driving_licence: 'Driving licence',
  donor_card: 'Blood donor card',
  organization_registration: 'Organization registration',
  other: 'Other document',
};

// --- Donors ----------------------------------------------------------------

export const AVAILABILITY_STATES = [
  'available',
  'unavailable',
  'temporarily_unavailable',
  'unknown',
] as const;
export type Availability = (typeof AVAILABILITY_STATES)[number];

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  available: 'Available',
  unavailable: 'Unavailable',
  temporarily_unavailable: 'Temporarily unavailable',
  unknown: 'Not set',
};

/** After this long without an update we stop presenting availability as current. */
export const AVAILABILITY_STALE_HOURS = 72;

export const RESPONSE_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'withdrawn',
  'completed',
  'expired',
] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

export const RESPONSE_STATUS_LABELS: Record<ResponseStatus, string> = {
  pending: 'Awaiting response',
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  completed: 'Donated',
  expired: 'Expired',
};

export const DECLINE_REASONS = [
  'Not available right now',
  'Too far away',
  'Not eligible to donate',
  'Prefer not to say',
] as const;

export const DONATION_STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show'] as const;
export type DonationStatus = (typeof DONATION_STATUSES)[number];

export const DONATION_STATUS_LABELS: Record<DonationStatus, string> = {
  scheduled: 'Coordinating',
  completed: 'Donated',
  cancelled: 'Cancelled',
  no_show: 'Did not attend',
};

export const MATCH_QUALITIES = ['excellent', 'good', 'fair'] as const;
export type MatchQuality = (typeof MATCH_QUALITIES)[number];

export const MATCH_QUALITY_LABELS: Record<MatchQuality, string> = {
  excellent: 'Excellent match',
  good: 'Good match',
  fair: 'Possible match',
};

// --- Organizations & inventory --------------------------------------------

export const ORGANIZATION_TYPES = ['hospital', 'blood_bank', 'donation_center'] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const ORGANIZATION_TYPE_LABELS: Record<OrganizationType, string> = {
  hospital: 'Hospital',
  blood_bank: 'Blood bank',
  donation_center: 'Donation centre',
};

export const ORGANIZATION_MEMBER_ROLES = ['admin', 'coordinator', 'staff'] as const;
export type OrganizationMemberRole = (typeof ORGANIZATION_MEMBER_ROLES)[number];

export const BLOOD_COMPONENTS = ['whole_blood', 'red_cells', 'platelets', 'plasma'] as const;
export type BloodComponent = (typeof BLOOD_COMPONENTS)[number];

export const BLOOD_COMPONENT_LABELS: Record<BloodComponent, string> = {
  whole_blood: 'Whole blood',
  red_cells: 'Red cells',
  platelets: 'Platelets',
  plasma: 'Plasma',
};

export const STOCK_STATES = ['out', 'critical', 'low', 'ok'] as const;
export type StockState = (typeof STOCK_STATES)[number];

export const STOCK_STATE_LABELS: Record<StockState, string> = {
  out: 'Out of stock',
  critical: 'Critically low',
  low: 'Low stock',
  ok: 'In stock',
};

// --- Notifications ---------------------------------------------------------

export const NOTIFICATION_CATEGORIES = ['emergency', 'requests', 'donations', 'account'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  emergency: 'Emergency',
  requests: 'Requests',
  donations: 'Donations',
  account: 'Account',
};

export const NOTIFICATION_TYPES = [
  'emergency_request',
  'request_submitted',
  'request_verified',
  'request_rejected',
  'request_status_changed',
  'request_expired',
  'donor_accepted',
  'donor_declined',
  'donation_scheduled',
  'donation_completed',
  'donation_cancelled',
  'verification_update',
  'organization_update',
  'support_reply',
  'reminder',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_CATEGORY: Record<NotificationType, NotificationCategory> = {
  emergency_request: 'emergency',
  request_submitted: 'requests',
  request_verified: 'requests',
  request_rejected: 'requests',
  request_status_changed: 'requests',
  request_expired: 'requests',
  donor_accepted: 'requests',
  donor_declined: 'requests',
  donation_scheduled: 'donations',
  donation_completed: 'donations',
  donation_cancelled: 'donations',
  verification_update: 'account',
  organization_update: 'account',
  support_reply: 'account',
  reminder: 'donations',
};

// --- Roles -----------------------------------------------------------------

export const APP_ROLES = ['user', 'organization', 'admin'] as const;
export type AppRole = (typeof APP_ROLES)[number];

// --- Support ---------------------------------------------------------------

export const SUPPORT_CATEGORIES = ['account', 'request', 'donation', 'verification', 'other'] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
export const SUPPORT_STATUSES = ['open', 'in_progress', 'resolved'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];
