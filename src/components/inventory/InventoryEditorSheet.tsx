import { useState } from 'react';

import { DonorLinkBottomSheet } from '@/components/ui/DonorLinkBottomSheet';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { BloodGroupPicker, DonorLinkChip, DonorLinkStepper } from '@/components/ui/DonorLinkPickers';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { BLOOD_COMPONENTS, BLOOD_COMPONENT_LABELS, stockState, validateInventory, type BloodComponent, type BloodGroup, type InventoryInput } from '@/domain';
import { View } from 'react-native';
import { StockBadge } from '@/components/common/StatusBadges';

export interface InventoryEditorSheetProps {
  visible: boolean;
  onClose: () => void;
  initial?: Partial<InventoryInput> | null;
  saving?: boolean;
  error?: string | null;
  onSave: (item: InventoryInput) => void;
}

/** Add or adjust stock for one blood group + component. */
export function InventoryEditorSheet({ visible, onClose, initial, saving, error, onSave }: InventoryEditorSheetProps) {
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [component, setComponent] = useState<BloodComponent>('whole_blood');
  const [available, setAvailable] = useState(0);
  const [reserved, setReserved] = useState(0);
  const [threshold, setThreshold] = useState(5);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const editing = !!initial?.bloodGroup;

  // Reset the form each time the sheet opens (state adjusted during render, not in an effect).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setBloodGroup(initial?.bloodGroup ?? null);
      setComponent(initial?.component ?? 'whole_blood');
      setAvailable(initial?.unitsAvailable ?? 0);
      setReserved(initial?.unitsReserved ?? 0);
      setThreshold(initial?.lowStockThreshold ?? 5);
      setErrors({});
    }
  }

  function save() {
    const result = validateInventory({ bloodGroup: bloodGroup ?? undefined, component, unitsAvailable: available, unitsReserved: reserved, lowStockThreshold: threshold });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onSave(result.value);
  }

  const state = stockState(available, reserved, threshold);

  return (
    <DonorLinkBottomSheet
      visible={visible}
      onClose={onClose}
      title={editing ? 'Update stock' : 'Add stock'}
      footer={<DonorLinkButton title="Save stock" size="lg" loading={saving} onPress={save} />}
    >
      {error ? <DonorLinkBanner tone="error" message={error} /> : null}
      {editing ? (
        <DonorLinkText variant="bodyStrong">
          {initial?.bloodGroup} · {BLOOD_COMPONENT_LABELS[component]}
        </DonorLinkText>
      ) : (
        <>
          <BloodGroupPicker value={bloodGroup} onChange={setBloodGroup} error={errors.bloodGroup} required />
          <View className="gap-2">
            <DonorLinkText variant="label" tone="secondary">
              Component
            </DonorLinkText>
            <View className="flex-row flex-wrap gap-2">
              {BLOOD_COMPONENTS.map((c) => (
                <DonorLinkChip key={c} label={BLOOD_COMPONENT_LABELS[c]} selected={component === c} onPress={() => setComponent(c)} />
              ))}
            </View>
          </View>
        </>
      )}
      <DonorLinkStepper label="Units available" value={available} onChange={(v) => { setAvailable(v); setReserved((r) => Math.min(r, v)); }} min={0} max={100000} error={errors.unitsAvailable} />
      <DonorLinkStepper label="Units reserved" value={reserved} onChange={setReserved} min={0} max={available} error={errors.unitsReserved} helperText="Set aside for patients; excluded from free stock." />
      <DonorLinkStepper label="Low-stock alert at" value={threshold} onChange={setThreshold} min={0} max={1000} error={errors.lowStockThreshold} />
      <View className="flex-row items-center gap-2">
        <DonorLinkText variant="bodySmall" tone="secondary">
          Resulting state:
        </DonorLinkText>
        <StockBadge state={state} size="sm" />
      </View>
      <DonorLinkText variant="caption" tone="muted">
        Inventory is maintained by your team in DonorLink and is not an authoritative medical record.
      </DonorLinkText>
    </DonorLinkBottomSheet>
  );
}
