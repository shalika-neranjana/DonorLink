import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useState } from 'react';
import { View } from 'react-native';

import { BloodGroupBadge } from '@/components/blood/BloodGroupBadge';
import { VerificationBadge } from '@/components/common/StatusBadges';
import { DonorLinkAvatar } from '@/components/ui/DonorLinkAvatar';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkConfirmDialog } from '@/components/ui/DonorLinkModal';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkListGroup, DonorLinkListRow, DonorLinkSection } from '@/components/ui/DonorLinkSection';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { useAvatarUri } from '@/hooks/useAvatarUri';
import { useAuth } from '@/providers/AuthProvider';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, donorProfile, emailVerified, isAdmin, isOrganizationMember, signOut } = useAuth();
  const avatar = useAvatarUri(profile?.avatarFileId);
  const [confirmOut, setConfirmOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function logout() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  const verification = profile?.verificationStatus ?? 'not_submitted';

  return (
    <DonorLinkScreen inTabs header={{ title: 'Profile', onBack: false, size: 'large' }}>
      <DonorLinkCard variant="elevated" className="items-center gap-3">
        <DonorLinkAvatar name={profile?.displayName ?? user?.name} uri={avatar} size="xl" />
        <View className="items-center gap-1">
          <DonorLinkText variant="heading">{profile?.displayName ?? user?.name}</DonorLinkText>
          <DonorLinkText variant="bodySmall" tone="secondary">
            {user?.email}
          </DonorLinkText>
        </View>
        <View className="flex-row flex-wrap items-center justify-center gap-2">
          <VerificationBadge status={verification} label={verification === 'verified' ? 'Identity verified' : undefined} />
          {profile?.bloodGroup ? <BloodGroupBadge group={profile.bloodGroup} size="sm" /> : null}
        </View>
        <View className="mt-1 w-full flex-row gap-3">
          <View className="flex-1 items-center rounded-md bg-subtle py-2.5">
            <DonorLinkText variant="heading">{donorProfile?.donationCount ?? 0}</DonorLinkText>
            <DonorLinkText variant="caption" tone="muted">
              Donations
            </DonorLinkText>
          </View>
          <View className="flex-1 items-center rounded-md bg-subtle py-2.5">
            <DonorLinkText variant="bodyStrong">{profile?.district ?? 'Not set'}</DonorLinkText>
            <DonorLinkText variant="caption" tone="muted">
              Area
            </DonorLinkText>
          </View>
        </View>
        <DonorLinkButton title="Edit profile" variant="outline" size="sm" leftIcon="create-outline" onPress={() => router.push('/settings/profile')} />
      </DonorLinkCard>

      {!emailVerified ? (
        <DonorLinkBanner tone="warning" title="Verify your email" message="Confirm your email to secure your account and enable document verification." actionLabel="Verify now" onAction={() => router.push('/verification/email')} />
      ) : null}

      <DonorLinkSection title="Trust & verification">
        <DonorLinkListGroup>
          <DonorLinkListRow icon="shield-checkmark" title="Verification" subtitle="Identity and donor status" trailing={<VerificationBadge status={verification} size="sm" />} onPress={() => router.push('/verification')} />
          <DonorLinkListRow icon="mail" title="Email" value={emailVerified ? 'Verified' : 'Not verified'} onPress={() => router.push('/verification/email')} last />
        </DonorLinkListGroup>
      </DonorLinkSection>

      <DonorLinkSection title="Activity">
        <DonorLinkListGroup>
          <DonorLinkListRow icon="heart" title="Donor availability" onPress={() => router.push('/donor/availability')} />
          <DonorLinkListRow icon="time" title="Request & donation history" onPress={() => router.push('/history')} />
          <DonorLinkListRow icon="medkit" title="Hospitals & blood banks" onPress={() => router.push('/hospitals')} last />
        </DonorLinkListGroup>
      </DonorLinkSection>

      <DonorLinkSection title="Settings">
        <DonorLinkListGroup>
          <DonorLinkListRow icon="notifications" title="Notification settings" onPress={() => router.push('/settings/notifications')} />
          <DonorLinkListRow icon="eye-off" title="Privacy" onPress={() => router.push('/settings/privacy')} />
          <DonorLinkListRow icon="lock-closed" title="Security" onPress={() => router.push('/settings/security')} />
          <DonorLinkListRow icon="help-buoy" title="Support & FAQ" onPress={() => router.push('/support')} last />
        </DonorLinkListGroup>
      </DonorLinkSection>

      <DonorLinkSection title="Workspaces">
        <DonorLinkListGroup>
          {isOrganizationMember ? <DonorLinkListRow icon="business" title="Organization workspace" subtitle="Requests, inventory and donors" onPress={() => router.push('/org/dashboard')} /> : null}
          {isAdmin ? <DonorLinkListRow icon="shield" title="Admin console" subtitle="Users, verification and audit" onPress={() => router.push('/admin/dashboard')} /> : null}
          {!isOrganizationMember ? <DonorLinkListRow icon="add-circle" title="Register an organization" subtitle="Hospitals and blood banks" onPress={() => router.push('/verification/details?subject=organization')} /> : null}
          <DonorLinkListRow icon="log-out" title="Sign out" destructive showChevron={false} onPress={() => setConfirmOut(true)} last />
        </DonorLinkListGroup>
      </DonorLinkSection>

      <DonorLinkText variant="caption" tone="muted" align="center">
        DonorLink {Constants.expoConfig?.version ?? '1.0.0'} · IT3060 HCI · Y3S2.IT.WE_02
      </DonorLinkText>

      <DonorLinkConfirmDialog
        visible={confirmOut}
        title="Sign out?"
        message="You'll stop receiving alerts on this device until you sign in again."
        confirmLabel="Sign out"
        tone="danger"
        loading={signingOut}
        onCancel={() => setConfirmOut(false)}
        onConfirm={() => void logout()}
      />
    </DonorLinkScreen>
  );
}
