import type { NotificationPrefs } from '@/types/entities';

/** Copy for notification preference switches, shared by onboarding and Settings. */
export const NOTIFICATION_PREF_COPY: { key: keyof NotificationPrefs; title: string; description: string }[] = [
  { key: 'emergencyRequests', title: 'Emergency requests near me', description: 'Verified requests that match your blood group and distance.' },
  { key: 'requestUpdates', title: 'Updates on my requests', description: 'Verification, donor responses and status changes.' },
  { key: 'donationUpdates', title: 'Donation coordination', description: 'Scheduling, confirmations and changes to your donations.' },
  { key: 'accountAlerts', title: 'Account and verification', description: 'Verification decisions, support replies and security notices.' },
  { key: 'reminders', title: 'Reminders', description: 'Gentle nudges about upcoming donations.' },
];
