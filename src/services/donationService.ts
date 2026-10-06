import { callApi } from '@/lib/appwrite/api';
import { TABLES } from '@/lib/appwrite/config';
import { findRow, listRows, Query } from '@/lib/appwrite/database';
import type { BloodRequest, Donation } from '@/types/entities';

export const donationService = {
  getDonation(donationId: string): Promise<Donation | null> {
    return findRow<Donation>(TABLES.donations, donationId);
  },

  async listForRequest(requestId: string): Promise<Donation[]> {
    const result = await listRows<Donation>(TABLES.donations, [
      Query.equal('requestId', [requestId]),
      Query.orderAsc('$createdAt'),
      Query.limit(50),
    ]);
    return result.rows;
  },

  /** Requester, hospital staff or admin confirms that the donor gave blood. */
  confirm(donationId: string) {
    return callApi<{ donation: Donation; request: BloodRequest }>('donation.confirm', { donationId });
  },

  schedule(donationId: string, input: { scheduledFor?: string; note?: string }) {
    return callApi<{ donation: Donation }>('donation.schedule', { donationId, ...input });
  },

  cancel(donationId: string, options: { noShow?: boolean } = {}) {
    return callApi<{ donation: Donation; request: BloodRequest | null }>('donation.cancel', { donationId, ...options });
  },
};
