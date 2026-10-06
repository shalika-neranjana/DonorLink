import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { BloodGroupBadge } from '@/components/blood/BloodGroupBadge';
import { Divider, InfoRow } from '@/components/common/InfoRow';
import { DonationStatusBadge } from '@/components/common/StatusBadges';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { View } from 'react-native';
import { useResource } from '@/hooks/useResource';
import { formatDateTime } from '@/lib/format';
import { donationService } from '@/services/donationService';

/** A single donation from history. */
export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, error, loading, reload } = useResource(() => donationService.getDonation(id!), [id], { enabled: !!id });

  if (loading) return <DonorLinkScreen header={{ title: 'Donation' }}><DonorLinkListSkeleton count={2} /></DonorLinkScreen>;
  if (error && !data) return <DonorLinkScreen header={{ title: 'Donation' }}><DonorLinkErrorState message={error.message} onRetry={() => void reload()} /></DonorLinkScreen>;
  if (!data) return <DonorLinkScreen header={{ title: 'Donation' }}><DonorLinkEmptyState icon="heart-outline" title="Donation not found" actionLabel="Back to history" onAction={() => router.replace('/history')} /></DonorLinkScreen>;

  return (
    <DonorLinkScreen header={{ title: 'Donation', subtitle: data.hospitalName }}>
      <DonorLinkCard variant="elevated" className="gap-3">
        <View className="flex-row items-center gap-4">
          <BloodGroupBadge group={data.bloodGroup} size="lg" />
          <View className="flex-1 gap-1.5">
            <DonorLinkText variant="heading">{data.hospitalName}</DonorLinkText>
            <DonationStatusBadge status={data.status} />
          </View>
        </View>
        <Divider />
        <InfoRow icon="calendar-outline" label="Accepted" value={formatDateTime(data.$createdAt)} />
        {data.scheduledFor ? <InfoRow icon="time-outline" label="Scheduled" value={formatDateTime(data.scheduledFor)} /> : null}
        {data.completedAt ? <InfoRow icon="checkmark-done-outline" label="Confirmed" value={formatDateTime(data.completedAt)} /> : null}
        {data.coordinationNote ? <InfoRow icon="chatbubble-ellipses-outline" label="Note from the hospital" value={data.coordinationNote} /> : null}
      </DonorLinkCard>
      {data.status === 'scheduled' ? <DonorLinkButton title="Open coordination details" onPress={() => router.push(`/donor/donation/${data.requestId}` as Href)} /> : null}
    </DonorLinkScreen>
  );
}
