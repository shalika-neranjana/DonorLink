import { useCallback, useEffect, useRef } from 'react';

import { TABLES } from '@/lib/appwrite/config';
import { listRows, Query } from '@/lib/appwrite/database';
import { useAuth } from '@/providers/AuthProvider';
import { donorService } from '@/services/donorService';
import { notificationService } from '@/services/notificationService';
import { requestService } from '@/services/requestService';
import type { AppNotification, BloodRequest, Donation, RequestResponse } from '@/types/entities';
import { useRealtimeRows, useResource } from './useResource';

export interface Invitation {
  response: RequestResponse;
  request: BloodRequest;
}

export interface HomeData {
  myRequests: BloodRequest[];
  invitations: Invitation[];
  activeDonations: Donation[];
  recentNotifications: AppNotification[];
}

/** Debounces bursts of realtime events into one reload. */
export function useDebouncedReload(reload: () => Promise<void>, delay = 600) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void reload(), delay);
  }, [reload, delay]);
}

async function loadInvitations(donorId: string): Promise<Invitation[]> {
  const responses = await donorService.listPendingInvitations(donorId);
  if (responses.length === 0) return [];
  const { rows } = await listRows<BloodRequest>(TABLES.bloodRequests, [
    Query.equal('$id', responses.map((r) => r.requestId)),
    Query.limit(25),
  ]);
  const byId = new Map(rows.map((r) => [r.$id, r]));
  return responses
    .map((response) => ({ response, request: byId.get(response.requestId) }))
    .filter((item): item is Invitation => !!item.request && ['matching', 'donors_contacted', 'partially_fulfilled'].includes(item.request.status));
}

export function useHomeData() {
  const { user, profile } = useAuth();
  const userId = user?.$id;
  const isDonor = !!profile?.isDonor;

  const resource = useResource<HomeData>(
    async () => {
      if (!userId) throw new Error('Not signed in');
      const [myRequests, invitations, activeDonations, recentNotifications] = await Promise.all([
        requestService.listMyActiveRequests(userId),
        isDonor ? loadInvitations(userId) : Promise.resolve([] as Invitation[]),
        isDonor ? donorService.listActiveDonations(userId) : Promise.resolve([] as Donation[]),
        notificationService.list(userId, 'all', 3),
      ]);
      return { myRequests, invitations, activeDonations, recentNotifications };
    },
    [userId, isDonor],
    { enabled: !!userId, reloadOnFocus: true },
  );

  const debouncedReload = useDebouncedReload(resource.reload);
  useRealtimeRows(TABLES.bloodRequests, undefined, debouncedReload, !!userId);
  useRealtimeRows(TABLES.requestResponses, undefined, debouncedReload, !!userId && isDonor);
  useRealtimeRows(TABLES.donations, undefined, debouncedReload, !!userId);

  return resource;
}
