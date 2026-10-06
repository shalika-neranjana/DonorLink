import { useState } from 'react';
import { View } from 'react-native';

import { DocumentPreview } from '@/components/common/DocumentPreview';
import { Divider, InfoRow } from '@/components/common/InfoRow';
import { VerificationBadge } from '@/components/common/StatusBadges';
import { DonorLinkBadge } from '@/components/ui/DonorLinkBadge';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { DonorLinkConfirmDialog } from '@/components/ui/DonorLinkModal';
import { DonorLinkSegmentedControl } from '@/components/ui/DonorLinkPickers';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { VERIFICATION_DOCUMENT_LABELS, type VerificationStatus } from '@/domain';
import { useResource } from '@/hooks/useResource';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { formatDateTime } from '@/lib/format';
import { verificationService } from '@/services/verificationService';
import type { Verification } from '@/types/entities';

type Decision = Extract<VerificationStatus, 'verified' | 'rejected' | 'needs_attention'>;

function organizationSummary(payload?: string | null): string | null {
  if (!payload) return null;
  try {
    const p = JSON.parse(payload) as { name?: string; type?: string; district?: string; claimOrganizationId?: string };
    return `${p.name ?? 'Organization'} · ${p.type?.replace('_', ' ') ?? ''} · ${p.district ?? ''}${p.claimOrganizationId ? ' · claims a directory listing' : ''}`;
  } catch {
    return null;
  }
}

/** Verification review queue (users, donors, organizations). */
export default function AdminVerificationScreen() {
  const toast = useToast();
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const { data, error, loading, refreshing, reload } = useResource(() => verificationService.listForReview(tab === 'pending' ? 'pending' : 'all'), [tab], { reloadOnFocus: true });
  const [deciding, setDeciding] = useState<{ item: Verification; decision: Decision } | null>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!deciding) return;
    if (deciding.decision !== 'verified' && !note.trim()) {
      setNoteError('Add a short note so the user knows what to fix.');
      return;
    }
    setBusy(true);
    try {
      await verificationService.review(deciding.item.$id, deciding.decision, note.trim() || undefined);
      toast.success(deciding.decision === 'verified' ? 'Verified' : deciding.decision === 'rejected' ? 'Rejected' : 'Sent back for changes', 'The user was notified.');
      setDeciding(null);
      setNote('');
      await reload();
    } catch (e) {
      toast.error("We couldn't record that decision", getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DonorLinkScreen inTabs refreshing={refreshing} onRefresh={() => void reload()} header={{ title: 'Verification', onBack: false, size: 'large' }}>
      <DonorLinkSegmentedControl value={tab} onChange={setTab} options={[{ value: 'pending', label: 'Pending' }, { value: 'all', label: 'All submissions' }]} />
      {loading ? (
        <DonorLinkListSkeleton />
      ) : error && !data ? (
        <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
      ) : (data ?? []).length === 0 ? (
        <DonorLinkEmptyState icon="shield-checkmark-outline" title="Nothing to review" description="New submissions appear here." />
      ) : (
        data!.map((v) => (
          <DonorLinkCard key={v.$id} variant="elevated" className="gap-3">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <DonorLinkText variant="title">{v.displayName}</DonorLinkText>
                <DonorLinkText variant="caption" tone="muted">
                  Submitted {formatDateTime(v.$createdAt)}
                </DonorLinkText>
              </View>
              <VerificationBadge status={v.status} size="sm" />
            </View>
            <View className="flex-row flex-wrap gap-1.5">
              <DonorLinkBadge label={v.subjectType === 'user' ? 'Identity' : v.subjectType === 'donor' ? 'Donor' : 'Organization'} tone="primary" size="sm" />
              {v.documentType ? <DonorLinkBadge label={VERIFICATION_DOCUMENT_LABELS[v.documentType]} tone="neutral" size="sm" icon="document-text-outline" /> : null}
            </View>
            {v.subjectType === 'organization' && organizationSummary(v.payload) ? <InfoRow icon="business-outline" label="Organization details" value={organizationSummary(v.payload)} /> : null}
            {v.note ? <InfoRow icon="chatbubble-outline" label="Note from the user" value={v.note} /> : null}
            {v.reviewerNote ? <InfoRow icon="create-outline" label="Reviewer note" value={v.reviewerNote} /> : null}
            <Divider />
            <DocumentPreview fileIds={v.documentFileIds ?? []} />
            {v.status === 'pending' ? (
              <View className="gap-2">
                <DonorLinkButton title="Approve" variant="success" leftIcon="checkmark" fullWidth onPress={() => setDeciding({ item: v, decision: 'verified' })} />
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <DonorLinkButton title="Needs changes" variant="outline" size="sm" fullWidth onPress={() => setDeciding({ item: v, decision: 'needs_attention' })} />
                  </View>
                  <View className="flex-1">
                    <DonorLinkButton title="Reject" variant="danger" size="sm" fullWidth onPress={() => setDeciding({ item: v, decision: 'rejected' })} />
                  </View>
                </View>
              </View>
            ) : null}
          </DonorLinkCard>
        ))
      )}

      <DonorLinkConfirmDialog
        visible={!!deciding}
        title={deciding?.decision === 'verified' ? 'Approve this verification?' : deciding?.decision === 'rejected' ? 'Reject this verification?' : 'Ask for changes?'}
        message={deciding?.item.subjectType === 'organization' && deciding.decision === 'verified' ? 'This creates the organization, makes the submitter its admin, and unlocks the organization workspace for them.' : 'The user is notified of your decision. This is recorded in the audit log.'}
        confirmLabel={deciding?.decision === 'verified' ? 'Approve' : deciding?.decision === 'rejected' ? 'Reject' : 'Send back'}
        tone={deciding?.decision === 'rejected' ? 'danger' : deciding?.decision === 'verified' ? 'success' : 'primary'}
        loading={busy}
        onCancel={() => { setDeciding(null); setNote(''); setNoteError(undefined); }}
        onConfirm={() => void submit()}
      >
        <DonorLinkInput label={deciding?.decision === 'verified' ? 'Note (optional)' : 'Note for the user'} required={deciding?.decision !== 'verified'} value={note} onChangeText={(v) => { setNote(v); setNoteError(undefined); }} error={noteError} maxLength={300} />
      </DonorLinkConfirmDialog>
    </DonorLinkScreen>
  );
}
