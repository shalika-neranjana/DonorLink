import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { ONBOARDING_STEPS, type OnboardingStep } from './OnboardingContext';

export interface OnboardingStepScreenProps {
  step: OnboardingStep;
  title: string;
  /** Why we are asking: onboarding must never feel like a bare form. */
  why: string;
  children: ReactNode;
  onNext?: () => boolean | void | Promise<boolean | void>;
  nextLabel?: string;
  nextLoading?: boolean;
  skippable?: boolean;
}

/** Shared frame for the onboarding steps: progress, explanation, Back/Continue. */
export function OnboardingStepScreen({ step, title, why, children, onNext, nextLabel, nextLoading, skippable }: OnboardingStepScreenProps) {
  const router = useRouter();
  const index = ONBOARDING_STEPS.indexOf(step);
  const total = ONBOARDING_STEPS.length - 1; // the last screen is the summary
  const next = ONBOARDING_STEPS[index + 1];

  async function goNext() {
    const result = onNext ? await onNext() : true;
    if (result === false) return;
    if (next) router.push(`/${next}` as Href);
  }

  return (
    <DonorLinkScreen
      header={{ title, onBack: index > 0 ? 'auto' : false }}
      footer={
        <>
          <DonorLinkButton title={nextLabel ?? 'Continue'} size="lg" fullWidth loading={nextLoading} onPress={() => void goNext()} />
          {skippable && next ? (
            <DonorLinkButton title="Skip for now" variant="ghost" fullWidth onPress={() => router.push(`/${next}` as Href)} />
          ) : null}
        </>
      }
    >
      {index < total ? (
        <View className="gap-2" accessible accessibilityLabel={`Step ${index + 1} of ${total}`}>
          <View className="flex-row gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <View key={i} className={`h-1.5 flex-1 rounded-full ${i <= index ? 'bg-primary' : 'bg-border'}`} />
            ))}
          </View>
          <DonorLinkText variant="caption" tone="muted">
            Step {index + 1} of {total}
          </DonorLinkText>
        </View>
      ) : null}
      <DonorLinkText variant="body" tone="secondary">
        {why}
      </DonorLinkText>
      {children}
    </DonorLinkScreen>
  );
}
