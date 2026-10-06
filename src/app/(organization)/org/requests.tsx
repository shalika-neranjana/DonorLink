import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { EmergencyRequestCard } from '@/components/requests/EmergencyRequestCard';
import { DonorLinkChip, DonorLinkSegmentedControl } from '@/components/ui/DonorLinkPickers';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { URGENCY_LABELS, URGENCY_LEVELS, isActiveRequestStatus, type Urgency } from '@/domain';
import { OrgScreen } from '@/features/organization/OrgScreen';
import { useOrganization } from '@/features/organization/OrganizationContext';
import { useOrgRequests } from '@/features/organization/useOrgData';

type Tab = 'active' | 'waiting' | 'closed';

export default function OrgRequestsScreen() {
  const router = useRouter();
  const { organization } = useOrganization();
  const { data, error, loading, refreshing, reload } = useOrgRequests(organization?.$id);
  const [tab, setTab] = useState<Tab>('active');
  const [urgency, setUrgency] = useState<Urgency | null>(null);

  const groups = useMemo(() => {
    const all = data ?? [];
    const waiting = all.filter((r) => ['submitted', 'pending_verification'].includes(r.status));
    const active = all.filter((r) => isActiveRequestStatus(r.status) && !waiting.includes(r));
    const closed = all.filter((r) => !isActiveRequestStatus(r.status));
    return { waiting, active, closed };
  }, [data]);
  const rows = groups[tab].filter((r) => !urgency || r.urgency === urgency);

  return (
    <OrgScreen title="Requests" refreshing={refreshing} onRefresh={() => void reload()}>
      {() => (
        <>
          <DonorLinkSegmentedControl<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'active', label: `Active (${groups.active.length})` },
              { value: 'waiting', label: 'To verify', badge: groups.waiting.length || undefined },
              { value: 'closed', label: 'Closed' },
            ]}
          />
          <View className="flex-row flex-wrap gap-2">
            {URGENCY_LEVELS.map((u) => (
              <DonorLinkChip key={u} label={URGENCY_LABELS[u]} selected={urgency === u} onPress={() => setUrgency(urgency === u ? null : u)} />
            ))}
          </View>
          {loading ? (
            <DonorLinkListSkeleton />
          ) : error && !data ? (
            <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
          ) : rows.length === 0 ? (
            <DonorLinkEmptyState icon="water-outline" title="No requests here" description={tab === 'waiting' ? 'Requests addressed to your hospital that need verification will appear here.' : 'Nothing matches this view.'} />
          ) : (
            <View className="gap-3">
              {rows.map((r) => (
                <EmergencyRequestCard key={r.$id} request={r} showRequester onPress={() => router.push(`/org/request/${r.$id}` as Href)} />
              ))}
            </View>
          )}
        </>
      )}
    </OrgScreen>
  );
}
