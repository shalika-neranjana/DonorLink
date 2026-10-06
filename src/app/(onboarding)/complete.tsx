import { useState } from 'react';
import { View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { BloodGroupBadge } from '@/components/blood/BloodGroupBadge';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkIcon } from '@/components/ui/DonorLinkIcon';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { useAuth } from '@/providers/AuthProvider';
import { profileService } from '@/services/profileService';

export default function CompleteStep() {
  const { draft } = useOnboarding();
  const { setProfile, refreshDonorProfile, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const { profile } = await profileService.saveProfile(
        {
          displayName: draft.displayName,
          phone: draft.phone || undefined,
          bloodGroup: draft.bloodGroup,
          district: draft.district,
          city: draft.city || undefined,
          location: draft.location,
          isDonor: draft.isDonor && draft.bloodGroup !== null,
          locationConsent: draft.locationConsent,
        },
        { notificationPrefs: draft.notificationPrefs, privacyPrefs: draft.privacyPrefs },
      );
      if (profile.isDonor && profile.bloodGroup) {
        await profileService.updateAvailability({
          availability: 'unknown',
          radiusKm: draft.radiusKm,
          emergencyAlerts: draft.notificationPrefs.emergencyRequests,
        });
      }
      // Mark onboarding complete last, so a failure above never leaves a half-set-up account.
      const done = await profileService.saveProfile({ displayName: draft.displayName }, { onboardingComplete: true });
      await refreshUser();
      await refreshDonorProfile();
      setProfile(done.profile);
    } catch (e) {
      setError(getErrorMessage(e, "We couldn't save your profile. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DonorLinkScreen
      header={{ title: "You're all set", onBack: 'auto' }}
      footer={<DonorLinkButton title="Start using DonorLink" size="lg" fullWidth loading={saving} onPress={() => void finish()} />}
    >
      <View className="items-center gap-3 py-4">
        <Animated.View entering={ZoomIn.duration(300)} className="h-20 w-20 items-center justify-center rounded-full bg-success-soft">
          <DonorLinkIcon name="checkmark-circle" size={48} color="success" />
        </Animated.View>
        <DonorLinkText variant="heading" align="center">
          Welcome, {draft.displayName.split(' ')[0] || 'friend'}
        </DonorLinkText>
        <DonorLinkText variant="body" tone="secondary" align="center">
          Here&apos;s what we&apos;ll save. You can change any of it later.
        </DonorLinkText>
      </View>

      {error ? <DonorLinkBanner tone="error" title="Not saved yet" message={error} /> : null}

      <DonorLinkCard className="gap-3">
        <SummaryRow label="Name" value={draft.displayName} />
        <SummaryRow label="Area" value={[draft.city, draft.district].filter(Boolean).join(', ') || 'Not set'} />
        <View className="flex-row items-center justify-between">
          <DonorLinkText variant="bodySmall" tone="secondary">
            Blood group (self-reported)
          </DonorLinkText>
          {draft.bloodGroup ? <BloodGroupBadge group={draft.bloodGroup} size="sm" /> : <DonorLinkText variant="bodyStrong">Not set</DonorLinkText>}
        </View>
        <SummaryRow label="Donor" value={draft.isDonor && draft.bloodGroup ? `Willing to donate within ${draft.radiusKm} km` : 'Not donating for now'} />
        <SummaryRow label="Emergency alerts" value={draft.notificationPrefs.emergencyRequests ? 'On' : 'Off'} />
      </DonorLinkCard>
    </DonorLinkScreen>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <DonorLinkText variant="bodySmall" tone="secondary">
        {label}
      </DonorLinkText>
      <DonorLinkText variant="bodyStrong" align="right" className="flex-1">
        {value}
      </DonorLinkText>
    </View>
  );
}
