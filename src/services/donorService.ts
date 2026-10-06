import { callApi } from '@/lib/appwrite/api';
import { TABLES } from '@/lib/appwrite/config';
import { listRows, Query } from '@/lib/appwrite/database';
import type { BloodRequest, Donation, RequestResponse } from '@/types/entities';

export const donorService = {
  /** Invitations still awaiting the donor's answer, newest first. */
  async listPendingInvitations(donorId: string): Promise<RequestResponse[]> {
    const result = await listRows<RequestResponse>(TABLES.requestResponses, [
      Query.equal('donorId', [donorId]),
      Query.equal('status', ['pending']),
      Query.orderDesc('$createdAt'),
      Query.limit(25),
    ]);
    return result.rows;
  },

  async getResponseForRequest(requestId: string, donorId: string): Promise<RequestResponse | null> {
    const result = await listRows<RequestResponse>(TABLES.requestResponses, [
      Query.equal('requestId', [requestId]),
      Query.equal('donorId', [donorId]),
      Query.limit(1),
    ]);
    return result.rows[0] ?? null;
  },

  async getDonationForRequest(requestId: string, donorId: string): Promise<Donation | null> {
    const result = await listRows<Donation>(TABLES.donations, [
      Query.equal('requestId', [requestId]),
      Query.equal('donorId', [donorId]),
      Query.limit(1),
    ]);
    return result.rows[0] ?? null;
  },

  async listDonations(donorId: string): Promise<Donation[]> {
    const result = await listRows<Donation>(TABLES.donations, [
      Query.equal('donorId', [donorId]),
      Query.orderDesc('$createdAt'),
      Query.limit(100),
    ]);
    return result.rows;
  },

  async listActiveDonations(donorId: string): Promise<Donation[]> {
    const result = await listRows<Donation>(TABLES.donations, [
      Query.equal('donorId', [donorId]),
      Query.equal('status', ['scheduled']),
      Query.orderDesc('$createdAt'),
      Query.limit(10),
    ]);
    return result.rows;
  },

  accept(requestId: string) {
    return callApi<{ response: RequestResponse; donation: Donation; request: BloodRequest }>('response.accept', { requestId });
  },

  decline(requestId: string, reason?: string) {
    return callApi<{ response: RequestResponse }>('response.decline', { requestId, reason });
  },

  withdraw(requestId: string) {
    return callApi<{ response: RequestResponse; request: BloodRequest | null }>('response.withdraw', { requestId });
  },
};
