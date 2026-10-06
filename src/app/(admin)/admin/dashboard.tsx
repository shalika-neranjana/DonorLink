import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { BarSeries } from '@/components/common/Charts';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkIcon, type IconName } from '@/components/ui/DonorLinkIcon';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkSection } from '@/components/ui/DonorLinkSection';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { useResource } from '@/hooks/useResource';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { adminService } from '@/services/adminService';
import type { ColorToken } from '@/theme/tokens';

function Stat({ icon, label, value, tone, onPress }: { icon: IconName; label: string; value: number | string; tone?: ColorToken; onPress?: () => void }) {
  return (
    <DonorLinkCard onPress={onPress} accessibilityLabel={`${label}: ${value}`} className="w-[47.5%] gap-1">
      <View className="flex-row items-center justify-between">
        <DonorLinkIcon name={icon} size={20} color={tone ?? 'primary'} />
        <DonorLinkText variant="heading">{value}</DonorLinkText>
      </View>
      <DonorLinkText variant="bodySmall" tone="secondary">
        {label}
      </DonorLinkText>
    </DonorLinkCard>
  );
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const toast = useToast();
  const { data, error, loading, refreshing, reload } = useResource(() => adminService.analytics(), [], { reloadOnFocus: true });

  async function maintenance() {
    try {
      const result = await adminService.runMaintenance();
      toast.success('Maintenance complete', `${result.expired} stale request${result.expired === 1 ? '' : 's'} expired.`);
      await reload();
    } catch (e) {
      toast.error("Maintenance didn't run", getErrorMessage(e));
    }
  }

  return (
    <DonorLinkScreen inTabs refreshing={refreshing} onRefresh={() => void reload()} header={{ title: 'Overview', subtitle: 'Platform at a glance', onBack: false, size: 'large' }}>
      {loading ? (
        <DonorLinkListSkeleton />
      ) : error && !data ? (
        <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
      ) : data ? (
        <>
          <View className="flex-row flex-wrap gap-3">
            <Stat icon="people" label="Users" value={data.users} onPress={() => router.push('/admin/users')} />
            <Stat icon="water" label="Active requests" value={data.requests.active} onPress={() => router.push('/admin/requests')} />
            <Stat icon="heart" label="Donors available now" value={data.donors.availableNow} tone="success" />
            <Stat icon="shield-checkmark" label="Verifications pending" value={data.verifications.pending} tone={data.verifications.pending ? 'warning' : 'primary'} onPress={() => router.push('/admin/verification')} />
            <Stat icon="checkmark-done" label="Donations completed" value={data.donations.completed} tone="success" />
            <Stat icon="cube" label="Low or empty stock" value={data.inventory.lowStock + data.inventory.outOfStock} tone={data.inventory.lowStock + data.inventory.outOfStock ? 'emergency' : 'primary'} onPress={() => router.push('/admin/inventory')} />
          </View>

          <DonorLinkSection title="New requests, last 7 days">
            <DonorLinkCard>
              <BarSeries
                data={data.requests.last7Days.map((d) => ({ label: new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2), value: d.count }))}
                summary={`New requests per day: ${data.requests.last7Days.map((d) => `${d.date} ${d.count}`).join(', ')}`}
              />
            </DonorLinkCard>
          </DonorLinkSection>

          <DonorLinkSection title="Shortcuts">
            <View className="gap-2">
              <DonorLinkButton title="Open analytics" variant="outline" leftIcon="stats-chart" fullWidth onPress={() => router.push('/admin/analytics')} />
              <DonorLinkButton title="Review audit log" variant="outline" leftIcon="receipt" fullWidth onPress={() => router.push('/admin/audit')} />
              <DonorLinkButton title="Expire stale requests now" variant="ghost" leftIcon="time" fullWidth onPress={() => void maintenance()} />
            </View>
          </DonorLinkSection>
          <DonorLinkText variant="caption" tone="muted" align="center">
            Updated {new Date(data.generatedAt).toLocaleTimeString()}
          </DonorLinkText>
        </>
      ) : null}
    </DonorLinkScreen>
  );
}
