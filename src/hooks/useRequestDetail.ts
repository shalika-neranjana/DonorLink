import { TABLES } from '@/lib/appwrite/config';
import { donationService } from '@/services/donationService';
import { requestService } from '@/services/requestService';
import type { BloodRequest, Donation, RequestResponse } from '@/types/entities';
import { useDebouncedReload } from './useHomeData';
import { useRealtimeRows, useResource } from './useResource';

export interface RequestDetail {
  request: BloodRequest | null;
  responses: RequestResponse[];
  donations: Donation[];
}

/**
 * A request with its donor responses and donations, kept live: any change to
 * the request, a response or a donation for this request refreshes the data.
 */
export function useRequestDetail(requestId: string | undefined) {
  const resource = useResource<RequestDetail>(
    async () => {
      if (!requestId) return { request: null, responses: [], donations: [] };
      const request = await requestService.getRequest(requestId);
      if (!request) return { request: null, responses: [], donations: [] };
      const [responses, donations] = await Promise.all([
        requestService.listResponses(requestId).catch(() => [] as RequestResponse[]),
        donationService.listForRequest(requestId).catch(() => [] as Donation[]),
      ]);
      return { request, responses, donations };
    },
    [requestId],
    { enabled: !!requestId, reloadOnFocus: true },
  );

  const debounced = useDebouncedReload(resource.reload, 400);
  const enabled = !!requestId;
  useRealtimeRows<BloodRequest>(TABLES.bloodRequests, requestId, debounced, enabled);
  useRealtimeRows<RequestResponse>(
    TABLES.requestResponses,
    undefined,
    (event) => {
      if (event.row.requestId === requestId) debounced();
    },
    enabled,
  );
  useRealtimeRows<Donation>(
    TABLES.donations,
    undefined,
    (event) => {
      if (event.row.requestId === requestId) debounced();
    },
    enabled,
  );

  return resource;
}
