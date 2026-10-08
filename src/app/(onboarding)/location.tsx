import { useState } from 'react';

import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { DonorLinkSelect } from '@/components/ui/DonorLinkPickers';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { districtCentre, DISTRICT_NAMES, LIMITS } from '@/domain';
import { OnboardingStepScreen } from '@/features/onboarding/OnboardingStepScreen';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { useApproximateLocation } from '@/hooks/useApproximateLocation';

const DISTRICT_OPTIONS = DISTRICT_NAMES.map((name) => ({ value: name, label: name }));

export default function LocationStep() {
  const { draft, update } = useOnboarding();
  const { request, loading, lastOutcome, openSettings } = useApproximateLocation();
  const [error, setError] = useState<string | undefined>();

  async function fetchMyLocation() {
    const outcome = await request();
    if (outcome.ok) {
      update({ district: outcome.district, location: outcome.coordinates, locationConsent: true });
      setError(undefined);
    }
  }

  return (
    <OnboardingStepScreen
      step="location"
      title="Where are you?"
      why="We use your district to show nearby requests and donors. Only an approximate position (about 1 km) is stored. Other people see a rounded distance, never your address."
      onNext={() => {
        if (!draft.district) {
          setError('Choose your district to continue.');
          return false;
        }
        update({ location: draft.location ?? districtCentre(draft.district) ?? null });
      }}
    >
      <DonorLinkButton
        title="Use my approximate location"
        variant="outline"
        leftIcon="locate"
        loading={loading}
        fullWidth
        onPress={() => void fetchMyLocation()}
      />
      {lastOutcome && !lastOutcome.ok ? (
        <DonorLinkBanner
          tone="info"
          message={lastOutcome.message}
          actionLabel={lastOutcome.reason === 'blocked' ? 'Open settings' : undefined}
          onAction={lastOutcome.reason === 'blocked' ? openSettings : undefined}
        />
      ) : null}
      <DonorLinkSelect
        label="District"
        required
        value={draft.district}
        options={DISTRICT_OPTIONS}
        onChange={(district) => {
          update({ district, location: null });
          setError(undefined);
        }}
        searchable
        placeholder="Choose your district"
        error={error}
        helperText="You can always change this later in Settings."
      />
      <DonorLinkInput label="Town or area" value={draft.city} onChangeText={(city) => update({ city })} maxLength={LIMITS.maxCity} leftIcon="location-outline" placeholder="Optional" autoCapitalize="words" />
    </OnboardingStepScreen>
  );
}
