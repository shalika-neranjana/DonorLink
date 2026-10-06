import { NOTIFICATION_TYPE_CATEGORY, URGENCY_LABELS, type NotificationCategory, type NotificationType, type Urgency } from './statuses';
import { formatDistance } from './geo';

export interface NotificationDraft {
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  body: string;
  /** In-app route the notification deep-links to (Expo Router path). */
  route: string;
  /** Short label for the action the user can take, e.g. "Review request". */
  actionLabel: string;
}

export interface NotificationContext {
  requestId?: string;
  bloodGroup?: string;
  units?: number;
  urgency?: Urgency;
  hospitalName?: string;
  distanceKm?: number | null;
  donorName?: string;
  note?: string;
  status?: string;
  verificationSubject?: string;
  ticketId?: string;
}

function plural(n: number | undefined, word: string): string {
  const count = n ?? 1;
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

const trackingRoute = (id?: string) => (id ? `/requests/tracking?id=${id}` : '/requests');
const requestRoute = (id?: string) => (id ? `/requests/${id}` : '/requests');

/**
 * Single place that turns an event into a notification, so every notification
 * says what happened, when (via createdAt), and what the user can do next.
 */
export function buildNotification(type: NotificationType, ctx: NotificationContext = {}): NotificationDraft {
  const category = NOTIFICATION_TYPE_CATEGORY[type];
  const group = ctx.bloodGroup ?? 'blood';
  const base = { type, category };

  switch (type) {
    case 'emergency_request': {
      const urgency = ctx.urgency ? URGENCY_LABELS[ctx.urgency] : 'Urgent';
      const distance = ctx.distanceKm != null ? ` · ${formatDistance(ctx.distanceKm)} away` : '';
      return {
        ...base,
        title: `${urgency}: ${group} blood needed`,
        body: `${plural(ctx.units, 'unit')} at ${ctx.hospitalName ?? 'a nearby hospital'}${distance}.`,
        route: ctx.requestId ? `/donor/incoming/${ctx.requestId}` : '/',
        actionLabel: 'Review request',
      };
    }
    case 'request_submitted':
      return {
        ...base,
        title: 'Request submitted',
        body: `Your request for ${group} blood is being verified.`,
        route: trackingRoute(ctx.requestId),
        actionLabel: 'Track request',
      };
    case 'request_verified':
      return {
        ...base,
        title: 'Request verified',
        body: `Your ${group} request was verified and donor matching has started.`,
        route: trackingRoute(ctx.requestId),
        actionLabel: 'Track request',
      };
    case 'request_rejected':
      return {
        ...base,
        title: 'Request could not be verified',
        body: ctx.note ?? 'Check the details and submit a new request, or contact support.',
        route: requestRoute(ctx.requestId),
        actionLabel: 'View details',
      };
    case 'request_status_changed':
      return {
        ...base,
        title: 'Request status updated',
        body: ctx.status ? `Your ${group} request is now: ${ctx.status}.` : `Your ${group} request was updated.`,
        route: trackingRoute(ctx.requestId),
        actionLabel: 'Track request',
      };
    case 'request_expired':
      return {
        ...base,
        title: 'Request expired',
        body: `The ${group} request at ${ctx.hospitalName ?? 'the hospital'} has expired.`,
        route: requestRoute(ctx.requestId),
        actionLabel: 'View details',
      };
    case 'donor_accepted':
      return {
        ...base,
        title: `${ctx.donorName ?? 'A donor'} accepted`,
        body: `A donor accepted your ${group} request at ${ctx.hospitalName ?? 'the hospital'}.`,
        route: trackingRoute(ctx.requestId),
        actionLabel: 'Track request',
      };
    case 'donor_declined':
      return {
        ...base,
        title: 'A donor declined',
        body: `A donor can't help with your ${group} request. We'll keep looking.`,
        route: `/requests/matching?id=${ctx.requestId ?? ''}`,
        actionLabel: 'Find more donors',
      };
    case 'donation_scheduled':
      return {
        ...base,
        title: 'Donation coordination started',
        body: ctx.note
          ? `${ctx.hospitalName ?? 'The hospital'}: ${ctx.note}`
          : `Thank you. Head to ${ctx.hospitalName ?? 'the hospital'} when you're ready; staff will confirm your donation.`,
        route: ctx.requestId ? `/donor/donation/${ctx.requestId}` : '/',
        actionLabel: 'View details',
      };
    case 'donation_completed':
      return {
        ...base,
        title: 'Donation confirmed',
        body: `Your donation for the ${group} request was confirmed. Thank you for helping.`,
        route: '/history/donations',
        actionLabel: 'View history',
      };
    case 'donation_cancelled':
      return {
        ...base,
        title: 'Donation cancelled',
        body: `A donation for the ${group} request at ${ctx.hospitalName ?? 'the hospital'} was cancelled.`,
        route: '/history/donations',
        actionLabel: 'View history',
      };
    case 'verification_update':
      return {
        ...base,
        title: 'Verification update',
        body: ctx.status ? `Your ${ctx.verificationSubject ?? 'account'} verification is now: ${ctx.status}.` : 'Your verification status changed.',
        route: '/verification',
        actionLabel: 'View status',
      };
    case 'organization_update':
      return {
        ...base,
        title: 'Organization update',
        body: ctx.note ?? 'There is an update for your organization.',
        route: '/profile',
        actionLabel: 'Open',
      };
    case 'support_reply':
      return {
        ...base,
        title: 'Support replied',
        body: 'Our team replied to your support request.',
        route: '/support',
        actionLabel: 'Read reply',
      };
    case 'reminder':
      return {
        ...base,
        title: 'Reminder',
        body: ctx.note ?? 'You have an upcoming donation to coordinate.',
        route: '/',
        actionLabel: 'Open',
      };
  }
}
