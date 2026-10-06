import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { InventoryCard } from '@/components/inventory/InventoryCard';
import { InventoryEditorSheet } from '@/components/inventory/InventoryEditorSheet';
import { DonorLinkChip } from '@/components/ui/DonorLinkPickers';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkBanner, DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { useToast } from '@/components/ui/DonorLinkToast';
import { BLOOD_GROUPS, STOCK_STATE_LABELS, stockState, type BloodGroup, type InventoryInput, type StockState } from '@/domain';
import { OrgScreen } from '@/features/organization/OrgScreen';
import { useOrganization } from '@/features/organization/OrganizationContext';
import { useOrgInventory } from '@/features/organization/useOrgData';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { organizationService } from '@/services/organizationService';
import type { InventoryItem } from '@/types/entities';

const SEVERITY: Record<StockState, number> = { out: 0, critical: 1, low: 2, ok: 3 };

/** Blood inventory with loud low-stock states and one-tap editing. */
export default function OrgInventoryScreen() {
  const toast = useToast();
  const { organization } = useOrganization();
  const { data, error, loading, refreshing, reload } = useOrgInventory(organization?.$id);
  const [group, setGroup] = useState<BloodGroup | null>(null);
  const [state, setState] = useState<StockState | null>(null);
  const [editing, setEditing] = useState<Partial<InventoryInput> | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const rows = useMemo(() => {
    return (data ?? [])
      .map((item) => ({ item, state: stockState(item.unitsAvailable, item.unitsReserved, item.lowStockThreshold) }))
      .filter((r) => (!group || r.item.bloodGroup === group) && (!state || r.state === state))
      .sort((a, b) => SEVERITY[a.state] - SEVERITY[b.state] || a.item.bloodGroup.localeCompare(b.item.bloodGroup));
  }, [data, group, state]);

  const verified = organization?.verificationStatus === 'verified';

  function open(item?: InventoryItem) {
    setSaveError(null);
    setEditing(item ? { bloodGroup: item.bloodGroup, component: item.component, unitsAvailable: item.unitsAvailable, unitsReserved: item.unitsReserved, lowStockThreshold: item.lowStockThreshold } : null);
    setSheetOpen(true);
  }

  async function save(input: InventoryInput) {
    if (!organization || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await organizationService.updateInventory(organization.$id, input);
      toast.success('Stock updated', `${input.bloodGroup}: ${input.unitsAvailable - input.unitsReserved} free units.`);
      setSheetOpen(false);
      await reload();
    } catch (e) {
      setSaveError(getErrorMessage(e, "We couldn't save that stock change."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <OrgScreen
      title="Inventory"
      refreshing={refreshing}
      onRefresh={() => void reload()}
      actions={verified ? [{ icon: 'add-circle', label: 'Add stock', onPress: () => open() }] : undefined}
    >
      {() => (
        <>
          {!verified ? <DonorLinkBanner tone="warning" title="Verification required" message="Inventory can be managed once your organization is verified by an administrator." /> : null}
          <DonorLinkBanner tone="neutral" message="Self-reported stock maintained by your team. It is not shown to the public and is not an authoritative medical record." />

          <View className="gap-2">
            <View className="flex-row flex-wrap gap-2">
              {(['out', 'critical', 'low', 'ok'] as StockState[]).map((s) => (
                <DonorLinkChip key={s} label={STOCK_STATE_LABELS[s]} selected={state === s} onPress={() => setState(state === s ? null : s)} />
              ))}
            </View>
            <View className="flex-row flex-wrap gap-2">
              {BLOOD_GROUPS.map((g) => (
                <DonorLinkChip key={g} label={g} selected={group === g} onPress={() => setGroup(group === g ? null : g)} />
              ))}
            </View>
          </View>

          {loading ? (
            <DonorLinkListSkeleton />
          ) : error && !data ? (
            <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
          ) : rows.length === 0 ? (
            <DonorLinkEmptyState
              icon="cube-outline"
              title={(data ?? []).length === 0 ? 'No stock recorded yet' : 'Nothing matches these filters'}
              description={(data ?? []).length === 0 ? 'Add the blood groups you hold so low-stock alerts can work.' : undefined}
              actionLabel={verified && (data ?? []).length === 0 ? 'Add stock' : undefined}
              onAction={verified ? () => open() : undefined}
            />
          ) : (
            <View className="gap-3">
              {rows.map(({ item }) => (
                <InventoryCard key={item.$id} bloodGroup={item.bloodGroup} component={item.component} unitsAvailable={item.unitsAvailable} unitsReserved={item.unitsReserved} lowStockThreshold={item.lowStockThreshold} updatedAt={item.$updatedAt} onPress={verified ? () => open(item) : undefined} />
              ))}
            </View>
          )}

          <InventoryEditorSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} initial={editing} saving={saving} error={saveError} onSave={(i) => void save(i)} />
        </>
      )}
    </OrgScreen>
  );
}
