import { useNetworkState } from 'expo-network';

import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';

/**
 * Shown when the device has no connection. Cached screens stay visible; actions
 * that need the network explain why they fail instead of silently doing nothing.
 */
export function OfflineBanner() {
  const network = useNetworkState();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  if (!offline) return null;
  return (
    <DonorLinkBanner
      tone="warning"
      title="You're offline"
      message="Showing what we last loaded. Requests and responses need a connection."
      className="mx-4 mb-2"
    />
  );
}
