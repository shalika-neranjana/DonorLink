import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { EmergencyRequestCard } from '@/components/requests/EmergencyRequestCard';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { DonorLinkConfirmDialog } from '@/components/ui/DonorLinkModal';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkBanner, DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { useToast } from '@/components/ui/DonorLinkToast';
import { OrgScreen } from '@/features/organization/OrgScreen';
import { useOrganization } from '@/features/organization/OrganizationContext';
import { useOrgRequests } from '@/features/organization/useOrgData';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { requestService } from '@/services/requestService';
import type { BloodRequest } from '@/types/entities';

/** Queue of requests addressed to this hospital that are waiting for verification. */
export default function OrgVerificationQueueScreen() {
  const router = useRouter();
  const toast = useToast();
  const { organization } = useOrganization();
  const { data, error, loading, refreshing, reload } = useOrgRequests(organization?.$id);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<BloodRequest | null>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | undefined>();

  const queue = (data ?? []).filter((r) => ['submitted', 'pending_verification'].includes(r.status));

  async function verify(request: BloodRequest, approve: boolean, reason?: string) {
    setBusyId(request.$id);
    try {
      const result = await requestService.verifyRequest(request.$id, approve, reason);
      toast.success(approve ? 'Request verified' : 'Request rejected', approve ? `${result.contacted} donor${result.contacted === 1 ? '' : 's'} contacted.` : 'The requester was told why.');
      setRejecting(null);
      setNote('');
      await reload();
    } catch (e) {
      toast.error("We couldn't update that request", getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <OrgScreen title="Verify requests" refreshing={refreshing} onRefresh={() => void reload()}>
      {() => (
        <>
          <DonorLinkBanner tone="info" message="Only verify a request when you can confirm the patient's need at your hospital. Verification notifies compatible donors immediately." />
          {loading ? (
            <DonorLinkListSkeleton />
          ) : error && !data ? (
            <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
          ) : queue.length === 0 ? (
            <DonorLinkEmptyState icon="shield-checkmark-outline" title="Nothing waiting" description="New requests addressed to your hospital will appear here." />
          ) : (
            queue.map((r) => (
              <View key={r.$id} className="gap-2">
                <EmergencyRequestCard request={r} showRequester onPress={() => router.push(`/org/request/${r.$id}` as Href)} />
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <DonorLinkButton title="Verify" variant="success" leftIcon="shield-checkmark" loading={busyId === r.$id} fullWidth onPress={() => void verify(r, true)} />
                  </View>
                  <View className="flex-1">
                    <DonorLinkButton title="Reject" variant="outline" leftIcon="close" disabled={!!busyId} fullWidth onPress={() => setRejecting(r)} />
                  </View>
                </View>
              </View>
            ))
          )}

          <DonorLinkConfirmDialog
            visible={!!rejecting}
            title="Reject this request?"
            message="The requester is told your reason so they can correct and resubmit."
            confirmLabel="Reject request"
            tone="danger"
            loading={!!rejecting && busyId === rejecting.$id}
            onCancel={() => setRejecting(null)}
            onConfirm={() => {
              if (!note.trim()) {
                setNoteError('Add a short reason.');
                return;
              }
              if (rejecting) void verify(rejecting, false, note.trim());
            }}
          >
            <DonorLinkInput label="Reason" required value={note} onChangeText={(v) => { setNote(v); setNoteError(undefined); }} error={noteError} maxLength={200} />
          </DonorLinkConfirmDialog>
        </>
      )}
    </OrgScreen>
  );
}
