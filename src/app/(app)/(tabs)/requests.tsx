import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { EmergencyRequestCard } from '@/components/requests/EmergencyRequestCard';
import { RequestFilterSheet, EMPTY_REQUEST_FILTERS, countActiveFilters, applyRequestFilters, type RequestFilters } from '@/components/requests/RequestFilterSheet';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkSegmentedControl } from '@/components/ui/DonorLinkPickers';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { isActiveRequestStatus } from '@/domain';
import { useDebouncedReload } from '@/hooks/useHomeData';
import { useRealtimeRows, useResource } from '@/hooks/useResource';
import { TABLES } from '@/lib/appwrite/config';
import { useAuth } from '@/providers/AuthProvider';
import { requestService } from '@/services/requestService';

export default function RequestsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.$id;
  const [tab, setTab] = useState<'active' | 'past'>('active');
  const [filters, setFilters] = useState<RequestFilters>(EMPTY_REQUEST_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);

  const { data, error, loading, refreshing, reload } = useResource(
    () => requestService.listMyRequests(userId!, { limit: 100 }),
    [userId],
    { enabled: !!userId, reloadOnFocus: true },
  );
  const debounced = useDebouncedReload(reload);
  useRealtimeRows(TABLES.bloodRequests, undefined, debounced, !!userId);

  const { visible, activeCount, pastCount } = useMemo(() => {
    const all = data ?? [];
    const active = all.filter((r) => isActiveRequestStatus(r.status));
    const past = all.filter((r) => !isActiveRequestStatus(r.status));
    return {
      visible: applyRequestFilters(tab === 'active' ? active : past, filters),
      activeCount: active.length,
      pastCount: past.length,
    };
  }, [data, tab, filters]);

  const filterCount = countActiveFilters(filters);

  return (
    <DonorLinkScreen
      inTabs
      refreshing={refreshing}
      onRefresh={() => void reload()}
      header={{
        title: 'Requests',
        onBack: false,
        size: 'large',
        actions: [{ icon: 'add-circle', label: 'New blood request', onPress: () => router.push('/requests/create') }],
      }}
    >
      <DonorLinkSegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: `Active${activeCount ? ` (${activeCount})` : ''}` },
          { value: 'past', label: `Past${pastCount ? ` (${pastCount})` : ''}` },
        ]}
      />
      <View className="flex-row items-center justify-between">
        <DonorLinkButton
          title={filterCount ? `Filters (${filterCount})` : 'Filter'}
          variant="outline"
          size="sm"
          leftIcon="options-outline"
          onPress={() => setFilterOpen(true)}
        />
        {filterCount ? <DonorLinkButton title="Clear" variant="ghost" size="sm" onPress={() => setFilters(EMPTY_REQUEST_FILTERS)} /> : null}
      </View>

      {loading ? (
        <DonorLinkListSkeleton />
      ) : error && !data ? (
        <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
      ) : visible.length === 0 ? (
        filterCount ? (
          <DonorLinkEmptyState icon="funnel-outline" title="No requests match these filters" actionLabel="Clear filters" onAction={() => setFilters(EMPTY_REQUEST_FILTERS)} />
        ) : tab === 'active' ? (
          <DonorLinkEmptyState
            icon="water-outline"
            title="No active blood requests"
            description="When someone you know needs blood, create a request and we'll help you find donors."
            actionLabel="Request blood"
            onAction={() => router.push('/requests/create')}
          />
        ) : (
          <DonorLinkEmptyState icon="archive-outline" title="No past requests" description="Completed, cancelled and expired requests will appear here." />
        )
      ) : (
        <View className="gap-3">
          {visible.map((request) => (
            <EmergencyRequestCard key={request.$id} request={request} onPress={() => router.push(`/requests/${request.$id}` as Href)} />
          ))}
        </View>
      )}

      <RequestFilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} value={filters} onApply={setFilters} />
    </DonorLinkScreen>
  );
}
