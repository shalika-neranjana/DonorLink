import { useState } from 'react';
import { View } from 'react-native';

import { InfoRow } from '@/components/common/InfoRow';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { DonorLinkSwitchRow } from '@/components/ui/DonorLinkSwitch';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { useApproximateLocation } from '@/hooks/useApproximateLocation';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { useAuth } from '@/providers/AuthProvider';
import { parsePrivacyPrefs, profileService } from '@/services/profileService';
import type { PrivacyPrefs } from '@/types/entities';

export default function PrivacySettingsScreen() {
  const toast = useToast();
  const { profile, setProfile, refreshDonorProfile } = useAuth();
  const [prefs, setPrefs] = useState<PrivacyPrefs>(parsePrivacyPrefs(profile));
  const [busy, setBusy] = useState(false);
  const location = useApproximateLocation();

  async function change(key: keyof PrivacyPrefs, value: boolean) {
    if (!profile || busy) return;
    const previous = prefs;
    setPrefs({ ...prefs, [key]: value });
    setBusy(true);
    try {
      const { profile: saved } = await profileService.saveProfile({ displayName: profile.displayName }, { privacyPrefs: { [key]: value } });
      setProfile(saved);
      await refreshDonorProfile();
    } catch (e) {
      setPrefs(previous);
      toast.error("We couldn't save that setting", getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function refreshLocation() {
    if (!profile) return;
    const outcome = await location.request();
    if (!outcome.ok) return;
    setBusy(true);
    try {
      const { profile: saved } = await profileService.saveProfile(
        { displayName: profile.displayName, district: outcome.district, location: outcome.coordinates, locationConsent: true },
      );
      setProfile(saved);
      await refreshDonorProfile();
      toast.success('Approximate location updated', `Area set to ${outcome.district}.`);
    } catch (e) {
      toast.error("We couldn't update your location", getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DonorLinkScreen header={{ title: 'Privacy', subtitle: 'You control what others can see' }}>
      <DonorLinkCard>
        <DonorLinkSwitchRow title="Share my approximate distance" description="Requesters see how far away you are. If off, you can still be matched but distance is unknown." value={prefs.shareApproxLocation} disabled={busy} onValueChange={(v) => void change('shareApproxLocation', v)} accessibilityLabel="Share approximate distance" />
        <DonorLinkSwitchRow title="Donate anonymously" description='Show me as "Anonymous donor" instead of my name.' value={prefs.anonymousDonor} disabled={busy} onValueChange={(v) => void change('anonymousDonor', v)} accessibilityLabel="Donate anonymously" />
      </DonorLinkCard>

      <View className="gap-2">
        <DonorLinkButton title="Update my approximate location" variant="outline" leftIcon="locate" loading={location.loading} onPress={() => void refreshLocation()} />
        {location.lastOutcome && !location.lastOutcome.ok ? (
          <DonorLinkBanner tone="info" message={location.lastOutcome.message} actionLabel={location.lastOutcome.reason === 'blocked' ? 'Open settings' : undefined} onAction={location.lastOutcome.reason === 'blocked' ? location.openSettings : undefined} />
        ) : null}
        <DonorLinkText variant="caption" tone="muted">
          Location is only requested when you tap this button. You can also change your district in Edit profile.
        </DonorLinkText>
      </View>

      <DonorLinkCard className="gap-1">
        <DonorLinkText variant="title">What DonorLink never shows</DonorLinkText>
        <InfoRow icon="home-outline" label="Your home address" value="Never collected" />
        <InfoRow icon="call-outline" label="Your phone number" value="Visible only to hospital staff you donate to" />
        <InfoRow icon="document-lock-outline" label="Verification documents" value="Visible only to you and reviewers" />
      </DonorLinkCard>
    </DonorLinkScreen>
  );
}
