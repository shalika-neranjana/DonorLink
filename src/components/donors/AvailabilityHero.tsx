import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { cn } from '@gluestack-ui/utils/nativewind-utils';

import { DonorLinkIcon } from '@/components/ui/DonorLinkIcon';
import { DonorLinkSwitch } from '@/components/ui/DonorLinkSwitch';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { useToast } from '@/components/ui/DonorLinkToast';
import { effectiveAvailability } from '@/domain';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { formatTimeUntil } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { profileService } from '@/services/profileService';
import type { DonorProfile } from '@/types/entities';

export interface AvailabilityHeroProps {
  donor: DonorProfile | null;
  onOpenSettings: () => void;
}

/**
 * Donation availability, made unmissable (Milestone 02, UI-01): the state is a
 * large word, not just a colour, with a one-tap switch and a link to details.
 */
export function AvailabilityHero({ donor, onOpenSettings }: AvailabilityHeroProps) {
  const { setDonorProfile } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const state = donor ? effectiveAvailability(donor.availability, donor.availabilityUpdatedAt, donor.availableUntil) : 'unknown';
  const available = state === 'available';
  const stale = donor?.availability === 'available' && state === 'unknown';

  async function toggle(next: boolean) {
    if (saving || !donor) return;
    setSaving(true);
    const previous = donor;
    // Optimistic: safe because the server confirms and we roll back on failure.
    setDonorProfile({ ...donor, availability: next ? 'available' : 'unavailable', availabilityUpdatedAt: new Date().toISOString() });
    try {
      const { donor: saved } = await profileService.updateAvailability({
        availability: next ? 'available' : 'unavailable',
        availableUntil: null,
        radiusKm: donor.radiusKm,
        emergencyAlerts: donor.emergencyAlerts,
      });
      setDonorProfile(saved);
      toast.success(next ? "You're available" : 'You are now unavailable', next ? 'Nearby verified requests can reach you.' : "You won't receive new requests.");
    } catch (error) {
      setDonorProfile(previous);
      toast.error("We couldn't update your availability", getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const headline = available ? 'AVAILABLE' : stale ? 'CONFIRM AVAILABILITY' : 'CURRENTLY UNAVAILABLE';
  const detail = !donor
    ? 'Add your blood group to start receiving requests.'
    : available
      ? `${donor.availableUntil ? `Until ${formatTimeUntil(donor.availableUntil).replace('in ', 'in ')} · ` : ''}Within ${donor.radiusKm} km · Emergency alerts ${donor.emergencyAlerts ? 'on' : 'off'}`
      : stale
        ? 'Your last update was a while ago. Confirm to keep receiving requests.'
        : 'Switch on to be notified about compatible requests nearby.';

  return (
    <View
      className={cn(
        'gap-3 rounded-lg border p-4',
        available ? 'border-success bg-success-soft' : stale ? 'border-warning bg-warning-soft' : 'border-border bg-surface',
      )}
    >
      <View className="flex-row items-center gap-3">
        <View className={cn('h-11 w-11 items-center justify-center rounded-full', available ? 'bg-success' : 'bg-subtle')}>
          <DonorLinkIcon name={available ? 'heart' : 'heart-outline'} size={22} color={available ? 'primaryForeground' : 'fgMuted'} />
        </View>
        <View className="flex-1">
          <DonorLinkText variant="overline" tone="secondary">
            Donation availability
          </DonorLinkText>
          <DonorLinkText variant="heading" tone={available ? 'success' : stale ? 'warning' : 'default'} accessibilityRole="header">
            {headline}
          </DonorLinkText>
        </View>
        {donor ? (
          <DonorLinkSwitch
            value={available}
            disabled={saving}
            onValueChange={(next) => void toggle(next)}
            accessibilityLabel={available ? 'Available to donate. Turn off' : 'Unavailable. Turn on availability'}
          />
        ) : null}
      </View>
      <DonorLinkText variant="bodySmall" tone="secondary">
        {detail}
      </DonorLinkText>
      <Pressable
        onPress={onOpenSettings}
        accessibilityRole="button"
        accessibilityLabel="Open availability settings"
        className="min-h-[40px] flex-row items-center gap-1 self-start"
      >
        <DonorLinkText variant="label" tone="primary">
          {donor ? 'Availability settings' : 'Set up donor profile'}
        </DonorLinkText>
        <DonorLinkIcon name="chevron-forward" size={14} color="primary" />
      </Pressable>
    </View>
  );
}
