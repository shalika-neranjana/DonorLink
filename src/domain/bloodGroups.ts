/**
 * Blood group vocabulary and the application-level compatibility table.
 *
 * IMPORTANT: this is an educational matching concept used to *rank* potential
 * donors inside DonorLink. It is not a clinical transfusion-compatibility
 * decision. Final blood compatibility and donation eligibility must be
 * confirmed by qualified healthcare professionals.
 */
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export const MEDICAL_DISCLAIMER =
  'Final blood compatibility and donation eligibility must be confirmed by qualified healthcare professionals.';

export const MATCHING_DISCLAIMER =
  'DonorLink ranks donors using blood group, availability, distance and verification. This is coordination support, not medical approval.';

export function isBloodGroup(value: unknown): value is BloodGroup {
  return typeof value === 'string' && (BLOOD_GROUPS as readonly string[]).includes(value);
}

/**
 * Red-cell donor groups that are conventionally compatible with a recipient
 * group (ABO + Rh). Keyed by the *recipient* group.
 */
const DONORS_FOR_RECIPIENT: Record<BloodGroup, readonly BloodGroup[]> = {
  'O-': ['O-'],
  'O+': ['O+', 'O-'],
  'A-': ['A-', 'O-'],
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
};

/** Donor groups that can conventionally give to the requested recipient group. */
export function compatibleDonorGroups(recipient: BloodGroup): readonly BloodGroup[] {
  return DONORS_FOR_RECIPIENT[recipient];
}

export function isCompatibleDonor(donor: BloodGroup, recipient: BloodGroup): boolean {
  return DONORS_FOR_RECIPIENT[recipient].includes(donor);
}

/** Recipient groups a donor group can conventionally give to. */
export function recipientGroupsFor(donor: BloodGroup): BloodGroup[] {
  return BLOOD_GROUPS.filter((recipient) => DONORS_FOR_RECIPIENT[recipient].includes(donor));
}
