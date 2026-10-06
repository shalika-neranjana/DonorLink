import { View } from 'react-native';

import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkIcon, type IconName } from '@/components/ui/DonorLinkIcon';
import { DonorLinkSwitchRow } from '@/components/ui/DonorLinkSwitch';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { OnboardingStepScreen } from '@/features/onboarding/OnboardingStepScreen';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';

const PRINCIPLES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'location', title: 'Approximate location only', body: 'Rounded to about 1 km. Used for "2.4 km away", never for your address.' },
  { icon: 'eye-off', title: 'First name and initial', body: 'Requesters and donors see names like "Kasun P." Contact details stay private.' },
  { icon: 'document-lock', title: 'Documents stay private', body: 'Verification files are visible only to you and DonorLink reviewers.' },
];

export default function PermissionsStep() {
  const { draft, update } = useOnboarding();
  return (
    <OnboardingStepScreen
      step="permissions"
      title="Your privacy"
      why="Here is exactly what DonorLink uses and shares. You can change these choices any time in Settings > Privacy."
    >
      <View className="gap-3">
        {PRINCIPLES.map((p) => (
          <View key={p.title} className="flex-row items-start gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-md bg-success-soft">
              <DonorLinkIcon name={p.icon} size={20} color="success" />
            </View>
            <View className="flex-1">
              <DonorLinkText variant="bodyStrong">{p.title}</DonorLinkText>
              <DonorLinkText variant="bodySmall" tone="secondary">
                {p.body}
              </DonorLinkText>
            </View>
          </View>
        ))}
      </View>

      <DonorLinkCard>
        <DonorLinkSwitchRow
          title="Share my approximate distance"
          description="Lets requesters see how far away you are. If off, you can still be matched but distance is unknown."
          value={draft.privacyPrefs.shareApproxLocation}
          onValueChange={(value) => update({ privacyPrefs: { ...draft.privacyPrefs, shareApproxLocation: value } })}
          accessibilityLabel="Share approximate distance"
        />
        <DonorLinkSwitchRow
          title="Donate anonymously"
          description='Show me as "Anonymous donor" instead of my name.'
          value={draft.privacyPrefs.anonymousDonor}
          onValueChange={(value) => update({ privacyPrefs: { ...draft.privacyPrefs, anonymousDonor: value } })}
          accessibilityLabel="Donate anonymously"
        />
      </DonorLinkCard>
    </OnboardingStepScreen>
  );
}
