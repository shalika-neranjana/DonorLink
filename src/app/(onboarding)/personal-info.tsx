import { useState } from 'react';

import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { isValidPhone, LIMITS } from '@/domain';
import { OnboardingStepScreen } from '@/features/onboarding/OnboardingStepScreen';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';

export default function PersonalInfoStep() {
  const { draft, update } = useOnboarding();
  const [errors, setErrors] = useState<{ displayName?: string; phone?: string }>({});

  function validate(): boolean {
    const next: typeof errors = {};
    const name = draft.displayName.trim();
    if (!name) next.displayName = 'Full name is required.';
    else if (name.length > LIMITS.maxName) next.displayName = `Name must be ${LIMITS.maxName} characters or fewer.`;
    if (draft.phone.trim() && !isValidPhone(draft.phone)) next.phone = 'Enter a valid phone number, e.g. 0771234567.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  return (
    <OnboardingStepScreen
      step="personal-info"
      title="About you"
      why="Hospitals and donors need to know who is asking or giving. Other people only ever see your first name and last initial, never your phone number."
      onNext={validate}
    >
      <DonorLinkInput
        label="Full name"
        required
        value={draft.displayName}
        onChangeText={(v) => {
          update({ displayName: v });
          setErrors((e) => ({ ...e, displayName: undefined }));
        }}
        error={errors.displayName}
        leftIcon="person-outline"
        autoCapitalize="words"
        autoComplete="name"
      />
      <DonorLinkInput
        label="Mobile number"
        value={draft.phone}
        onChangeText={(v) => {
          update({ phone: v });
          setErrors((e) => ({ ...e, phone: undefined }));
        }}
        error={errors.phone}
        helperText="Optional. Helps hospitals reach you about a donation. Never shown to other users."
        leftIcon="call-outline"
        keyboardType="phone-pad"
        autoComplete="tel"
      />
    </OnboardingStepScreen>
  );
}
