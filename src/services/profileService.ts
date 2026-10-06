import type { Availability, BloodGroup } from '@/domain';
import { callApi } from '@/lib/appwrite/api';
import { TABLES } from '@/lib/appwrite/config';
import { findRow } from '@/lib/appwrite/database';
import type { DonorProfile, NotificationPrefs, PrivacyPrefs, Profile } from '@/types/entities';

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  emergencyRequests: true,
  requestUpdates: true,
  donationUpdates: true,
  accountAlerts: true,
  reminders: true,
};

export const DEFAULT_PRIVACY_PREFS: PrivacyPrefs = {
  anonymousDonor: false,
  shareApproxLocation: true,
};

function parseJson<T extends object>(raw: string | null | undefined, defaults: T): T {
  if (!raw) return defaults;
  try {
    return { ...defaults, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return defaults;
  }
}

export const parseNotificationPrefs = (profile: Profile | null | undefined): NotificationPrefs =>
  parseJson(profile?.notificationPrefs, DEFAULT_NOTIFICATION_PREFS);

export const parsePrivacyPrefs = (profile: Profile | null | undefined): PrivacyPrefs =>
  parseJson(profile?.privacyPrefs, DEFAULT_PRIVACY_PREFS);

export interface SaveProfileInput {
  displayName: string;
  phone?: string;
  bloodGroup?: BloodGroup | null;
  district?: string;
  city?: string;
  location?: { lat: number; lng: number } | null;
  isDonor?: boolean;
  locationConsent?: boolean;
}

export const profileService = {
  getProfile(userId: string): Promise<Profile | null> {
    return findRow<Profile>(TABLES.profiles, userId);
  },

  getDonorProfile(userId: string): Promise<DonorProfile | null> {
    return findRow<DonorProfile>(TABLES.donorProfiles, userId);
  },

  saveProfile(
    profile: SaveProfileInput,
    extras: {
      notificationPrefs?: Partial<NotificationPrefs>;
      privacyPrefs?: Partial<PrivacyPrefs>;
      onboardingComplete?: boolean;
      avatarFileId?: string;
    } = {},
  ) {
    return callApi<{ profile: Profile; donor: DonorProfile | null }>('profile.save', { profile, ...extras });
  },

  updateAvailability(input: {
    availability: Availability;
    availableUntil?: string | null;
    radiusKm: number;
    emergencyAlerts: boolean;
    lastDonationDate?: string | null;
  }) {
    return callApi<{ donor: DonorProfile; offeredRequests: number }>('donor.updateAvailability', input);
  },
};
