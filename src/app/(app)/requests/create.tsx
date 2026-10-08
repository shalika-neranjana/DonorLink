import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { MedicalDisclaimer } from '@/components/common/InfoRow';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import {
  BloodGroupPicker,
  DonorLinkChip,
  DonorLinkDateTimeField,
  DonorLinkRadioCards,
  DonorLinkSelect,
  DonorLinkStepper,
  type RadioCardOption,
  type SelectOption,
} from '@/components/ui/DonorLinkPickers';
import { DonorLinkBanner } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { DISTRICT_NAMES, LIMITS, URGENCY_DESCRIPTIONS, URGENCY_LABELS, validateCreateRequest, type Urgency } from '@/domain';
import { useRequestDraft } from '@/features/requester/RequestDraftContext';
import { useResource } from '@/hooks/useResource';
import { useAuth } from '@/providers/AuthProvider';
import { requestService } from '@/services/requestService';

const OTHER_HOSPITAL = '__other__';
const RELATIONSHIPS = ['Myself', 'Family member', 'Friend', 'Patient in my care', 'Other'];
const URGENCY_OPTIONS: RadioCardOption<Urgency>[] = [
  { value: 'critical', title: URGENCY_LABELS.critical, description: URGENCY_DESCRIPTIONS.critical, icon: 'alert-circle', tone: 'emergency' },
  { value: 'urgent', title: URGENCY_LABELS.urgent, description: URGENCY_DESCRIPTIONS.urgent, icon: 'time', tone: 'warning' },
  { value: 'standard', title: URGENCY_LABELS.standard, description: URGENCY_DESCRIPTIONS.standard, icon: 'calendar-outline', tone: 'primary' },
];
const DISTRICT_OPTIONS: SelectOption[] = DISTRICT_NAMES.map((name) => ({ value: name, label: name }));

/**
 * One page, no wizard (Milestone 02 chose a single-page form to minimise taps in
 * an emergency). Required fields come first; everything else is optional.
 */
export default function CreateRequestScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { draft, setDraft } = useRequestDraft();
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [hospitalChoice, setHospitalChoice] = useState<string | null>(draft.hospitalId ?? (draft.hospitalName ? OTHER_HOSPITAL : null));
  const [showMore, setShowMore] = useState(!!(draft.wardUnit || draft.notes || draft.relationship));

  const hospitals = useResource(() => requestService.listHospitals(), []);

  const hospitalOptions = useMemo<SelectOption[]>(() => {
    const rows = [...(hospitals.data ?? [])];
    // Hospitals in the user's own district first.
    rows.sort((a, b) => Number(b.district === profile?.district) - Number(a.district === profile?.district) || a.name.localeCompare(b.name));
    return [
      ...rows.map((h) => ({ value: h.$id, label: h.name, description: `${h.city ? `${h.city}, ` : ''}${h.district}` })),
      { value: OTHER_HOSPITAL, label: 'Other hospital (not listed)', description: 'Type the hospital name yourself' },
    ];
  }, [hospitals.data, profile?.district]);

  const district = draft.district || profile?.district || '';

  function chooseHospital(value: string) {
    setHospitalChoice(value);
    setErrors((e) => ({ ...e, hospitalName: undefined, district: undefined }));
    if (value === OTHER_HOSPITAL) {
      setDraft({ ...draft, hospitalId: null, hospitalName: '', district: district });
      return;
    }
    const hospital = hospitals.data?.find((h) => h.$id === value);
    if (hospital) setDraft({ ...draft, hospitalId: hospital.$id, hospitalName: hospital.name, district: hospital.district });
  }

  function patch(partial: Partial<typeof draft>, clear?: string) {
    setDraft({ ...draft, ...partial });
    if (clear) setErrors((e) => ({ ...e, [clear]: undefined }));
  }

  function review() {
    const result = validateCreateRequest({
      bloodGroup: draft.bloodGroup ?? undefined,
      units: draft.units,
      urgency: draft.urgency ?? undefined,
      hospitalId: draft.hospitalId,
      hospitalName: draft.hospitalName,
      district,
      wardUnit: draft.wardUnit,
      requiredBy: draft.requiredBy,
      notes: draft.notes,
      relationship: draft.relationship,
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setDraft({ ...draft, district });
    router.push('/requests/review');
  }

  return (
    <DonorLinkScreen
      header={{ title: 'Request blood', subtitle: 'Takes about a minute' }}
      footer={<DonorLinkButton title="Review request" size="lg" rightIcon="arrow-forward" fullWidth onPress={review} />}
    >
      {Object.keys(errors).some((k) => errors[k]) ? (
        <DonorLinkBanner tone="error" title="Please check the highlighted fields" message="Some details are missing or need a fix before you can continue." />
      ) : null}

      <BloodGroupPicker required value={draft.bloodGroup} onChange={(bloodGroup) => patch({ bloodGroup }, 'bloodGroup')} error={errors.bloodGroup} />

      <DonorLinkStepper label="Units required" required value={draft.units} onChange={(units) => patch({ units }, 'units')} unit="unit" min={1} max={20} error={errors.units} helperText="A unit is one standard donation (about 450 ml)." />

      <DonorLinkRadioCards label="How urgent is it?" required options={URGENCY_OPTIONS} value={draft.urgency} onChange={(urgency) => patch({ urgency }, 'urgency')} error={errors.urgency} />

      <DonorLinkSelect
        label="Hospital"
        required
        value={hospitalChoice}
        options={hospitalOptions}
        onChange={chooseHospital}
        searchable
        placeholder={hospitals.loading ? 'Loading hospitals...' : 'Choose a hospital'}
        error={errors.hospitalName}
        emptyText="No hospital matches. Choose 'Other hospital' to type one."
      />
      {hospitals.error && !hospitals.data ? (
        <DonorLinkBanner tone="warning" message="We couldn't load the hospital list. You can still type a hospital name using 'Other hospital'." actionLabel="Retry" onAction={() => void hospitals.reload()} />
      ) : null}

      {hospitalChoice === OTHER_HOSPITAL ? (
        <>
          <DonorLinkInput label="Hospital name" required value={draft.hospitalName} onChangeText={(hospitalName) => patch({ hospitalName }, 'hospitalName')} error={errors.hospitalName} leftIcon="business-outline" autoCapitalize="words" />
          <DonorLinkSelect label="District" required value={district} options={DISTRICT_OPTIONS} onChange={(d) => patch({ district: d }, 'district')} searchable error={errors.district} />
        </>
      ) : null}

      <DonorLinkDateTimeField
        label="Needed by (optional)"
        value={draft.requiredBy}
        onChange={(requiredBy) => patch({ requiredBy }, 'requiredBy')}
        error={errors.requiredBy}
        quickOptions={[
          { label: 'Within 2 h', hoursFromNow: 2 },
          { label: 'Within 6 h', hoursFromNow: 6 },
          { label: 'Within 24 h', hoursFromNow: 24 },
        ]}
      />

      {showMore ? (
        <View className="gap-4">
          <DonorLinkInput label="Ward / unit" value={draft.wardUnit} onChangeText={(wardUnit) => patch({ wardUnit }, 'wardUnit')} error={errors.wardUnit} maxLength={LIMITS.maxWardUnit} leftIcon="bed-outline" placeholder="e.g. Ward 12, ICU" />
          <View className="gap-2">
            <DonorLinkText variant="label" tone="secondary">
              Who is this for?
            </DonorLinkText>
            <View className="flex-row flex-wrap gap-2">
              {RELATIONSHIPS.map((r) => (
                <DonorLinkChip key={r} label={r} selected={draft.relationship === r} onPress={() => patch({ relationship: draft.relationship === r ? '' : r })} />
              ))}
            </View>
          </View>
          <DonorLinkInput
            label="Notes for donors"
            value={draft.notes}
            onChangeText={(notes) => patch({ notes }, 'notes')}
            error={errors.notes}
            multiline
            maxLength={500}
            helperText="Visible to donors you contact. Do not include patient names or medical details."
          />
        </View>
      ) : (
        <DonorLinkButton title="Add ward, notes or who it's for" variant="ghost" leftIcon="add" onPress={() => setShowMore(true)} />
      )}

      <MedicalDisclaimer compact />
    </DonorLinkScreen>
  );
}
