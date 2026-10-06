import { useState } from 'react';

import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkStepper } from '@/components/ui/DonorLinkPickers';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkBanner, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkSwitchRow } from '@/components/ui/DonorLinkSwitch';
import { useToast } from '@/components/ui/DonorLinkToast';
import { useResource } from '@/hooks/useResource';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { adminService } from '@/services/adminService';

const DEFAULTS = { defaultRadiusKm: 30, requestExpiryHours: 72, maxDonorsContacted: 5, requireVerifiedDonors: false, maintenanceMode: false };

/** Platform configuration (matching radius, expiry, contact limits, maintenance mode). */
export default function AdminSettingsScreen() {
  const { data, error, loading, reload } = useResource(() => adminService.getSettings(), []);
  if (loading) {
    return (
      <DonorLinkScreen header={{ title: 'Platform settings' }}>
        <DonorLinkListSkeleton count={2} />
      </DonorLinkScreen>
    );
  }
  if (error && !data) {
    return (
      <DonorLinkScreen header={{ title: 'Platform settings' }}>
        <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
      </DonorLinkScreen>
    );
  }
  // Keyed by the saved version so the form re-initialises after each save.
  return <SettingsForm key={data?.$updatedAt ?? 'new'} initial={data ? { defaultRadiusKm: data.defaultRadiusKm, requestExpiryHours: data.requestExpiryHours, maxDonorsContacted: data.maxDonorsContacted, requireVerifiedDonors: data.requireVerifiedDonors, maintenanceMode: data.maintenanceMode } : DEFAULTS} onSaved={reload} />;
}

function SettingsForm({ initial, onSaved }: { initial: typeof DEFAULTS; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      await adminService.updateSettings(values);
      toast.success('Settings saved');
      await onSaved();
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DonorLinkScreen header={{ title: 'Platform settings' }} footer={<DonorLinkButton title="Save settings" size="lg" fullWidth loading={saving} onPress={() => void save()} />}>
      {(
        <>
          {formError ? <DonorLinkBanner tone="error" message={formError} /> : null}
          <DonorLinkCard className="gap-5">
            <DonorLinkStepper label="Default matching radius" unit="km" value={values.defaultRadiusKm} min={5} max={100} onChange={(v) => setValues((s) => ({ ...s, defaultRadiusKm: v }))} helperText="Used when a request is verified." />
            <DonorLinkStepper label="Standard request expiry" unit="hour" value={values.requestExpiryHours} min={6} max={720} onChange={(v) => setValues((s) => ({ ...s, requestExpiryHours: v }))} helperText="Critical requests expire after 24 h, urgent after 48 h." />
            <DonorLinkStepper label="Donors contacted automatically" unit="donor" value={values.maxDonorsContacted} min={1} max={50} onChange={(v) => setValues((s) => ({ ...s, maxDonorsContacted: v }))} />
          </DonorLinkCard>
          <DonorLinkCard>
            <DonorLinkSwitchRow title="Only contact verified donors" description="Unverified donors are skipped by automatic matching." value={values.requireVerifiedDonors} onValueChange={(v) => setValues((s) => ({ ...s, requireVerifiedDonors: v }))} accessibilityLabel="Only contact verified donors" />
            <DonorLinkSwitchRow title="Maintenance mode" description="Blocks all writes for non-admin users. Use for backups or migrations." value={values.maintenanceMode} onValueChange={(v) => setValues((s) => ({ ...s, maintenanceMode: v }))} accessibilityLabel="Maintenance mode" />
          </DonorLinkCard>
          {values.maintenanceMode ? <DonorLinkBanner tone="warning" title="Maintenance mode is on" message="Users can read data but cannot create or change anything until you turn this off." /> : null}
        </>
      )}
    </DonorLinkScreen>
  );
}
