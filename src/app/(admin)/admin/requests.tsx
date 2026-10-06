import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { EmergencyRequestCard } from '@/components/requests/EmergencyRequestCard';
import { DonorLinkChip } from '@/components/ui/DonorLinkPickers';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { REQUEST_STATUS_LABELS, REQUEST_STATUSES } from '@/domain';
import { useResource } from '@/hooks/useResource';
import { adminService } from '@/services/adminService';

const FILTERS = ['all', 'pending_verification', 'donors_contacted', 'partially_fulfilled', 'fulfilled', 'completed', 'cancelled', 'expired', 'rejected'] as const;

/** All requests, newest first. Pending verification is the working queue. */
export default function AdminRequestsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<(typeof FILTERS)[number]>('pending_verification');
  const { data, error, loading, refreshing, reload } = useResource(() => adminService.listRequests(status), [status], { reloadOnFocus: true });
  void REQUEST_STATUSES;

  return (
    <DonorLinkScreen inTabs refreshing={refreshing} onRefresh={() => void reload()} header={{ title: 'Requests', onBack: false, size: 'large' }}>
      <View className="flex-row flex-wrap gap-2">
        {FILTERS.map((f) => (
          <DonorLinkChip key={f} label={f === 'all' ? 'All' : REQUEST_STATUS_LABELS[f]} selected={status === f} onPress={() => setStatus(f)} />
        ))}
      </View>
      {loading ? (
        <DonorLinkListSkeleton />
      ) : error && !data ? (
        <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
      ) : (data ?? []).length === 0 ? (
        <DonorLinkEmptyState icon="water-outline" title={status === 'pending_verification' ? 'Nothing waiting for verification' : 'No requests in this view'} />
      ) : (
        <View className="gap-3">
          {data!.map((r) => (
            <EmergencyRequestCard key={r.$id} request={r} showRequester onPress={() => router.push(`/admin/request/${r.$id}` as Href)} />
          ))}
        </View>
      )}
    </DonorLinkScreen>
  );
}
