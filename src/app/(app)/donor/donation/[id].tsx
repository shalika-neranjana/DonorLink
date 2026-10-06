import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { BloodGroupBadge } from '@/components/blood/BloodGroupBadge';
import { Divider, InfoRow, MedicalDisclaimer } from '@/components/common/InfoRow';
import { DonationStatusBadge, RequestStatusBadge } from '@/components/common/StatusBadges';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkIcon } from '@/components/ui/DonorLinkIcon';
import { DonorLinkConfirmDialog } from '@/components/ui/DonorLinkModal';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkBanner, DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { useDebouncedReload } from '@/hooks/useHomeData';
import { useRealtimeRows, useResource } from '@/hooks/useResource';
import { TABLES } from '@/lib/appwrite/config';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { formatDateTime } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { donorService } from '@/services/donorService';
import { organizationService } from '@/services/organizationService';
import { requestService } from '@/services/requestService';
import type { Donation } from '@/types/entities';

const STEPS = ['You accepted', 'Go to the hospital', 'Hospital confirms your donation'];

/** Donation coordination for a donor who accepted a request. */
export default function DonationCoordinationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const userId = user?.$id;
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const { data, error, loading, refreshing, reload } = useResource(
    async () => {
      const [request, donation] = await Promise.all([requestService.getRequest(id!), donorService.getDonationForRequest(id!, userId!)]);
      const hospital = request?.hospitalId ? await organizationService.getOrganization(request.hospitalId).catch(() => null) : null;
      return { request, donation, hospital };
    },
    [id, userId],
    { enabled: !!id && !!userId, reloadOnFocus: true },
  );
  const debounced = useDebouncedReload(reload, 300);
  useRealtimeRows<Donation>(TABLES.donations, undefined, (e) => (e.row.requestId === id ? debounced() : undefined), !!id);
  useRealtimeRows(TABLES.bloodRequests, id, debounced, !!id);

  async function withdraw() {
    setWithdrawing(true);
    try {
      await donorService.withdraw(id!);
      toast.success('You withdrew your offer', 'The requester has been told.');
      setWithdrawOpen(false);
      router.replace('/');
    } catch (e) {
      toast.error("We couldn't withdraw your offer", getErrorMessage(e));
    } finally {
      setWithdrawing(false);
    }
  }

  if (loading) {
    return (
      <DonorLinkScreen header={{ title: 'Donation details' }}>
        <DonorLinkListSkeleton count={2} />
      </DonorLinkScreen>
    );
  }
  if (error && !data) {
    return (
      <DonorLinkScreen header={{ title: 'Donation details' }}>
        <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
      </DonorLinkScreen>
    );
  }
  const { request, donation, hospital } = data ?? {};
  if (!request || !donation) {
    return (
      <DonorLinkScreen header={{ title: 'Donation details' }}>
        <DonorLinkEmptyState icon="heart-outline" title="No donation found" description="Accept a request first to see coordination details here." actionLabel="Back to home" onAction={() => router.replace('/')} />
      </DonorLinkScreen>
    );
  }

  const stepIndex = donation.status === 'completed' ? 3 : donation.status === 'scheduled' ? 1 : -1;
  const mapsQuery = encodeURIComponent(`${request.hospitalName} ${request.district} Sri Lanka`);

  return (
    <DonorLinkScreen refreshing={refreshing} onRefresh={() => void reload()} header={{ title: 'Donation details', subtitle: request.hospitalName }}>
      {donation.status === 'completed' ? (
        <DonorLinkBanner tone="success" title="Donation confirmed" message="Thank you. Your donation is saved in your donation history." actionLabel="View history" onAction={() => router.push('/history/donations')} />
      ) : donation.status === 'cancelled' || donation.status === 'no_show' ? (
        <DonorLinkBanner tone="neutral" title="This donation was cancelled" message="No further action is needed." />
      ) : null}

      <DonorLinkCard variant="elevated" className="gap-3">
        <View className="flex-row items-center gap-4">
          <BloodGroupBadge group={request.bloodGroup} size="lg" />
          <View className="flex-1 gap-1.5">
            <DonorLinkText variant="heading">{request.hospitalName}</DonorLinkText>
            <View className="flex-row flex-wrap gap-1.5">
              <DonationStatusBadge status={donation.status} size="sm" />
              <RequestStatusBadge status={request.status} size="sm" />
            </View>
          </View>
        </View>
        <Divider />
        <InfoRow icon="location-outline" label="Where" value={[request.wardUnit, hospital?.address, request.city, request.district].filter(Boolean).join(', ')} />
        <InfoRow icon="calendar-outline" label="When" value={donation.scheduledFor ? formatDateTime(donation.scheduledFor) : 'As soon as you can. Staff may suggest a time.'} />
        {donation.coordinationNote ? <InfoRow icon="chatbubble-ellipses-outline" label="Message from the hospital" value={donation.coordinationNote} /> : null}
        <InfoRow icon="person-outline" label="Requested by" value={request.requesterName} />
      </DonorLinkCard>

      {donation.status === 'scheduled' ? (
        <>
          <DonorLinkCard className="gap-3">
            <DonorLinkText variant="title">What happens next</DonorLinkText>
            {STEPS.map((step, index) => (
              <View key={step} className="flex-row items-center gap-3">
                <View className={`h-7 w-7 items-center justify-center rounded-full ${index < stepIndex ? 'bg-success' : index === stepIndex ? 'bg-primary' : 'border-2 border-border-strong'}`}>
                  {index < stepIndex ? <DonorLinkIcon name="checkmark" size={16} color="primaryForeground" /> : <DonorLinkText variant="caption" tone={index === stepIndex ? 'inverse' : 'muted'}>{index + 1}</DonorLinkText>}
                </View>
                <DonorLinkText variant={index === stepIndex ? 'bodyStrong' : 'body'} tone={index > stepIndex ? 'muted' : 'default'}>
                  {step}
                </DonorLinkText>
              </View>
            ))}
            <DonorLinkText variant="caption" tone="muted">
              Bring a photo ID. Hospital staff make the final decision on your eligibility on the day.
            </DonorLinkText>
          </DonorLinkCard>

          <View className="gap-2">
            <DonorLinkButton title="Get directions" leftIcon="navigate" fullWidth onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`)} />
            {hospital?.phone ? <DonorLinkButton title={`Call ${hospital.name.split(',')[0]}`} variant="outline" leftIcon="call" fullWidth onPress={() => void Linking.openURL(`tel:${hospital.phone}`)} /> : null}
            <DonorLinkButton title="I can't make it" variant="danger" leftIcon="return-up-back" fullWidth onPress={() => setWithdrawOpen(true)} />
          </View>
        </>
      ) : null}

      <MedicalDisclaimer compact />

      <DonorLinkConfirmDialog
        visible={withdrawOpen}
        title="Withdraw your offer?"
        message="The requester will be told so they can look for another donor. You can't undo this."
        confirmLabel="Yes, withdraw"
        cancelLabel="Keep my offer"
        tone="danger"
        loading={withdrawing}
        onCancel={() => setWithdrawOpen(false)}
        onConfirm={() => void withdraw()}
      />
    </DonorLinkScreen>
  );
}
