import type { MatchedDonor } from '@/types/entities';

/**
 * Remembers the latest match list per request so Donor Details opens instantly
 * without another server round trip. Cleared on sign-out via module reload
 * semantics (it only holds sanitized, in-memory data).
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
