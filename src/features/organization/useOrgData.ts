import { useDebouncedReload } from '@/hooks/useHomeData';
import { useRealtimeRows, useResource } from '@/hooks/useResource';
import { TABLES } from '@/lib/appwrite/config';
import { organizationService } from '@/services/organizationService';
import type { BloodRequest, Donation, InventoryItem, RequestResponse } from '@/types/entities';

/** All requests addressed to the organization (active and past), live. */
export function useOrgRequests(organizationId: string | undefined) {
  const resource = useResource(() => organizationService.listRequests(organizationId!, 'all'), [organizationId], {
    enabled: !!organizationId,
    reloadOnFocus: true,
  });
  const debounced = useDebouncedReload(resource.reload, 500);
  useRealtimeRows<BloodRequest>(TABLES.bloodRequests, undefined, (e) => (e.row.hospitalId === organizationId ? debounced() : undefined), !!organizationId);
  return resource;
}

export function useOrgDonations(organizationId: string | undefined) {
  const resource = useResource(
    async () => {
      const [donations, responses] = await Promise.all([
        organizationService.listDonations(organizationId!),
        organizationService.listResponsesForOrganization(organizationId!),
      ]);
      return { donations, responses };
    },
    [organizationId],
    { enabled: !!organizationId, reloadOnFocus: true },
  );
  const debounced = useDebouncedReload(resource.reload, 500);
  useRealtimeRows<Donation>(TABLES.donations, undefined, (e) => (e.row.hospitalId === organizationId ? debounced() : undefined), !!organizationId);
  useRealtimeRows<RequestResponse>(TABLES.requestResponses, undefined, (e) => (e.row.hospitalId === organizationId ? debounced() : undefined), !!organizationId);
  return resource;
}

export function useOrgInventory(organizationId: string | undefined) {
  const resource = useResource<InventoryItem[]>(() => organizationService.listInventory(organizationId!), [organizationId], {
    enabled: !!organizationId,
    reloadOnFocus: true,
  });
  const debounced = useDebouncedReload(resource.reload, 500);
  useRealtimeRows<InventoryItem>(TABLES.bloodInventory, undefined, (e) => (e.row.organizationId === organizationId ? debounced() : undefined), !!organizationId);
  return resource;
}
