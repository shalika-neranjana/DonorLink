import { useRouter } from 'expo-router';

import { VerifyEmailPanel } from '@/components/common/VerifyEmailPanel';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';

export default function VerifyEmailFromProfileScreen() {
  const router = useRouter();
  return (
    <DonorLinkScreen header={{ title: 'Verify your email' }}>
      <VerifyEmailPanel onVerified={() => router.back()} />
    </DonorLinkScreen>
  );
}
