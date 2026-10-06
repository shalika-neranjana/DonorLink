import { View } from 'react-native';

import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkChip } from '@/components/ui/DonorLinkPickers';
import { DonorLinkSwitchRow } from '@/components/ui/DonorLinkSwitch';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { MEDICAL_DISCLAIMER } from '@/domain';
import { OnboardingStepScreen } from '@/features/onboarding/OnboardingStepScreen';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';

const RADII = [5, 10, 15, 25, 50];

export default function DonationPreferencesStep() {
  const { draft, update } = useOnboarding();
  const canDonate = draft.bloodGroup !== null;
  return (
    <OnboardingStepScreen
      step="donation-preferences"
      title="Donating blood"
      why="Many requests are urgent. If you're willing to help, we can notify you when a compatible request is verified near you. You stay in control and can switch availability off at any time."
    >
      {!canDonate ? (
        <DonorLinkBanner tone="info" message="Add your blood group first (previous step) to be notified about requests." />
      ) : null}
      <DonorLinkCard>
        <DonorLinkSwitchRow
          title="I'm willing to donate"
          description="You choose when you're available. Nothing happens until you say so."
          value={draft.isDonor && canDonate}
          disabled={!canDonate}
          onValueChange={(isDonor) => update({ isDonor })}
          accessibilityLabel="Willing to donate"
        />
      </DonorLinkCard>

      {draft.isDonor && canDonate ? (
        <View className="gap-2">
          <DonorLinkText variant="label" tone="secondary">
            How far are you willing to travel?
          </DonorLinkText>
          <View className="flex-row flex-wrap gap-2">
            {RADII.map((km) => (
              <DonorLinkChip key={km} label={`${km} km`} selected={draft.radiusKm === km} onPress={() => update({ radiusKm: km })} />
            ))}
          </View>
        </View>
      ) : null}
      <DonorLinkText variant="caption" tone="muted">
        {MEDICAL_DISCLAIMER}
      </DonorLinkText>
    </OnboardingStepScreen>
  );
}
