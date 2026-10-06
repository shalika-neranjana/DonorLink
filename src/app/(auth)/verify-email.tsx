import { VerifyEmailPanel } from '@/components/common/VerifyEmailPanel';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { useAuth } from '@/providers/AuthProvider';

/** Shown right after sign-up. The root layout moves on to onboarding once verified or skipped. */
export default function VerifyEmailScreen() {
  const { dismissEmailPrompt, signOut } = useAuth();
  return (
    <DonorLinkScreen
      header={{ title: 'Verify your email', onBack: false }}
      footer={<DonorLinkButton title="Use a different account" variant="ghost" fullWidth onPress={() => void signOut()} />}
    >
      <VerifyEmailPanel onSkip={dismissEmailPrompt} />
    </DonorLinkScreen>
  );
}
