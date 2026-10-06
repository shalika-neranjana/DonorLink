import { useMemo } from 'react';
import { View } from 'react-native';

import { InventoryCard } from '@/components/inventory/InventoryCard';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkBanner, DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkSection } from '@/components/ui/DonorLinkSection';
import { stockState } from '@/domain';
import { useResource } from '@/hooks/useResource';
import { adminService } from '@/services/adminService';

/** Read-only oversight of stock across organizations. */
export default function AdminInventoryScreen() {
  const { data, error, loading, refreshing, reload } = useResource(
    async () => {
      const [items, orgs] = await Promise.all([adminService.listInventory(), adminService.listOrganizations()]);
      return { items, names: new Map(orgs.map((o) => [o.$id, o.name])) };
    },
    [],
    { reloadOnFocus: true },
  );

  const grouped = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>['items']>();
    for (const item of data?.items ?? []) map.set(item.organizationId, [...(map.get(item.organizationId) ?? []), item]);
    return [...map.entries()];
  }, [data]);

  return (
    <DonorLinkScreen refreshing={refreshing} onRefresh={() => void reload()} header={{ title: 'Inventory oversight' }}>
      <DonorLinkBanner tone="neutral" message="Self-reported by each organization. Use this to spot shortages, not as a medical record." />
      {loading ? (
        <DonorLinkListSkeleton />
      ) : error && !data ? (
        <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
      ) : grouped.length === 0 ? (
        <DonorLinkEmptyState icon="cube-outline" title="No inventory recorded yet" description="Verified organizations add stock from their workspace." />
      ) : (
        grouped.map(([orgId, items]) => (
          <DonorLinkSection key={orgId} title={data?.names.get(orgId) ?? 'Organization'}>
            <View className="gap-3">
              {[...items]
                .sort((a, b) => ['out', 'critical', 'low', 'ok'].indexOf(stockState(a.unitsAvailable, a.unitsReserved, a.lowStockThreshold)) - ['out', 'critical', 'low', 'ok'].indexOf(stockState(b.unitsAvailable, b.unitsReserved, b.lowStockThreshold)))
                .map((i) => (
                  <InventoryCard key={i.$id} bloodGroup={i.bloodGroup} component={i.component} unitsAvailable={i.unitsAvailable} unitsReserved={i.unitsReserved} lowStockThreshold={i.lowStockThreshold} updatedAt={i.$updatedAt} />
                ))}
            </View>
          </DonorLinkSection>
        ))
      )}
    </DonorLinkScreen>
  );
}
