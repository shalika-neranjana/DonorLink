import { useRouter, type Href } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { BloodGroupBadge } from '@/components/blood/BloodGroupBadge';
import { DonationStatusBadge, RequestStatusBadge } from '@/components/common/StatusBadges';
import { DonorLinkBadge } from '@/components/ui/DonorLinkBadge';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkChip } from '@/components/ui/DonorLinkPickers';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { REQUEST_STATUS_LABELS, REQUEST_STATUSES, type RequestStatus } from '@/domain';
import { useResource } from '@/hooks/useResource';
import { formatDate, pluralize } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { donorService } from '@/services/donorService';
import { requestService } from '@/services/requestService';

function HistoryCard({
  date,
  group,
  hospital,
  units,
  badge,
  role,
  onPress,
}: {
  date: string;
  group: string;
  hospital: string;
  units: number;
  badge: ReactNode;
  role: string;
  onPress: () => void;
}) {
  return (
    <DonorLinkCard onPress={onPress} accessibilityLabel={`${role}. ${group}, ${pluralize(units, 'unit')} at ${hospital}, ${formatDate(date)}`} className="gap-2">
      <View className="flex-row items-center gap-3">
        <BloodGroupBadge group={group} size="md" />
        <View className="flex-1">
          <DonorLinkText variant="bodyStrong" numberOfLines={1}>
            {hospital}
          </DonorLinkText>
          <DonorLinkText variant="caption" tone="muted">
            {formatDate(date)} · {pluralize(units, 'unit')}
          </DonorLinkText>
        </View>
        {badge}
      </View>
      <DonorLinkBadge label={role} tone="neutral" size="sm" icon={role === 'Requester' ? 'water-outline' : 'heart-outline'} />
    </DonorLinkCard>
  );
}

export function RequestHistoryList() {
  const router = useRouter();
  const { user } = useAuth();
  const [status, setStatus] = useState<RequestStatus | null>(null);
  const { data, error, loading, reload } = useResource(() => requestService.listMyRequests(user!.$id, { limit: 100 }), [user?.$id], { enabled: !!user, reloadOnFocus: true });
  const usedStatuses = useMemo(() => REQUEST_STATUSES.filter((s) => data?.some((r) => r.status === s)), [data]);
  const rows = (data ?? []).filter((r) => !status || r.status === status);

  if (loading) return <DonorLinkListSkeleton />;
  if (error && !data) return <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />;
  if ((data ?? []).length === 0) return <DonorLinkEmptyState icon="document-text-outline" title="No requests yet" description="Blood requests you create will appear here, with their outcome." />;

  return (
    <View className="gap-3">
      {usedStatuses.length > 1 ? (
        <View className="flex-row flex-wrap gap-2">
          {usedStatuses.map((s) => (
            <DonorLinkChip key={s} label={REQUEST_STATUS_LABELS[s]} selected={status === s} onPress={() => setStatus(status === s ? null : s)} />
          ))}
        </View>
      ) : null}
      {rows.map((r) => (
        <HistoryCard key={r.$id} date={r.$createdAt} group={r.bloodGroup} hospital={r.hospitalName} units={r.units} badge={<RequestStatusBadge status={r.status} size="sm" />} role="Requester" onPress={() => router.push(`/requests/${r.$id}` as Href)} />
      ))}
    </View>
  );
}

export function DonationHistoryList() {
  const router = useRouter();
  const { user } = useAuth();
  const { data, error, loading, reload } = useResource(() => donorService.listDonations(user!.$id), [user?.$id], { enabled: !!user, reloadOnFocus: true });

  if (loading) return <DonorLinkListSkeleton />;
  if (error && !data) return <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />;
  if ((data ?? []).length === 0) return <DonorLinkEmptyState icon="heart-outline" title="No donations yet" description="Your completed donations will appear here." />;

  const completed = (data ?? []).filter((d) => d.status === 'completed').length;
  return (
    <View className="gap-3">
      <DonorLinkCard variant="success" className="flex-row items-center justify-between">
        <DonorLinkText variant="bodyStrong">Donations completed</DonorLinkText>
        <DonorLinkText variant="heading" tone="success">
          {completed}
        </DonorLinkText>
      </DonorLinkCard>
      {(data ?? []).map((d) => (
        <HistoryCard key={d.$id} date={d.completedAt ?? d.$createdAt} group={d.bloodGroup} hospital={d.hospitalName} units={d.units} badge={<DonationStatusBadge status={d.status} size="sm" />} role="Donor" onPress={() => router.push(`/history/${d.$id}` as Href)} />
      ))}
    </View>
  );
}
