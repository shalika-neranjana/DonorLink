import type { MatchedDonor } from '@/types/entities';

/**
 * Remembers the latest match list per request so Donor Details opens instantly
 * without another server round trip. It only holds sanitized, in-memory data
 * and is cleared on sign-out (AuthProvider).
 */
const cache = new Map<string, MatchedDonor[]>();

export const matchCache = {
  set(requestId: string, donors: MatchedDonor[]) {
    cache.set(requestId, donors);
  },
  find(requestId: string, donorId: string): MatchedDonor | undefined {
    return cache.get(requestId)?.find((d) => d.donorId === donorId);
  },
  clear() {
    cache.clear();
  },
};
