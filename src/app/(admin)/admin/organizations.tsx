import { useState } from 'react';
import { View } from 'react-native';

import { VerificationBadge } from '@/components/common/StatusBadges';
import { HospitalCard } from '@/components/organizations/HospitalCard';
import { DonorLinkBottomSheet } from '@/components/ui/DonorLinkBottomSheet';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { DonorLinkChip, DonorLinkSelect } from '@/components/ui/DonorLinkPickers';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkBanner, DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { DISTRICT_NAMES, ORGANIZATION_TYPES, ORGANIZATION_TYPE_LABELS, VERIFICATION_LABELS, VERIFICATION_STATUSES, type OrganizationType, type VerificationStatus } from '@/domain';
import { useResource } from '@/hooks/useResource';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { adminService } from '@/services/adminService';
import type { Organization } from '@/types/entities';

const DISTRICT_OPTIONS = DISTRICT_NAMES.map((name) => ({ value: name, label: name }));

/** Directory and organization oversight. */
export default function AdminOrganizationsScreen() {
  const toast = useToast();
  const { data, error, loading, refreshing, reload } = useResource(() => adminService.listOrganizations(), [], { reloadOnFocus: true });
  const [editing, setEditing] = useState<Organization | 'new' | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<OrganizationType>('hospital');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<VerificationStatus>('not_submitted');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function open(org: Organization | 'new') {
    setEditing(org);
    setFormError(null);
    if (org === 'new') {
      setName('');
      setType('hospital');
      setDistrict('');
      setCity('');
      setPhone('');
      setStatus('not_submitted');
    } else {
      setName(org.name);
      setType(org.type);
      setDistrict(org.district);
      setCity(org.city ?? '');
      setPhone(org.phone ?? '');
      setStatus(org.verificationStatus);
    }
  }

  async function save() {
    if (saving || !editing) return;
    setSaving(true);
    setFormError(null);
    try {
      await adminService.upsertOrganization({ organizationId: editing === 'new' ? undefined : editing.$id, name, type, district, city: city || undefined, phone: phone || undefined, verificationStatus: status });
      toast.success(editing === 'new' ? 'Listing added' : 'Organization updated');
      setEditing(null);
      await reload();
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DonorLinkScreen
      refreshing={refreshing}
      onRefresh={() => void reload()}
      header={{ title: 'Organizations', actions: [{ icon: 'add-circle', label: 'Add directory listing', onPress: () => open('new') }] }}
    >
      {loading ? (
        <DonorLinkListSkeleton />
      ) : error && !data ? (
        <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
      ) : (data ?? []).length === 0 ? (
        <DonorLinkEmptyState icon="business-outline" title="No organizations" actionLabel="Add a listing" onAction={() => open('new')} />
      ) : (
        <View className="gap-3">
          {data!.map((o) => (
            <HospitalCard key={o.$id} organization={o} onPress={() => open(o)} />
          ))}
        </View>
      )}

      <DonorLinkBottomSheet visible={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add directory listing' : 'Edit organization'} footer={<DonorLinkButton title="Save" loading={saving} onPress={() => void save()} />}>
        {formError ? <DonorLinkBanner tone="error" message={formError} /> : null}
        <DonorLinkInput label="Name" required value={name} onChangeText={setName} leftIcon="business-outline" />
        <View className="flex-row flex-wrap gap-2">
          {ORGANIZATION_TYPES.map((t) => (
            <DonorLinkChip key={t} label={ORGANIZATION_TYPE_LABELS[t]} selected={type === t} onPress={() => setType(t)} />
          ))}
        </View>
        <DonorLinkSelect label="District" required value={district} options={DISTRICT_OPTIONS} onChange={setDistrict} searchable />
        <DonorLinkInput label="Town" value={city} onChangeText={setCity} />
        <DonorLinkInput label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <View className="gap-2">
          <DonorLinkText variant="label" tone="secondary">
            Verification status
          </DonorLinkText>
          <View className="flex-row flex-wrap gap-2">
            {VERIFICATION_STATUSES.map((s) => (
              <DonorLinkChip key={s} label={VERIFICATION_LABELS[s]} selected={status === s} onPress={() => setStatus(s)} />
            ))}
          </View>
          <VerificationBadge status={status} size="sm" />
        </View>
      </DonorLinkBottomSheet>
    </DonorLinkScreen>
  );
}
