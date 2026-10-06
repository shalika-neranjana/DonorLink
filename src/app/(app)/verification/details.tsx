import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkIcon } from '@/components/ui/DonorLinkIcon';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { DonorLinkChip, DonorLinkSelect } from '@/components/ui/DonorLinkPickers';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { useToast } from '@/components/ui/DonorLinkToast';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import {
  DISTRICT_NAMES,
  ORGANIZATION_TYPES,
  ORGANIZATION_TYPE_LABELS,
  VERIFICATION_DOCUMENT_LABELS,
  validateOrganizationRegistration,
  validateVerificationSubmission,
  type OrganizationType,
  type VerificationDocumentType,
  type VerificationSubject,
} from '@/domain';
import { useResource } from '@/hooks/useResource';
import { BUCKETS } from '@/lib/appwrite/config';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { validatePickedFile, type PickedFile } from '@/lib/appwrite/files';
import { useAuth } from '@/providers/AuthProvider';
import { requestService } from '@/services/requestService';
import { verificationService } from '@/services/verificationService';

const DOCUMENT_OPTIONS: Record<VerificationSubject, VerificationDocumentType[]> = {
  user: ['national_id', 'passport', 'driving_licence'],
  donor: ['donor_card', 'national_id', 'other'],
  organization: ['organization_registration', 'other'],
};

const TITLES: Record<VerificationSubject, string> = {
  user: 'Verify your identity',
  donor: 'Verify donor status',
  organization: 'Register your organization',
};

const DISTRICT_OPTIONS = DISTRICT_NAMES.map((name) => ({ value: name, label: name }));

/** Upload documents for review. Files go to a private bucket; nothing is public. */
export default function VerificationDetailsScreen() {
  const params = useLocalSearchParams<{ subject?: string }>();
  const subject = (['user', 'donor', 'organization'].includes(params.subject ?? '') ? params.subject : 'user') as VerificationSubject;
  const router = useRouter();
  const toast = useToast();
  const { user, profile } = useAuth();

  const [documentType, setDocumentType] = useState<VerificationDocumentType>(DOCUMENT_OPTIONS[subject][0]);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [note, setNote] = useState('');
  const [org, setOrg] = useState({ name: '', type: 'hospital' as OrganizationType, district: profile?.district ?? '', city: '', address: '', phone: '', registrationNumber: '', claimOrganizationId: '' });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const directory = useResource(() => requestService.listHospitals(), [], { enabled: subject === 'organization' });
  const claimOptions = useMemo(
    () => [{ value: '', label: 'My organization is not in this list' }, ...(directory.data ?? []).filter((o) => !o.claimed).map((o) => ({ value: o.$id, label: o.name, description: `${o.city ? `${o.city}, ` : ''}${o.district}` }))],
    [directory.data],
  );

  function addFile(file: PickedFile) {
    const problem = validatePickedFile(BUCKETS.verificationDocs, file);
    if (problem) {
      setErrors((e) => ({ ...e, documentFileIds: problem }));
      return;
    }
    if (files.length >= 3) {
      setErrors((e) => ({ ...e, documentFileIds: 'You can upload up to 3 documents.' }));
      return;
    }
    setErrors((e) => ({ ...e, documentFileIds: undefined }));
    setFiles((prev) => [...prev, file]);
  }

  async function chooseFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'application/pdf'], copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    addFile({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/octet-stream', size: a.size ?? 0 });
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      toast.warning('Camera access is off', 'Allow camera access in settings, or choose a file instead.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    addFile({ uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg', size: a.fileSize ?? 1 });
  }

  async function submit() {
    if (submitting || !user) return;
    setFormError(null);
    const docCheck = validateVerificationSubmission({ documentType, note, documentFileIds: files.map((f) => f.uri) });
    const next: Record<string, string | undefined> = docCheck.ok ? {} : { ...docCheck.errors };
    let organization;
    if (subject === 'organization') {
      const orgCheck = validateOrganizationRegistration({ ...org, claimOrganizationId: undefined } as never);
      if (!orgCheck.ok) Object.assign(next, orgCheck.errors);
      else organization = { ...orgCheck.value, ...(org.claimOrganizationId ? { claimOrganizationId: org.claimOrganizationId } : {}) };
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    setProgress(0);
    try {
      await verificationService.submit({ userId: user.$id, subjectType: subject, documentType, files, note: note.trim() || undefined, organization, onUploadProgress: setProgress });
      toast.success('Verification submitted', 'A reviewer will look at it soon.');
      setDone(true);
    } catch (e) {
      setFormError(getErrorMessage(e, "We couldn't submit your documents."));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <DonorLinkScreen header={{ title: TITLES[subject], onBack: false }} footer={<DonorLinkButton title="Done" size="lg" fullWidth onPress={() => router.replace('/verification')} />}>
        <View className="items-center gap-3 py-10">
          <Animated.View entering={ZoomIn.duration(300)} className="h-20 w-20 items-center justify-center rounded-full bg-success-soft">
            <DonorLinkIcon name="checkmark-circle" size={48} color="success" />
          </Animated.View>
          <DonorLinkText variant="heading" align="center">
            Submitted for review
          </DonorLinkText>
          <DonorLinkText variant="body" tone="secondary" align="center">
            We&apos;ll notify you as soon as a reviewer decides. Your documents are private and visible only to reviewers.
          </DonorLinkText>
        </View>
      </DonorLinkScreen>
    );
  }

  return (
    <DonorLinkScreen
      header={{ title: TITLES[subject] }}
      footer={<DonorLinkButton title={submitting ? `Uploading ${progress}%` : 'Submit for review'} size="lg" fullWidth loading={submitting} leftIcon="cloud-upload-outline" onPress={() => void submit()} />}
    >
      {formError ? <DonorLinkBanner tone="error" title="Not submitted" message={formError} /> : null}

      {subject === 'organization' ? (
        <View className="gap-4">
          <DonorLinkSelect label="Is your organization already listed?" value={org.claimOrganizationId} options={claimOptions} onChange={(v) => setOrg((o) => ({ ...o, claimOrganizationId: v, name: v ? (directory.data?.find((d) => d.$id === v)?.name ?? o.name) : o.name, district: v ? (directory.data?.find((d) => d.$id === v)?.district ?? o.district) : o.district }))} searchable helperText="Claiming a listing links requests addressed to it to your team." />
          <DonorLinkInput label="Organization name" required value={org.name} onChangeText={(v) => setOrg((o) => ({ ...o, name: v }))} error={errors.name} leftIcon="business-outline" autoCapitalize="words" />
          <View className="gap-2">
            <DonorLinkText variant="label" tone="secondary">
              Type
            </DonorLinkText>
            <View className="flex-row flex-wrap gap-2">
              {ORGANIZATION_TYPES.map((t) => (
                <DonorLinkChip key={t} label={ORGANIZATION_TYPE_LABELS[t]} selected={org.type === t} onPress={() => setOrg((o) => ({ ...o, type: t }))} />
              ))}
            </View>
          </View>
          <DonorLinkSelect label="District" required value={org.district} options={DISTRICT_OPTIONS} onChange={(v) => setOrg((o) => ({ ...o, district: v }))} searchable error={errors.district} />
          <DonorLinkInput label="Contact phone" required value={org.phone} onChangeText={(v) => setOrg((o) => ({ ...o, phone: v }))} error={errors.phone} keyboardType="phone-pad" leftIcon="call-outline" helperText="Shown to donors you accept." />
          <DonorLinkInput label="Address" value={org.address} onChangeText={(v) => setOrg((o) => ({ ...o, address: v }))} leftIcon="location-outline" />
          <DonorLinkInput label="Registration number" value={org.registrationNumber} onChangeText={(v) => setOrg((o) => ({ ...o, registrationNumber: v }))} leftIcon="reader-outline" />
        </View>
      ) : null}

      <View className="gap-2">
        <DonorLinkText variant="label" tone="secondary">
          Document type
        </DonorLinkText>
        <View className="flex-row flex-wrap gap-2">
          {DOCUMENT_OPTIONS[subject].map((t) => (
            <DonorLinkChip key={t} label={VERIFICATION_DOCUMENT_LABELS[t]} selected={documentType === t} onPress={() => setDocumentType(t)} />
          ))}
        </View>
      </View>

      <View className="gap-2">
        <DonorLinkText variant="label" tone="secondary">
          Documents (up to 3)
        </DonorLinkText>
        {files.map((file, index) => (
          <DonorLinkCard key={`${file.uri}-${index}`} className="flex-row items-center gap-3 py-3">
            <DonorLinkIcon name={file.mimeType === 'application/pdf' ? 'document-text' : 'image'} size={22} color="primary" />
            <View className="flex-1">
              <DonorLinkText variant="bodyStrong" numberOfLines={1}>
                {file.name}
              </DonorLinkText>
              <DonorLinkText variant="caption" tone="muted">
                {(file.size / 1024).toFixed(0)} KB
              </DonorLinkText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${file.name}`} hitSlop={10} onPress={() => setFiles((prev) => prev.filter((_, i) => i !== index))}>
              <DonorLinkIcon name="close-circle" size={22} color="fgMuted" />
            </Pressable>
          </DonorLinkCard>
        ))}
        <View className="flex-row gap-2">
          <View className="flex-1">
            <DonorLinkButton title="Take photo" variant="outline" leftIcon="camera-outline" disabled={submitting} onPress={() => void takePhoto()} fullWidth />
          </View>
          <View className="flex-1">
            <DonorLinkButton title="Choose file" variant="outline" leftIcon="attach" disabled={submitting} onPress={() => void chooseFile()} fullWidth />
          </View>
        </View>
        {errors.documentFileIds ? (
          <DonorLinkText variant="bodySmall" tone="error">
            {errors.documentFileIds === 'Upload at least one document.' ? errors.documentFileIds : errors.documentFileIds}
          </DonorLinkText>
        ) : (
          <DonorLinkText variant="caption" tone="muted">
            JPG, PNG or PDF, up to 5 MB each. Documents are private and encrypted.
          </DonorLinkText>
        )}
      </View>

      <DonorLinkInput label="Note for the reviewer (optional)" value={note} onChangeText={setNote} error={errors.note} multiline maxLength={300} />
    </DonorLinkScreen>
  );
}
