import { useRouter, type Href } from 'expo-router';

import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkEmptyState } from '@/components/ui/DonorLinkStates';
import { useAuth } from '@/providers/AuthProvider';

/**
 * Shown for any URL or deep link that matches no route. The recovery button
 * goes to the first screen this user may open: route groups are guarded by
 * sign-in state, so a plain "/" would do nothing for signed-out users.
 */
function useHomeHref(): Href {
  const auth = useAuth();
  if (auth.status !== 'signedIn') return '/welcome';
  if (!auth.needsOnboarding) return '/';
  return auth.emailVerified || auth.emailPromptDismissed ? '/personal-info' : '/verify-email';
}

export default function NotFoundScreen() {
  const router = useRouter();
  const home = useHomeHref();
  return (
    <DonorLinkScreen hideOfflineBanner scroll={false} contentClassName="justify-center">
      <DonorLinkEmptyState
        icon="compass-outline"
        title="We couldn't find that page"
        description="The link may be out of date or mistyped. Go back to DonorLink to carry on."
        actionLabel="Go to DonorLink"
        onAction={() => router.replace(home)}
      />
    </DonorLinkScreen>
  );
}
