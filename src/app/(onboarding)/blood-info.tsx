import { View } from 'react-native';

import { MedicalDisclaimer } from '@/components/common/InfoRow';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { BloodGroupPicker } from '@/components/ui/DonorLinkPickers';
import { OnboardingStepScreen } from '@/features/onboarding/OnboardingStepScreen';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';

export default function BloodInfoStep() {
  const { draft, update } = useOnboarding();
  return (
    <OnboardingStepScreen
      step="blood-info"
      title="Blood group"
      why="Your blood group is used to suggest compatible matches. This is what you tell us. It is shown as self-reported until a verified record exists."
    >
      <BloodGroupPicker value={draft.bloodGroup} onChange={(bloodGroup) => update({ bloodGroup })} helperText="Check your donor card or a lab report if you are unsure." />
      <View className="items-start">
        <DonorLinkButton
          title="I don't know my blood group"
          variant="ghost"
          size="sm"
          onPress={() => update({ bloodGroup: null, isDonor: false })}
        />
      </View>
      <MedicalDisclaimer />
    </OnboardingStepScreen>
  );
}
