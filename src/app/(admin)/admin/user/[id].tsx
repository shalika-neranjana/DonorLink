import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Divider, InfoRow } from '@/components/common/InfoRow';
import { VerificationBadge } from '@/components/common/StatusBadges';
import { DonorLinkAvatar } from '@/components/ui/DonorLinkAvatar';
import { DonorLinkBadge } from '@/components/ui/DonorLinkBadge';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkConfirmDialog } from '@/components/ui/DonorLinkModal';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkSection } from '@/components/ui/DonorLinkSection';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { isAdmin, isOrganizationMember } from '@/domain';
import { useResource } from '@/hooks/useResource';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { adminService } from '@/services/adminService';

export default function AdminUserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user: me } = useAuth();
  const { data, error, loading, reload } = useResource(() => adminService.getUser(id!), [id], { enabled: !!id });
  const [confirm, setConfirm] = useState<'admin' | 'status' | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply() {
    if (!data) return;
    setBusy(true);
    try {
      if (confirm === 'admin') {
        const makeAdmin = !isAdmin(data.user.labels);
        await adminService.setAdminRole(data.user.id, makeAdmin);
        toast.success(makeAdmin ? 'Admin access granted' : 'Admin access removed');
      } else {
        await adminService.setUserStatus(data.user.id, !data.user.enabled);
        toast.success(data.user.enabled ? 'Account disabled' : 'Account enabled');
      }
      setConfirm(null);
      await reload();
    } catch (e) {
      toast.error("That didn't work", getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <DonorLinkScreen header={{ title: 'User' }}><DonorLinkListSkeleton count={2} /></DonorLinkScreen>;
  if (error && !data) return <DonorLinkScreen header={{ title: 'User' }}><DonorLinkErrorState message={error.message} onRetry={() => void reload()} /></DonorLinkScreen>;
  if (!data) return <DonorLinkScreen header={{ title: 'User' }}><DonorLinkEmptyState icon="person-outline" title="User not found" actionLabel="Back" onAction={() => router.back()} /></DonorLinkScreen>;

  const u = data.user;
  const self = u.id === me?.$id;
  const admin = isAdmin(u.labels);

  return (
    <DonorLinkScreen header={{ title: u.name || 'User' }}>
      <DonorLinkCard variant="elevated" className="gap-3">
        <View className="flex-row items-center gap-3">
          <DonorLinkAvatar name={u.name} size="lg" />
          <View className="flex-1 gap-1">
            <DonorLinkText variant="title">{u.name}</DonorLinkText>
            <DonorLinkText variant="bodySmall" tone="secondary">
              {u.email}
            </DonorLinkText>
            <View className="flex-row flex-wrap gap-1">
              {admin ? <DonorLinkBadge label="Admin" tone="primary" size="sm" icon="shield" /> : null}
              {isOrganizationMember(u.labels) ? <DonorLinkBadge label="Organization" tone="info" size="sm" icon="business" /> : null}
              {!u.enabled ? <DonorLinkBadge label="Disabled" tone="error" size="sm" icon="ban" /> : null}
            </View>
          </View>
        </View>
        <Divider />
        <InfoRow icon="calendar-outline" label="Registered" value={formatDate(u.registeredAt)} />
        <InfoRow icon="mail-outline" label="Email" value={u.emailVerified ? 'Verified' : 'Not verified'} />
        {data.profile ? (
          <>
            <InfoRow icon="water-outline" label="Blood group (self-reported)" value={data.profile.bloodGroup ?? 'Not set'} />
            <InfoRow icon="location-outline" label="District" value={data.profile.district ?? 'Not set'} />
            <InfoRow icon="shield-checkmark-outline" label="Identity verification">
              <VerificationBadge status={data.profile.verificationStatus} size="sm" />
            </InfoRow>
          </>
        ) : (
          <DonorLinkText variant="bodySmall" tone="muted">
            This user has not completed onboarding.
          </DonorLinkText>
        )}
        <InfoRow icon="water" label="Requests created" value={String(data.counts.requests)} />
        <InfoRow icon="heart" label="Donations" value={String(data.counts.donations)} />
        {data.donor ? <InfoRow icon="pulse-outline" label="Donor availability" value={data.donor.availability.replace(/_/g, ' ')} /> : null}
      </DonorLinkCard>

      {data.verifications.length > 0 ? (
        <DonorLinkSection title="Verification history">
          {data.verifications.map((v) => (
            <DonorLinkCard key={v.$id} className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <DonorLinkText variant="bodyStrong">{v.subjectType}</DonorLinkText>
                <DonorLinkText variant="caption" tone="muted">
                  {formatDate(v.$createdAt)}
                </DonorLinkText>
              </View>
              <VerificationBadge status={v.status} size="sm" />
            </DonorLinkCard>
          ))}
        </DonorLinkSection>
      ) : null}

      <DonorLinkSection title="Administration">
        <View className="gap-2">
          <DonorLinkButton title={admin ? 'Remove admin access' : 'Make administrator'} variant="outline" leftIcon="shield" disabled={self} onPress={() => setConfirm('admin')} />
          <DonorLinkButton title={u.enabled ? 'Disable account' : 'Enable account'} variant={u.enabled ? 'danger' : 'success'} leftIcon={u.enabled ? 'ban' : 'checkmark-circle'} disabled={self} onPress={() => setConfirm('status')} />
          {self ? (
            <DonorLinkText variant="caption" tone="muted">
              You can&apos;t change your own admin access or status.
            </DonorLinkText>
          ) : null}
        </View>
      </DonorLinkSection>

      <DonorLinkConfirmDialog
        visible={confirm !== null}
        title={confirm === 'admin' ? (admin ? 'Remove admin access?' : 'Grant admin access?') : u.enabled ? 'Disable this account?' : 'Enable this account?'}
        message={confirm === 'admin' ? 'Administrators can see all requests and verification documents. This is recorded in the audit log.' : u.enabled ? 'They will be signed out and unable to use DonorLink until re-enabled.' : 'They will be able to sign in again.'}
        confirmLabel="Confirm"
        tone={confirm === 'status' && u.enabled ? 'danger' : 'primary'}
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void apply()}
      />
    </DonorLinkScreen>
  );
}
