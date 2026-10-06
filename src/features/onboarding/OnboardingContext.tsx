import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { BloodGroup } from '@/domain';
import { DEFAULT_NOTIFICATION_PREFS, DEFAULT_PRIVACY_PREFS } from '@/services/profileService';
import type { NotificationPrefs, PrivacyPrefs } from '@/types/entities';
import { useAuth } from '@/providers/AuthProvider';

export interface OnboardingDraft {
  displayName: string;
  phone: string;
  bloodGroup: BloodGroup | null;
  district: string;
  city: string;
  location: { lat: number; lng: number } | null;
  locationConsent: boolean;
  isDonor: boolean;
  radiusKm: number;
  notificationPrefs: NotificationPrefs;
  privacyPrefs: PrivacyPrefs;
}

interface OnboardingContextValue {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export const ONBOARDING_STEPS = ['personal-info', 'blood-info', 'location', 'donation-preferences', 'notification-preferences', 'permissions', 'complete'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Draft lives in memory across the steps and is saved once, on the last screen. */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [draft, setDraft] = useState<OnboardingDraft>(() => ({
    displayName: profile?.displayName ?? user?.name ?? '',
    phone: profile?.phone ?? '',
    bloodGroup: profile?.bloodGroup ?? null,
    district: profile?.district ?? '',
    city: profile?.city ?? '',
    location: null,
    locationConsent: false,
    isDonor: true,
    radiusKm: 15,
    notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
    privacyPrefs: DEFAULT_PRIVACY_PREFS,
  }));

  const value = useMemo<OnboardingContextValue>(
    () => ({ draft, update: (patch) => setDraft((prev) => ({ ...prev, ...patch })) }),
    [draft],
  );
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used inside the onboarding layout.');
  return ctx;
}
