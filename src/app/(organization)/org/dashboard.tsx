import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { VerificationBadge } from '@/components/common/StatusBadges';
import { EmergencyRequestCard } from '@/components/requests/EmergencyRequestCard';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkIcon, type IconName } from '@/components/ui/DonorLinkIcon';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkBanner, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkSection } from '@/components/ui/DonorLinkSection';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { stockState, isActiveRequestStatus } from '@/domain';
import { EMPTY_DRAFT, useRequestDraft } from '@/features/requester/RequestDraftContext';
import { OrgScreen } from '@/features/organization/OrgScreen';
import { useOrgDonations, useOrgInventory, useOrgRequests } from '@/features/organization/useOrgData';
import { useOrganization } from '@/features/organization/OrganizationContext';
import type { ColorToken } from '@/theme/tokens';

function Stat({ icon, label, value, tone, onPress }: { icon: IconName; label: string; value: number; tone?: ColorToken; onPress?: () => void }) {
  return (
    <DonorLinkCard onPress={onPress} accessibilityLabel={`${label}: ${value}`} className="w-[47.5%] gap-1">
      <View className="flex-row items-center justify-between">
        <DonorLinkIcon name={icon} size={20} color={tone ?? 'primary'} />
        <DonorLinkText variant="display" tone={tone === 'emergency' && value > 0 ? 'emergency' : 'default'}>
          {value}
        </DonorLinkText>
      </View>
      <DonorLinkText variant="bodySmall" tone="secondary">
        {label}
      </DonorLinkText>
    </DonorLinkCard>
  );
}

/** Operational overview: what needs action now, not a copy of the individual Home. */
export default function OrgDashboardScreen() {
  const router = useRouter();
  const { setDraft } = useRequestDraft();
  const { organization, organizations, select } = useOrganization();
  const requests = useOrgRequests(organization?.$id);
  const donations = useOrgDonations(organization?.$id);
  const inventory = useOrgInventory(organization?.$id);

  const summary = useMemo(() => {
    const all = requests.data ?? [];
    const needsVerification = all.filter((r) => ['submitted', 'pending_verification'].includes(r.status));
    const active = all.filter((r) => isActiveRequestStatus(r.status) && !['submitted', 'pending_verification'].includes(r.status));
    const coming = (donations.data?.donations ?? []).filter((d) => d.status === 'scheduled');
    const lowStock = (inventory.data ?? []).filter((i) => ['out', 'critical', 'low'].includes(stockState(i.unitsAvailable, i.unitsReserved, i.lowStockThreshold)));
    return { needsVerification, active, coming, lowStock };
  }, [requests.data, donations.data, inventory.data]);

  const loading = requests.loading || donations.loading || inventory.loading;
  const error = requests.error ?? donations.error ?? inventory.error;
  const reloadAll = async () => {
    await Promise.all([requests.reload(), donations.reload(), inventory.reload()]);
  };

  return (
    <OrgScreen title="Overview" refreshing={requests.refreshing || donations.refreshing || inventory.refreshing} onRefresh={() => void reloadAll()}>
      {(org) => (
        <>
          <DonorLinkCard variant="elevated" className="gap-2">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <DonorLinkText variant="title">{org.name}</DonorLinkText>
                <DonorLinkText variant="bodySmall" tone="secondary">
                  {org.district}
                </DonorLinkText>
              </View>
              <VerificationBadge status={org.verificationStatus} />
            </View>
            {organizations.length > 1 ? (
              <View className="flex-row flex-wrap gap-2">
                {organizations.map((o) => (
                  <DonorLinkButton key={o.$id} title={o.name} size="sm" variant={o.$id === org.$id ? 'primary' : 'outline'} onPress={() => select(o.$id)} />
                ))}
              </View>
            ) : null}
          </DonorLinkCard>

          {org.verificationStatus !== 'verified' ? (
            <DonorLinkBanner tone="warning" title="Organization not verified yet" message="Inventory and automatic request verification unlock once a DonorLink administrator verifies your organization." />
          ) : null}

          {loading ? (
            <DonorLinkListSkeleton count={2} />
          ) : error && !requests.data ? (
            <DonorLinkErrorState message={error.message} onRetry={() => void reloadAll()} compact />
          ) : (
            <>
              <View className="flex-row flex-wrap gap-3">
                <Stat icon="shield-checkmark" label="Need verification" value={summary.needsVerification.length} tone={summary.needsVerification.length ? 'warning' : 'primary'} onPress={() => router.push('/org/verification')} />
                <Stat icon="water" label="Active requests" value={summary.active.length} onPress={() => router.push('/org/requests')} />
                <Stat icon="people" label="Donors on the way" value={summary.coming.length} tone="success" onPress={() => router.push('/org/donors')} />
                <Stat icon="alert-circle" label="Low stock" value={summary.lowStock.length} tone={summary.lowStock.length ? 'emergency' : 'primary'} onPress={() => router.push('/org/inventory')} />
              </View>

              {summary.needsVerification.length > 0 ? (
                <DonorLinkSection title="Waiting for your verification" actionLabel="Review all" onAction={() => router.push('/org/verification')}>
                  {summary.needsVerification.slice(0, 3).map((r) => (
                    <EmergencyRequestCard key={r.$id} request={r} showRequester onPress={() => router.push(`/org/request/${r.$id}` as Href)} />
                  ))}
                </DonorLinkSection>
              ) : null}

              {summary.active.length > 0 ? (
                <DonorLinkSection title="Active requests" actionLabel="See all" onAction={() => router.push('/org/requests')}>
                  {summary.active.slice(0, 3).map((r) => (
                    <EmergencyRequestCard key={r.$id} request={r} showRequester onPress={() => router.push(`/org/request/${r.$id}` as Href)} />
                  ))}
                </DonorLinkSection>
              ) : null}

              {summary.lowStock.length > 0 ? (
                <DonorLinkBanner tone="emergency" title={`${summary.lowStock.length} stock item${summary.lowStock.length === 1 ? ' is' : 's are'} running low`} message={summary.lowStock.slice(0, 4).map((i) => i.bloodGroup).join(', ')} actionLabel="Open inventory" onAction={() => router.push('/org/inventory')} />
              ) : null}

              <DonorLinkButton title="Create a request for this hospital" variant="outline" leftIcon="add-circle" fullWidth onPress={() => {
                setDraft({ ...EMPTY_DRAFT, hospitalId: org.$id, hospitalName: org.name, district: org.district });
                router.push('/requests/create');
              }}
              />
            </>
          )}
        </>
      )}
    </OrgScreen>
  );
}
