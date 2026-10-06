import { View } from 'react-native';

import { BarSeries, HorizontalBars } from '@/components/common/Charts';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkSection } from '@/components/ui/DonorLinkSection';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { REQUEST_STATUS_LABELS, REQUEST_STATUSES } from '@/domain';
import { useResource } from '@/hooks/useResource';
import { adminService } from '@/services/adminService';

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <DonorLinkCard className="min-w-[47%] flex-1 gap-0.5" accessibilityLabel={`${label}: ${value}`}>
      <DonorLinkText variant="caption" tone="muted">
        {label}
      </DonorLinkText>
      <DonorLinkText variant="heading">{value}</DonorLinkText>
      {hint ? (
        <DonorLinkText variant="caption" tone="secondary">
          {hint}
        </DonorLinkText>
      ) : null}
    </DonorLinkCard>
  );
}

export default function AdminAnalyticsScreen() {
  const { data, error, loading, refreshing, reload } = useResource(() => adminService.analytics(), [], { reloadOnFocus: true });

  return (
    <DonorLinkScreen refreshing={refreshing} onRefresh={() => void reload()} header={{ title: 'Analytics' }}>
      {loading ? (
        <DonorLinkListSkeleton />
      ) : error && !data ? (
        <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
      ) : data ? (
        <>
          <View className="flex-row flex-wrap gap-3">
            <Metric label="Donor acceptance rate" value={data.responses.acceptanceRate === null ? 'No data yet' : `${data.responses.acceptanceRate}%`} hint={`${data.responses.accepted} accepted · ${data.responses.declined} declined`} />
            <Metric label="Donors available now" value={`${data.donors.availableNow}`} hint={`of ${data.donors.registered} registered`} />
            <Metric label="Verified donors" value={`${data.donors.verified}`} />
            <Metric label="Notifications read" value={data.notifications.sent ? `${Math.round((data.notifications.read / data.notifications.sent) * 100)}%` : 'No data yet'} hint={`${data.notifications.read} of ${data.notifications.sent} sent`} />
          </View>

          <DonorLinkSection title="New requests per day">
            <DonorLinkCard>
              <BarSeries data={data.requests.last7Days.map((d) => ({ label: new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2), value: d.count }))} summary={`New requests per day: ${data.requests.last7Days.map((d) => `${d.date} ${d.count}`).join(', ')}`} />
            </DonorLinkCard>
          </DonorLinkSection>

          <DonorLinkSection title="Requests by status" description={`${data.requests.total} in total`}>
            <DonorLinkCard>
              <HorizontalBars
                rows={REQUEST_STATUSES.filter((s) => s !== 'draft' && data.requests.byStatus[s] > 0).map((s) => ({
                  label: REQUEST_STATUS_LABELS[s],
                  value: data.requests.byStatus[s],
                  tone: ['completed', 'fulfilled'].includes(s) ? 'success' : ['cancelled', 'expired', 'rejected'].includes(s) ? 'neutral' : s === 'pending_verification' ? 'warning' : 'primary',
                }))}
              />
            </DonorLinkCard>
          </DonorLinkSection>

          <DonorLinkSection title="Fulfilment">
            <DonorLinkCard>
              <HorizontalBars
                rows={[
                  { label: 'Donations completed', value: data.donations.completed, tone: 'success' },
                  { label: 'Donations in progress', value: data.donations.open, tone: 'primary' },
                  { label: 'Verified organizations', value: data.organizations.verified, tone: 'primary' },
                  { label: 'Low or empty stock items', value: data.inventory.lowStock + data.inventory.outOfStock, tone: 'emergency' },
                ]}
              />
            </DonorLinkCard>
          </DonorLinkSection>
        </>
      ) : null}
    </DonorLinkScreen>
  );
}
