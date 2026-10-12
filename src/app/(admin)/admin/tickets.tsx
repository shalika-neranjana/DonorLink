import { useState } from 'react';
import { View } from 'react-native';

import { DonorLinkBadge } from '@/components/ui/DonorLinkBadge';
import { DonorLinkBottomSheet } from '@/components/ui/DonorLinkBottomSheet';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { DonorLinkSegmentedControl } from '@/components/ui/DonorLinkPickers';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkConfirmDialog } from '@/components/ui/DonorLinkModal';
import { DonorLinkBanner, DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import type { SupportStatus } from '@/domain';
import { useResource } from '@/hooks/useResource';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { formatRelativeTime } from '@/lib/format';
import { adminService } from '@/services/adminService';
import type { SupportTicket } from '@/types/entities';

export default function AdminTicketsScreen() {
  const toast = useToast();
  const [tab, setTab] = useState<SupportStatus | 'all'>('open');
  const { data, error, loading, refreshing, reload } = useResource(() => adminService.listTickets(tab), [tab], { reloadOnFocus: true });
  const [replying, setReplying] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState('');
  const [replyError, setReplyError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<SupportTicket | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function send() {
    if (!replying) return;
    if (!reply.trim()) {
      setReplyError('Write a reply first.');
      return;
    }
    setBusy(true);
    try {
      await adminService.replyToTicket(replying.$id, reply.trim());
      toast.success('Reply sent');
      setReplying(null);
      setReply('');
      await reload();
    } catch (e) {
      setReplyError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await adminService.deleteTicket(deleting.$id);
      toast.success('Ticket deleted');
      setDeleting(null);
      await reload();
    } catch (e) {
      setDeleting(null);
      toast.error("We couldn't delete that ticket", getErrorMessage(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <DonorLinkScreen refreshing={refreshing} onRefresh={() => void reload()} header={{ title: 'Support tickets' }}>
      <DonorLinkSegmentedControl value={tab} onChange={setTab} options={[{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Answered' }, { value: 'all', label: 'All' }]} />
      {loading ? (
        <DonorLinkListSkeleton />
      ) : error && !data ? (
        <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
      ) : (data ?? []).length === 0 ? (
        <DonorLinkEmptyState icon="chatbubbles-outline" title="No tickets here" description="You're all caught up." />
      ) : (
        <View className="gap-3">
          {data!.map((t) => (
            <DonorLinkCard key={t.$id} variant="elevated" className="gap-2">
              <View className="flex-row items-center justify-between gap-2">
                <DonorLinkText variant="bodyStrong" className="flex-1">
                  {t.subject}
                </DonorLinkText>
                <DonorLinkBadge label={t.category} tone="neutral" size="sm" />
              </View>
              <DonorLinkText variant="body" tone="secondary">
                {t.message}
              </DonorLinkText>
              <DonorLinkText variant="caption" tone="muted">
                {formatRelativeTime(t.$createdAt)}
              </DonorLinkText>
              {t.reply ? <DonorLinkBanner tone="success" title="Replied" message={t.reply} /> : null}
              <View className="flex-row gap-2">
                <DonorLinkButton title={t.reply ? 'Edit reply' : 'Reply'} variant="outline" size="sm" leftIcon="chatbubble-ellipses-outline" onPress={() => { setReplying(t); setReply(t.reply ?? ''); setReplyError(undefined); }} />
                <DonorLinkButton title="Delete" variant="outline" size="sm" leftIcon="trash-outline" onPress={() => setDeleting(t)} />
              </View>
            </DonorLinkCard>
          ))}
        </View>
      )}
      <DonorLinkBottomSheet visible={!!replying} onClose={() => setReplying(null)} title={replying?.reply ? 'Edit reply' : 'Reply to ticket'} footer={<DonorLinkButton title="Send reply" loading={busy} onPress={() => void send()} />}>
        <DonorLinkText variant="bodyStrong">{replying?.subject}</DonorLinkText>
        <DonorLinkInput label="Your reply" value={reply} onChangeText={(v) => { setReply(v); setReplyError(undefined); }} error={replyError} multiline maxLength={1000} />
      </DonorLinkBottomSheet>
      <DonorLinkConfirmDialog
        visible={!!deleting}
        title="Delete this ticket?"
        message="The ticket is removed for the user too. This can't be undone."
        confirmLabel="Delete ticket"
        cancelLabel="Keep it"
        tone="danger"
        loading={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </DonorLinkScreen>
  );
}
