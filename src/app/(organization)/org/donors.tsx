import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { BloodGroupBadge } from '@/components/blood/BloodGroupBadge';
import { DonationStatusBadge, ResponseStatusBadge } from '@/components/common/StatusBadges';
import { DonorLinkBottomSheet } from '@/components/ui/DonorLinkBottomSheet';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { DonorLinkConfirmDialog } from '@/components/ui/DonorLinkModal';
import { DonorLinkDateTimeField } from '@/components/ui/DonorLinkPickers';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkSection } from '@/components/ui/DonorLinkSection';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { OrgScreen } from '@/features/organization/OrgScreen';
import { useOrganization } from '@/features/organization/OrganizationContext';
import { useOrgDonations } from '@/features/organization/useOrgData';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { donationService } from '@/services/donationService';
import type { Donation } from '@/types/entities';

/** Donor coordination from the hospital side: who is coming, when, and confirming donations. */
export default function OrgDonorsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { organization } = useOrganization();
  const { data, error, loading, refreshing, reload } = useOrgDonations(organization?.$id);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<Donation | null>(null);
  const [when, setWhen] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [cancelling, setCancelling] = useState<Donation | null>(null);

  const scheduled = (data?.donations ?? []).filter((d) => d.status === 'scheduled');
  const completed = (data?.donations ?? []).filter((d) => d.status === 'completed').slice(0, 10);
  const waiting = (data?.responses ?? []).filter((r) => r.status === 'pending');

  async function run(id: string, action: () => Promise<unknown>, message: string) {
    setBusyId(id);
    try {
      await action();
      toast.success(message);
      await reload();
    } catch (e) {
      toast.error("That didn't work", getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <OrgScreen title="Donors" refreshing={refreshing} onRefresh={() => void reload()}>
      {() => (
        <>
          {loading ? (
            <DonorLinkListSkeleton />
          ) : error && !data ? (
            <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
          ) : (
            <>
              <DonorLinkSection title="On their way" description="Donors who accepted a request for your hospital">
                {scheduled.length === 0 ? (
                  <DonorLinkEmptyState compact icon="people-outline" title="No donors coming right now" description="When a donor accepts a request, they appear here so you can coordinate." />
                ) : (
                  scheduled.map((d) => (
                    <DonorLinkCard key={d.$id} variant="elevated" className="gap-3">
                      <View className="flex-row items-center gap-3">
                        <BloodGroupBadge group={d.bloodGroup} />
                        <View className="flex-1">
                          <DonorLinkText variant="bodyStrong">{d.donorName}</DonorLinkText>
                          <DonorLinkText variant="caption" tone="muted">
                            {d.scheduledFor ? `Expected ${formatDateTime(d.scheduledFor)}` : `Accepted ${formatRelativeTime(d.$createdAt)}`}
                          </DonorLinkText>
                        </View>
                        <DonationStatusBadge status={d.status} size="sm" />
                      </View>
                      {d.coordinationNote ? (
                        <DonorLinkText variant="bodySmall" tone="secondary">
                          Message sent: {d.coordinationNote}
                        </DonorLinkText>
                      ) : null}
                      <View className="flex-row flex-wrap gap-2">
                        <View className="min-w-[44%] flex-1">
                          <DonorLinkButton title="Confirm donated" variant="success" size="sm" leftIcon="checkmark" loading={busyId === d.$id} fullWidth onPress={() => void run(d.$id, () => donationService.confirm(d.$id), 'Donation confirmed')} />
                        </View>
                        <View className="min-w-[44%] flex-1">
                          <DonorLinkButton title="Set time / message" variant="outline" size="sm" leftIcon="calendar-outline" disabled={!!busyId} fullWidth onPress={() => { setScheduling(d); setWhen(d.scheduledFor ?? null); setNote(d.coordinationNote ?? ''); }} />
                        </View>
                      </View>
                      <View className="flex-row items-center justify-between">
                        <DonorLinkButton title="View request" variant="ghost" size="sm" onPress={() => router.push(`/org/request/${d.requestId}` as Href)} />
                        <DonorLinkButton title="Cancel" variant="ghost" size="sm" disabled={!!busyId} onPress={() => setCancelling(d)} />
                      </View>
                    </DonorLinkCard>
                  ))
                )}
              </DonorLinkSection>

              {waiting.length > 0 ? (
                <DonorLinkSection title="Waiting for an answer">
                  {waiting.map((r) => (
                    <DonorLinkCard key={r.$id} className="flex-row items-center gap-3">
                      <BloodGroupBadge group={r.donorBloodGroup} size="sm" />
                      <DonorLinkText variant="bodyStrong" className="flex-1">
                        {r.donorName}
                      </DonorLinkText>
                      <ResponseStatusBadge status={r.status} size="sm" />
                    </DonorLinkCard>
                  ))}
                </DonorLinkSection>
              ) : null}

              {completed.length > 0 ? (
                <DonorLinkSection title="Recently completed">
                  {completed.map((d) => (
                    <DonorLinkCard key={d.$id} className="flex-row items-center gap-3">
                      <BloodGroupBadge group={d.bloodGroup} size="sm" />
                      <View className="flex-1">
                        <DonorLinkText variant="bodyStrong">{d.donorName}</DonorLinkText>
                        <DonorLinkText variant="caption" tone="muted">
                          {formatDateTime(d.completedAt)}
                        </DonorLinkText>
                      </View>
                      <DonationStatusBadge status={d.status} size="sm" />
                    </DonorLinkCard>
                  ))}
                </DonorLinkSection>
              ) : null}
            </>
          )}

          <DonorLinkBottomSheet
            visible={!!scheduling}
            onClose={() => setScheduling(null)}
            title="Coordinate donation"
            footer={
              <DonorLinkButton
                title="Send to donor"
                loading={!!scheduling && busyId === scheduling.$id}
                onPress={() => {
                  if (!scheduling) return;
                  const target = scheduling;
                  void run(target.$id, () => donationService.schedule(target.$id, { scheduledFor: when ?? undefined, note: note.trim() || undefined }), 'Donor notified').then(() => setScheduling(null));
                }}
              />
            }
          >
            <DonorLinkDateTimeField label="Expected arrival" value={when} onChange={setWhen} quickOptions={[{ label: 'In 1 hour', hoursFromNow: 1 }, { label: 'In 3 hours', hoursFromNow: 3 }, { label: 'Tomorrow', hoursFromNow: 24 }]} />
            <DonorLinkInput label="Message to donor" value={note} onChangeText={setNote} multiline maxLength={300} helperText="e.g. Go to the blood bank counter, ground floor. Bring a photo ID." />
          </DonorLinkBottomSheet>

          <DonorLinkConfirmDialog
            visible={!!cancelling}
            title="Cancel this donation?"
            message="The donor is told, and the request goes back to looking for another donor."
            confirmLabel="Cancel donation"
            cancelLabel="Keep it"
            tone="danger"
            loading={!!cancelling && busyId === cancelling.$id}
            onCancel={() => setCancelling(null)}
            onConfirm={() => {
              if (!cancelling) return;
              const target = cancelling;
              void run(target.$id, () => donationService.cancel(target.$id), 'Donation cancelled').then(() => setCancelling(null));
            }}
          />
        </>
      )}
    </OrgScreen>
  );
}
