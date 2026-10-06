import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { DonorLinkAvatar } from '@/components/ui/DonorLinkAvatar';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { BloodGroupPicker, DonorLinkSelect } from '@/components/ui/DonorLinkPickers';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { DISTRICT_NAMES, validateProfile } from '@/domain';
import { useAvatarUri } from '@/hooks/useAvatarUri';
import { useFormState } from '@/hooks/useFormState';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { BUCKETS } from '@/lib/appwrite/config';
import { deleteFile, uploadPrivateFile, validatePickedFile } from '@/lib/appwrite/files';
import { authApi } from '@/lib/appwrite/auth';
import { useAuth } from '@/providers/AuthProvider';
import { profileService } from '@/services/profileService';

const DISTRICT_OPTIONS = DISTRICT_NAMES.map((name) => ({ value: name, label: name }));

export default function EditProfileScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user, profile, setProfile, refreshDonorProfile, refreshUser } = useAuth();
  const avatar = useAvatarUri(profile?.avatarFileId);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoProgress, setPhotoProgress] = useState<number | null>(null);
  const { values, errors, setValue, setErrors } = useFormState({
    displayName: profile?.displayName ?? user?.name ?? '',
    phone: profile?.phone ?? '',
    bloodGroup: profile?.bloodGroup ?? null,
    district: profile?.district ?? '',
    city: profile?.city ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.warning('Photo access is off', 'Allow photo access in your device settings to add a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const file = { uri: asset.uri, name: asset.fileName ?? 'profile.jpg', mimeType: asset.mimeType ?? 'image/jpeg', size: asset.fileSize ?? 0 };
    const problem = validatePickedFile(BUCKETS.avatars, file.size ? file : { ...file, size: 1 });
    if (problem) {
      toast.error("That photo can't be used", problem);
      return;
    }
    setPhotoUri(asset.uri);
    setPhotoProgress(0);
    try {
      const oldId = profile?.avatarFileId;
      const fileId = await uploadPrivateFile(BUCKETS.avatars, user!.$id, { ...file, size: file.size || 1 }, setPhotoProgress);
      const { profile: saved } = await profileService.saveProfile({ displayName: profile?.displayName ?? values.displayName }, { avatarFileId: fileId });
      setProfile(saved);
      if (oldId) void deleteFile(BUCKETS.avatars, oldId).catch(() => undefined);
      toast.success('Profile photo updated');
    } catch (e) {
      setPhotoUri(null);
      toast.error("We couldn't upload your photo", getErrorMessage(e));
    } finally {
      setPhotoProgress(null);
    }
  }

  async function save() {
    if (saving) return;
    setFormError(null);
    const result = validateProfile({ ...values, isDonor: profile?.isDonor });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSaving(true);
    try {
      const { profile: saved } = await profileService.saveProfile({
        displayName: result.value.displayName,
        phone: result.value.phone ?? '',
        bloodGroup: result.value.bloodGroup,
        district: result.value.district ?? '',
        city: result.value.city ?? '',
        isDonor: profile?.isDonor && !!result.value.bloodGroup,
      });
      if (user && saved.displayName !== user.name) await authApi.updateName(saved.displayName).catch(() => undefined);
      setProfile(saved);
      await Promise.all([refreshDonorProfile(), refreshUser()]);
      toast.success('Profile updated');
      router.back();
    } catch (e) {
      setFormError(getErrorMessage(e, "We couldn't save your profile."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DonorLinkScreen header={{ title: 'Edit profile' }} footer={<DonorLinkButton title="Save changes" size="lg" fullWidth loading={saving} onPress={() => void save()} />}>
      {formError ? <DonorLinkBanner tone="error" message={formError} /> : null}

      <View className="items-center gap-2">
        <DonorLinkAvatar name={values.displayName} uri={photoUri ?? avatar} size="xl" />
        <DonorLinkButton title={photoProgress !== null ? `Uploading ${photoProgress}%` : 'Change photo'} variant="outline" size="sm" leftIcon="camera-outline" loading={photoProgress !== null} onPress={() => void pickPhoto()} />
        <DonorLinkText variant="caption" tone="muted" align="center">
          Your photo is private: only you and DonorLink reviewers can see it.
        </DonorLinkText>
      </View>

      <DonorLinkInput label="Full name" required value={values.displayName} onChangeText={(v) => setValue('displayName', v)} error={errors.displayName} leftIcon="person-outline" autoCapitalize="words" />
      <DonorLinkInput label="Mobile number" value={values.phone} onChangeText={(v) => setValue('phone', v)} error={errors.phone} leftIcon="call-outline" keyboardType="phone-pad" helperText="Never shown to other users." />
      <BloodGroupPicker value={values.bloodGroup} onChange={(g) => setValue('bloodGroup', g)} error={errors.bloodGroup} helperText="Self-reported. Changing it re-evaluates which requests match you." />
      <DonorLinkSelect label="District" value={values.district} options={DISTRICT_OPTIONS} onChange={(d) => setValue('district', d)} searchable error={errors.district} />
      <DonorLinkInput label="Town or area" value={values.city} onChangeText={(v) => setValue('city', v)} leftIcon="location-outline" autoCapitalize="words" />
    </DonorLinkScreen>
  );
}
