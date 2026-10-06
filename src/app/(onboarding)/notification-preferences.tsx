import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkSwitchRow } from '@/components/ui/DonorLinkSwitch';
import { OnboardingStepScreen } from '@/features/onboarding/OnboardingStepScreen';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { NOTIFICATION_PREF_COPY } from '@/constants/notificationPrefs';

export default function NotificationPreferencesStep() {
  const { draft, update } = useOnboarding();
  return (
    <OnboardingStepScreen
      step="notification-preferences"
      title="Notifications"
      why="Choose what you want to hear about. Emergency alerts are only sent for verified requests that match you, and you can change these any time."
    >
      <DonorLinkCard>
        {NOTIFICATION_PREF_COPY.map((pref) => (
          <DonorLinkSwitchRow
            key={pref.key}
            title={pref.title}
            description={pref.description}
            value={draft.notificationPrefs[pref.key]}
            onValueChange={(value) => update({ notificationPrefs: { ...draft.notificationPrefs, [pref.key]: value } })}
            accessibilityLabel={pref.title}
          />
        ))}
      </DonorLinkCard>
    </OnboardingStepScreen>
  );
}
