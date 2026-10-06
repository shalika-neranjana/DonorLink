import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Divider, InfoRow } from '@/components/common/InfoRow';
import { VerificationBadge } from '@/components/common/StatusBadges';
import { DonorLinkBadge } from '@/components/ui/DonorLinkBadge';
import { DonorLinkBottomSheet } from '@/components/ui/DonorLinkBottomSheet';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { DonorLinkConfirmDialog } from '@/components/ui/DonorLinkModal';
import { DonorLinkChip } from '@/components/ui/DonorLinkPickers';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { DonorLinkSection } from '@/components/ui/DonorLinkSection';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { ORGANIZATION_MEMBER_ROLES, ORGANIZATION_TYPE_LABELS, isValidPhone, type OrganizationMemberRole } from '@/domain';
import { OrgScreen } from '@/features/organization/OrgScreen';
import { useOrganization } from '@/features/organization/OrganizationContext';
import { useResource } from '@/hooks/useResource';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { useAuth } from '@/providers/AuthProvider';
import { organizationService } from '@/services/organizationService';
import type { OrganizationMember } from '@/types/entities';

export default function OrgProfileScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user, refreshUser } = useAuth();
  const { organization, isOrgAdmin, reload: reloadOrg } = useOrganization();
  const members = useResource(() => organizationService.listMembers(organization!.$id), [organization?.$id], { enabled: !!organization, reloadOnFocus: true });

  const [editOpen, setEditOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [editError, setEditError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrganizationMemberRole>('staff');
  const [inviteError, setInviteError] = useState<string | undefined>();
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<OrganizationMember | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  async function saveProfile() {
    if (!organization) return;
    if (phone.trim() && !isValidPhone(phone)) {
      setEditError('Enter a valid phone number.');
      return;
    }
    setSaving(true);
    try {
      await organizationService.updateProfile(organization.$id, { phone: phone.trim() || undefined, address: address.trim() });
      toast.success('Organization updated');
      setEditOpen(false);
      await reloadOrg();
    } catch (e) {
      setEditError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function invite() {
    if (!organization) return;
    setInviting(true);
    setInviteError(undefined);
    try {
      await organizationService.addMember(organization.$id, email.trim(), role);
      toast.success('Member added', 'They can open the organization workspace the next time they sign in.');
      setInviteOpen(false);
      setEmail('');
      await members.reload();
    } catch (e) {
      setInviteError(getErrorMessage(e));
    } finally {
      setInviting(false);
    }
  }

  async function remove() {
    if (!organization || !removing) return;
    setRemoveBusy(true);
    try {
      await organizationService.removeMember(organization.$id, removing.userId);
      toast.success('Member removed');
      setRemoving(null);
      await members.reload();
      if (removing.userId === user?.$id) await refreshUser();
    } catch (e) {
      toast.error("We couldn't remove that member", getErrorMessage(e));
    } finally {
      setRemoveBusy(false);
    }
  }

  return (
    <OrgScreen title="Organization" actions={[{ icon: 'home-outline', label: 'Back to personal app', onPress: () => router.replace('/') }]}>
      {(org) => (
        <>
          <DonorLinkCard variant="elevated" className="gap-3">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <DonorLinkText variant="title">{org.name}</DonorLinkText>
                <DonorLinkText variant="bodySmall" tone="secondary">
                  {ORGANIZATION_TYPE_LABELS[org.type]}
                </DonorLinkText>
              </View>
              <VerificationBadge status={org.verificationStatus} />
            </View>
            <Divider />
            <InfoRow icon="location-outline" label="Location" value={[org.address, org.city, org.district].filter(Boolean).join(', ')} />
            <InfoRow icon="call-outline" label="Contact phone" value={org.phone ?? 'Not set'} />
            {org.registrationNumber ? <InfoRow icon="reader-outline" label="Registration" value={org.registrationNumber} /> : null}
            {isOrgAdmin ? <DonorLinkButton title="Edit contact details" variant="outline" size="sm" leftIcon="create-outline" onPress={() => { setPhone(org.phone ?? ''); setAddress(org.address ?? ''); setEditError(undefined); setEditOpen(true); }} /> : null}
          </DonorLinkCard>

          {org.verificationStatus !== 'verified' ? <DonorLinkBanner tone="warning" title="Verification pending" message="An administrator reviews organization registrations. You will be notified when it is complete." /> : null}

          <DonorLinkSection title="Team" description="People who can manage requests and donors for this organization" actionLabel={isOrgAdmin ? 'Add member' : undefined} onAction={() => { setInviteError(undefined); setInviteOpen(true); }}>
            {(members.data ?? []).map((m) => (
              <DonorLinkCard key={m.$id} className="flex-row items-center gap-3 py-3">
                <View className="flex-1">
                  <DonorLinkText variant="bodyStrong">
                    {m.displayName}
                    {m.userId === user?.$id ? ' (you)' : ''}
                  </DonorLinkText>
                </View>
                <DonorLinkBadge label={m.role === 'admin' ? 'Admin' : m.role === 'coordinator' ? 'Coordinator' : 'Staff'} tone={m.role === 'admin' ? 'primary' : 'neutral'} size="sm" />
                {isOrgAdmin && m.userId !== user?.$id ? <DonorLinkButton title="Remove" variant="ghost" size="sm" onPress={() => setRemoving(m)} /> : null}
              </DonorLinkCard>
            ))}
          </DonorLinkSection>

          <DonorLinkBottomSheet visible={editOpen} onClose={() => setEditOpen(false)} title="Contact details" footer={<DonorLinkButton title="Save" loading={saving} onPress={() => void saveProfile()} />}>
            {editError ? <DonorLinkBanner tone="error" message={editError} /> : null}
            <DonorLinkInput label="Contact phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" leftIcon="call-outline" />
            <DonorLinkInput label="Address" value={address} onChangeText={setAddress} leftIcon="location-outline" maxLength={200} />
          </DonorLinkBottomSheet>

          <DonorLinkBottomSheet visible={inviteOpen} onClose={() => setInviteOpen(false)} title="Add a team member" footer={<DonorLinkButton title="Add member" loading={inviting} onPress={() => void invite()} />}>
            {inviteError ? <DonorLinkBanner tone="error" message={inviteError} /> : null}
            <DonorLinkInput label="Their DonorLink email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" leftIcon="mail-outline" helperText="They must already have a DonorLink account." />
            <View className="flex-row flex-wrap gap-2">
              {ORGANIZATION_MEMBER_ROLES.map((r) => (
                <DonorLinkChip key={r} label={r === 'admin' ? 'Admin' : r === 'coordinator' ? 'Coordinator' : 'Staff'} selected={role === r} onPress={() => setRole(r)} />
              ))}
            </View>
          </DonorLinkBottomSheet>

          <DonorLinkConfirmDialog visible={!!removing} title="Remove this member?" message={`${removing?.displayName ?? 'They'} will lose access to this organization's workspace.`} confirmLabel="Remove" tone="danger" loading={removeBusy} onCancel={() => setRemoving(null)} onConfirm={() => void remove()} />
        </>
      )}
    </OrgScreen>
  );
}
