import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, View } from 'react-native';

import { Divider, InfoRow } from '@/components/common/InfoRow';
import { VerificationBadge } from '@/components/common/StatusBadges';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkIcon } from '@/components/ui/DonorLinkIcon';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkBanner, DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { ORGANIZATION_TYPE_LABELS } from '@/domain';
import { EMPTY_DRAFT, useRequestDraft } from '@/features/requester/RequestDraftContext';
import { useResource } from '@/hooks/useResource';
import { organizationService } from '@/services/organizationService';

export default function HospitalDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { setDraft } = useRequestDraft();
  const { data, error, loading, reload } = useResource(() => organizationService.getOrganization(id!), [id], { enabled: !!id });

  if (loading) return <DonorLinkScreen header={{ title: 'Hospital' }}><DonorLinkListSkeleton count={2} /></DonorLinkScreen>;
  if (error && !data) return <DonorLinkScreen header={{ title: 'Hospital' }}><DonorLinkErrorState message={error.message} onRetry={() => void reload()} /></DonorLinkScreen>;
  if (!data) return <DonorLinkScreen header={{ title: 'Hospital' }}><DonorLinkEmptyState icon="business-outline" title="Not found" actionLabel="Back" onAction={() => router.back()} /></DonorLinkScreen>;

  const mapsQuery = encodeURIComponent(`${data.name} ${data.district} Sri Lanka`);
  return (
    <DonorLinkScreen
      header={{ title: data.name }}
      footer={
        <DonorLinkButton
          title="Request blood here"
          variant="emergency"
          size="lg"
          leftIcon="water"
          fullWidth
          onPress={() => {
            setDraft({ ...EMPTY_DRAFT, hospitalId: data.$id, hospitalName: data.name, district: data.district });
            router.push('/requests/create');
          }}
        />
      }
    >
      <DonorLinkCard variant="elevated" className="gap-3">
        <View className="flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-md bg-primary-soft">
            <DonorLinkIcon name={data.type === 'hospital' ? 'medkit' : 'water'} size={26} color="primary" />
          </View>
          <View className="flex-1 gap-1">
            <DonorLinkText variant="title">{ORGANIZATION_TYPE_LABELS[data.type]}</DonorLinkText>
            <VerificationBadge status={data.verificationStatus} size="sm" label={data.claimed ? undefined : 'Directory listing'} />
          </View>
        </View>
        <Divider />
        <InfoRow icon="location-outline" label="Location" value={[data.address, data.city, data.district].filter(Boolean).join(', ')} />
        {data.phone ? <InfoRow icon="call-outline" label="Phone" value={data.phone} /> : null}
      </DonorLinkCard>
      {!data.claimed ? (
        <DonorLinkBanner tone="neutral" title="Not yet on DonorLink" message="This hospital hasn't joined DonorLink, so its staff can't verify requests. DonorLink reviewers check requests addressed to it." />
      ) : null}
      <View className="gap-2">
        <DonorLinkButton title="Get directions" variant="outline" leftIcon="navigate" fullWidth onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`)} />
        {data.phone ? <DonorLinkButton title="Call" variant="outline" leftIcon="call" fullWidth onPress={() => void Linking.openURL(`tel:${data.phone}`)} /> : null}
      </View>
    </DonorLinkScreen>
  );
}
