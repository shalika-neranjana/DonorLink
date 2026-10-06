import { useRouter, type Href } from 'expo-router';
import { View } from 'react-native';

import { VerificationBadge } from '@/components/common/StatusBadges';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkIcon, type IconName } from '@/components/ui/DonorLinkIcon';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkBanner, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import type { VerificationStatus, VerificationSubject } from '@/domain';
import { useResource } from '@/hooks/useResource';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { latestFor, verificationService } from '@/services/verificationService';

function actionLabel(status: VerificationStatus): string | null {
  switch (status) {
    case 'not_submitted':
      return 'Start verification';
    case 'needs_attention':
    case 'rejected':
      return 'Submit again';
    default:
      return null;
  }
}

/** Verification Center: one place to see and complete every kind of verification. */
export default function VerificationScreen() {
  const router = useRouter();
  const { user, profile, donorProfile, emailVerified, isOrganizationMember } = useAuth();
  const { data, error, loading, refreshing, reload } = useResource(() => verificationService.listMine(user!.$id), [user?.$id], { enabled: !!user, reloadOnFocus: true });

  const items: { subject: VerificationSubject; icon: IconName; title: string; body: string; status: VerificationStatus }[] = [
    { subject: 'user', icon: 'id-card', title: 'Identity', body: 'Confirms you are who you say you are. Shown to others as a verified badge.', status: profile?.verificationStatus ?? 'not_submitted' },
    ...(profile?.isDonor
      ? [{ subject: 'donor' as const, icon: 'heart' as const, title: 'Donor status', body: 'Optional proof such as a donor card. Verified donors are contacted first.', status: donorProfile?.verificationStatus ?? 'not_submitted' }]
      : []),
    ...(!isOrganizationMember
      ? [{ subject: 'organization' as const, icon: 'business' as const, title: 'Organization', body: 'Register a hospital, blood bank or donation centre.', status: (latestFor(data ?? [], 'organization')?.status ?? 'not_submitted') as VerificationStatus }]
      : []),
  ];

  return (
    <DonorLinkScreen refreshing={refreshing} onRefresh={() => void reload()} header={{ title: 'Verification', subtitle: 'Build trust with donors and hospitals' }}>
      <DonorLinkBanner tone="neutral" title="What verification means" message="A reviewer checks the documents you upload. It confirms identity or organization details, not medical eligibility to donate." />

      <DonorLinkCard className="gap-2">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-md bg-subtle">
            <DonorLinkIcon name="mail" size={20} color="primary" />
          </View>
          <View className="flex-1">
            <DonorLinkText variant="bodyStrong">Email address</DonorLinkText>
            <DonorLinkText variant="bodySmall" tone="secondary">
              {user?.email}
            </DonorLinkText>
          </View>
          <VerificationBadge status={emailVerified ? 'verified' : 'not_submitted'} size="sm" label={emailVerified ? 'Verified' : 'Not verified'} />
        </View>
        {!emailVerified ? <DonorLinkButton title="Verify email" variant="outline" size="sm" onPress={() => router.push('/verification/email')} /> : null}
      </DonorLinkCard>

      {loading ? (
        <DonorLinkListSkeleton count={2} />
      ) : error && !data ? (
        <DonorLinkErrorState message={error.message} onRetry={() => void reload()} compact />
      ) : (
        items.map((item) => {
          const latest = latestFor(data ?? [], item.subject);
          const action = actionLabel(item.status);
          return (
            <DonorLinkCard key={item.subject} variant="elevated" className="gap-3">
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-md bg-primary-soft">
                  <DonorLinkIcon name={item.icon} size={20} color="primary" />
                </View>
                <View className="flex-1">
                  <DonorLinkText variant="bodyStrong">{item.title}</DonorLinkText>
                </View>
                <VerificationBadge status={item.status} size="sm" />
              </View>
              <DonorLinkText variant="bodySmall" tone="secondary">
                {item.body}
              </DonorLinkText>
              {latest?.reviewerNote && (item.status === 'needs_attention' || item.status === 'rejected') ? (
                <DonorLinkBanner tone={item.status === 'rejected' ? 'error' : 'warning'} title="Reviewer's note" message={latest.reviewerNote} />
              ) : null}
              {latest?.reviewedAt && item.status === 'verified' ? (
                <DonorLinkText variant="caption" tone="muted">
                  Verified on {formatDate(latest.reviewedAt)}
                </DonorLinkText>
              ) : null}
              {item.status === 'pending' ? (
                <DonorLinkText variant="caption" tone="muted">
                  Submitted {latest ? formatDate(latest.$createdAt) : ''}. Reviews usually take a day or two.
                </DonorLinkText>
              ) : null}
              {action ? <DonorLinkButton title={action} onPress={() => router.push(`/verification/details?subject=${item.subject}` as Href)} /> : null}
            </DonorLinkCard>
          );
        })
      )}
    </DonorLinkScreen>
  );
}
