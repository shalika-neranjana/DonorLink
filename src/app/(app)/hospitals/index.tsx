import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { HospitalCard } from '@/components/organizations/HospitalCard';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { DonorLinkChip } from '@/components/ui/DonorLinkPickers';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { ORGANIZATION_TYPE_LABELS, ORGANIZATION_TYPES, type OrganizationType } from '@/domain';
import { useResource } from '@/hooks/useResource';
import { requestService } from '@/services/requestService';

export default function HospitalsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<OrganizationType | null>(null);
  const { data, error, loading, refreshing, reload } = useResource(() => requestService.listHospitals(), []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((o) => (!type || o.type === type) && (!q || `${o.name} ${o.district} ${o.city ?? ''}`.toLowerCase().includes(q)));
  }, [data, query, type]);

  return (
    <DonorLinkScreen refreshing={refreshing} onRefresh={() => void reload()} header={{ title: 'Hospitals & blood banks' }}>
      <DonorLinkInput label="Search" value={query} onChangeText={setQuery} leftIcon="search" placeholder="Name, town or district" autoCorrect={false} />
      <View className="flex-row flex-wrap gap-2">
        {ORGANIZATION_TYPES.map((t) => (
          <DonorLinkChip key={t} label={ORGANIZATION_TYPE_LABELS[t]} selected={type === t} onPress={() => setType(type === t ? null : t)} />
        ))}
      </View>
      <DonorLinkText variant="caption" tone="muted">
        &quot;Directory listing&quot; means the hospital has not joined DonorLink yet. Requests to those hospitals are checked by DonorLink reviewers.
      </DonorLinkText>
      {loading ? (
        <DonorLinkListSkeleton />
      ) : error && !data ? (
        <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
      ) : rows.length === 0 ? (
        <DonorLinkEmptyState icon="business-outline" title="No hospitals match" description="Try a different name or clear the filter." />
      ) : (
        <View className="gap-3">
          {rows.map((org) => (
            <HospitalCard key={org.$id} organization={org} onPress={() => router.push(`/hospitals/${org.$id}` as Href)} />
          ))}
        </View>
      )}
    </DonorLinkScreen>
  );
}
