import { useState } from 'react';

import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkSwitchRow } from '@/components/ui/DonorLinkSwitch';
import { useToast } from '@/components/ui/DonorLinkToast';
import { NOTIFICATION_PREF_COPY } from '@/constants/notificationPrefs';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { useAuth } from '@/providers/AuthProvider';
import { parseNotificationPrefs, profileService } from '@/services/profileService';
import type { NotificationPrefs } from '@/types/entities';

/** Each switch saves immediately and rolls back with a message if it fails. */
export default function NotificationSettingsScreen() {
  const toast = useToast();
  const { profile, setProfile, refreshDonorProfile } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(parseNotificationPrefs(profile));
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function change(key: keyof NotificationPrefs, value: boolean) {
    if (!profile || savingKey) return;
    const previous = prefs;
    setPrefs({ ...prefs, [key]: value });
    setSavingKey(key);
    try {
      const { profile: saved } = await profileService.saveProfile({ displayName: profile.displayName }, { notificationPrefs: { [key]: value } });
      setProfile(saved);
      if (key === 'emergencyRequests') await refreshDonorProfile();
    } catch (e) {
      setPrefs(previous);
      toast.error("We couldn't save that setting", getErrorMessage(e));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <DonorLinkScreen header={{ title: 'Notification settings', subtitle: 'Changes save automatically' }}>
      <DonorLinkCard>
        {NOTIFICATION_PREF_COPY.map((pref) => (
          <DonorLinkSwitchRow
            key={pref.key}
            title={pref.title}
            description={pref.description}
            value={prefs[pref.key]}
            disabled={savingKey !== null}
            onValueChange={(v) => void change(pref.key, v)}
            accessibilityLabel={pref.title}
          />
        ))}
      </DonorLinkCard>
    </DonorLinkScreen>
  );
}
