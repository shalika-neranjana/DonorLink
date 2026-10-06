import { ID } from 'react-native-appwrite';

import { ACTIVE_REQUEST_STATUSES, type CreateRequestInput, type RequestStatus } from '@/domain';
import { callApi } from '@/lib/appwrite/api';
import { TABLES } from '@/lib/appwrite/config';
import { findRow, listRows, Query } from '@/lib/appwrite/database';
import type { BloodRequest, Organization, RequestResponse } from '@/types/entities';

export interface RequestFilters {
  statuses?: readonly RequestStatus[];
  limit?: number;
}

export const requestService = {
  /** A fresh id the caller keeps across retries so a double tap cannot create two requests. */
  newClientId(): string {
    return ID.unique();
  },

  createEmergencyRequest(input: CreateRequestInput, clientId: string) {
    return callApi<{ request: BloodRequest; duplicate: boolean }>('request.create', { request: input, clientId });
  },

  getRequest(requestId: string): Promise<BloodRequest | null> {
    return findRow<BloodRequest>(TABLES.bloodRequests, requestId);
  },

  async listMyRequests(userId: string, filters: RequestFilters = {}): Promise<BloodRequest[]> {
    const queries = [Query.equal('requesterId', [userId]), Query.orderDesc('$createdAt'), Query.limit(filters.limit ?? 50)];
    if (filters.statuses) queries.push(Query.equal('status', [...filters.statuses]));
    return (await listRows<BloodRequest>(TABLES.bloodRequests, queries)).rows;
  },

  listMyActiveRequests(userId: string): Promise<BloodRequest[]> {
    return requestService.listMyRequests(userId, { statuses: ACTIVE_REQUEST_STATUSES });
  },

  async listResponses(requestId: string): Promise<RequestResponse[]> {
    const result = await listRows<RequestResponse>(TABLES.requestResponses, [
      Query.equal('requestId', [requestId]),
      Query.orderDesc('$updatedAt'),
      Query.limit(100),
    ]);
    return result.rows;
  },

  cancelRequest(requestId: string, reason?: string) {
    return callApi<{ request: BloodRequest }>('request.cancel', { requestId, reason });
  },

  completeRequest(requestId: string) {
    return callApi<{ request: BloodRequest }>('request.complete', { requestId });
  },

  /** Admin or addressed-hospital staff only (enforced server-side). */
  verifyRequest(requestId: string, approve: boolean, note?: string) {
    return callApi<{ request: BloodRequest; contacted: number }>('request.verify', { requestId, approve, note });
  },

  /** Hospitals, blood banks and donation centres from the shared directory. */
  async listHospitals(): Promise<Organization[]> {
    const result = await listRows<Organization>(TABLES.organizations, [Query.orderAsc('name'), Query.limit(100)]);
    return result.rows;
  },
};
