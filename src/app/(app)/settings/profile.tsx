import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { DonorLinkAvatar } from '@/components/ui/DonorLinkAvatar';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { BloodGroupPicker, DonorLinkSelect } from '@/components/ui/DonorLinkPickers';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { DISTRICT_NAMES, LIMITS, validateProfile } from '@/domain';
import { useAvatarUri } from '@/hooks/useAvatarUri';
import { useFormState } from '@/hooks/useFormState';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { BUCKETS } from '@/lib/appwrite/config';
import { deleteFile, toPickedFile, uploadPrivateFile, validatePickedFile } from '@/lib/appwrite/files';
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
  const photoBusy = useRef(false);
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
    if (photoBusy.current || !user) return;
    photoBusy.current = true;
    let uploadedId: string | null = null;
    try {
      // The system photo picker needs no permission (Expo docs: "No permissions
      // request is necessary for launching the image library"), so access is
      // never blocked by a permission prompt that has nothing to grant.
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const file = await toPickedFile({ uri: asset.uri, name: asset.fileName, mimeType: asset.mimeType, size: asset.fileSize });
      const problem = validatePickedFile(BUCKETS.avatars, file);
      if (problem) {
        toast.error("That photo can't be used", problem);
        return;
      }
      setPhotoUri(asset.uri);
      setPhotoProgress(0);
      const oldId = profile?.avatarFileId;
      uploadedId = await uploadPrivateFile(BUCKETS.avatars, user.$id, file, setPhotoProgress);
      const { profile: saved } = await profileService.saveProfile({ displayName: profile?.displayName ?? values.displayName }, { avatarFileId: uploadedId });
      uploadedId = null; // now referenced by the profile
      setProfile(saved);
      if (oldId) void deleteFile(BUCKETS.avatars, oldId).catch(() => undefined);
      toast.success('Profile photo updated');
    } catch (e) {
      setPhotoUri(null);
      // Don't leave an unreferenced file behind when saving the reference failed.
      if (uploadedId) void deleteFile(BUCKETS.avatars, uploadedId).catch(() => undefined);
      toast.error("We couldn't upload your photo", getErrorMessage(e));
    } finally {
      photoBusy.current = false;
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
      <DonorLinkInput label="Town or area" value={values.city} onChangeText={(v) => setValue('city', v)} maxLength={LIMITS.maxCity} leftIcon="location-outline" autoCapitalize="words" />
    </DonorLinkScreen>
  );
}
