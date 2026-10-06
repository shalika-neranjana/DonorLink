import { callApi } from '@/lib/appwrite/api';
import type { BloodRequest, MatchesResult, RequestResponse } from '@/types/entities';

export const matchingService = {
  /**
   * Application-level donor matching, computed server-side so donor
   * locations and contact details never reach the requester's device.
   */
  getMatches(requestId: string, options: { radiusKm?: number; verifiedOnly?: boolean } = {}) {
    return callApi<MatchesResult>('request.matches', { requestId, ...options });
  },

  contactDonor(requestId: string, donorId: string) {
    return callApi<{ request: BloodRequest; response: RequestResponse }>('request.contactDonor', { requestId, donorId });
  },
};
