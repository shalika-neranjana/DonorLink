import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { MedicalDisclaimer } from '@/components/common/InfoRow';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkChip, DonorLinkDateTimeField } from '@/components/ui/DonorLinkPickers';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { DonorLinkSwitchRow } from '@/components/ui/DonorLinkSwitch';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { effectiveAvailability, validateAvailability } from '@/domain';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { daysSince } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { profileService } from '@/services/profileService';

const RADII = [5, 10, 15, 25, 50];
const LAST_DONATION = [
  { key: 'none', label: 'Not recently', days: null as number | null },
  { key: 'long', label: '2 to 6 months ago', days: 120 },
  { key: 'recent', label: 'Within 8 weeks', days: 28 },
];

function lastDonationKey(iso: string | null | undefined): string {
  const days = daysSince(iso);
  if (days === null) return 'none';
  if (days < 56) return 'recent';
  if (days < 200) return 'long';
  return 'none';
}

/** One screen for everything about availability (Milestone 02 decision). */
export default function DonorAvailabilityScreen() {
  const router = useRouter();
  const toast = useToast();
  const { profile, donorProfile, setDonorProfile, refreshUser } = useAuth();
  const initial = donorProfile ? effectiveAvailability(donorProfile.availability, donorProfile.availabilityUpdatedAt, donorProfile.availableUntil) : 'unavailable';

  const [available, setAvailable] = useState(initial === 'available');
  const [availableUntil, setAvailableUntil] = useState<string | null>(donorProfile?.availableUntil ?? null);
  const [radiusKm, setRadiusKm] = useState(donorProfile?.radiusKm ?? 15);
  const [emergencyAlerts, setEmergencyAlerts] = useState(donorProfile?.emergencyAlerts ?? true);
  const [lastDonation, setLastDonation] = useState(lastDonationKey(donorProfile?.lastDonationDate));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const noBloodGroup = !profile?.bloodGroup;

  async function save() {
    if (saving) return;
    setFormError(null);
    const availability = available ? 'available' : 'unavailable';
    const result = validateAvailability({ availability, availableUntil: available ? availableUntil : null, radiusKm, emergencyAlerts });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSaving(true);
    try {
      const donationOption = LAST_DONATION.find((o) => o.key === lastDonation);
      const lastDonationDate =
        lastDonation === lastDonationKey(donorProfile?.lastDonationDate)
          ? undefined
          : donationOption?.days
            ? new Date(Date.now() - donationOption.days * 864e5).toISOString()
            : null;
      const { donor, offeredRequests } = await profileService.updateAvailability({ ...result.value, ...(lastDonationDate !== undefined ? { lastDonationDate } : {}) });
      setDonorProfile(donor);
      void refreshUser();
      toast.success(
        'Availability saved',
        available ? (offeredRequests > 0 ? `${offeredRequests} open request${offeredRequests === 1 ? '' : 's'} nearby may need you.` : 'We will notify you about matching requests.') : 'You will not receive new requests.',
      );
      router.back();
    } catch (e) {
      setFormError(getErrorMessage(e, "We couldn't update your availability. Check your connection and try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DonorLinkScreen
      header={{ title: 'Donor availability' }}
      footer={<DonorLinkButton title="Save availability" size="lg" fullWidth loading={saving} disabled={noBloodGroup} onPress={() => void save()} />}
    >
      {noBloodGroup ? (
        <DonorLinkBanner tone="warning" title="Add your blood group first" message="We need your blood group to match you with requests." actionLabel="Edit profile" onAction={() => router.push('/settings/profile')} />
      ) : null}
      {formError ? <DonorLinkBanner tone="error" title="Not saved" message={formError} actionLabel="Try again" onAction={() => void save()} /> : null}

      <DonorLinkCard variant={available ? 'success' : 'default'}>
        <DonorLinkSwitchRow
          title={available ? 'Available to donate' : 'Currently unavailable'}
          description={available ? 'You can be contacted for matching requests.' : 'You will not be contacted.'}
          value={available}
          onValueChange={setAvailable}
          disabled={noBloodGroup}
          accessibilityLabel="Available to donate"
        />
      </DonorLinkCard>

      {available ? (
        <>
          <DonorLinkDateTimeField
            label="Available until (optional)"
            value={availableUntil}
            onChange={setAvailableUntil}
            error={errors.availableUntil}
            helperText="After this time you are shown as unavailable automatically."
            quickOptions={[
              { label: '2 hours', hoursFromNow: 2 },
              { label: '8 hours', hoursFromNow: 8 },
              { label: '24 hours', hoursFromNow: 24 },
              { label: '3 days', hoursFromNow: 72 },
            ]}
          />
          <View className="gap-2">
            <DonorLinkText variant="label" tone="secondary">
              How far will you travel?
            </DonorLinkText>
            <View className="flex-row flex-wrap gap-2">
              {RADII.map((km) => (
                <DonorLinkChip key={km} label={`${km} km`} selected={radiusKm === km} onPress={() => setRadiusKm(km)} />
              ))}
            </View>
            {errors.radiusKm ? (
              <DonorLinkText variant="bodySmall" tone="error">
                {errors.radiusKm}
              </DonorLinkText>
            ) : null}
          </View>
        </>
      ) : null}

      <DonorLinkCard>
        <DonorLinkSwitchRow
          title="Emergency request notifications"
          description="Be alerted when a verified request matches your blood group and distance."
          value={emergencyAlerts}
          onValueChange={setEmergencyAlerts}
          accessibilityLabel="Emergency request notifications"
        />
      </DonorLinkCard>

      <View className="gap-2">
        <DonorLinkText variant="label" tone="secondary">
          Last donation (self-reported)
        </DonorLinkText>
        <View className="flex-row flex-wrap gap-2">
          {LAST_DONATION.map((o) => (
            <DonorLinkChip key={o.key} label={o.label} selected={lastDonation === o.key} onPress={() => setLastDonation(o.key)} />
          ))}
        </View>
        <DonorLinkText variant="caption" tone="muted">
          Helps rank who to contact first. It is not a medical eligibility check.
        </DonorLinkText>
      </View>

      <MedicalDisclaimer compact />
    </DonorLinkScreen>
  );
}
