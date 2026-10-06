import { isBloodGroup, type BloodGroup } from './bloodGroups';
import { findDistrict } from './districts';
import { isValidCoordinates, type Coordinates } from './geo';
import {
  AVAILABILITY_STATES,
  BLOOD_COMPONENTS,
  ORGANIZATION_TYPES,
  SUPPORT_CATEGORIES,
  URGENCY_LEVELS,
  VERIFICATION_DOCUMENT_TYPES,
  type Availability,
  type BloodComponent,
  type OrganizationType,
  type StockState,
  type SupportCategory,
  type Urgency,
  type VerificationDocumentType,
} from './statuses';

/**
 * Shared validation. The same functions run in the app (for instant feedback)
 * and inside the Appwrite Function (the authoritative check). Messages are
 * deliberately consistent: "<Field> is required.", "Enter a valid <thing>."
 */

export type FieldErrors = Record<string, string>;
export type Validated<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

export const LIMITS = {
  minUnits: 1,
  maxUnits: 20,
  maxRadiusKm: 100,
  minRadiusKm: 1,
  maxNotes: 500,
  maxName: 80,
  maxHospitalName: 120,
  maxPasswordLength: 128,
  minPasswordLength: 8,
  maxRequestHorizonDays: 30,
  maxInventoryUnits: 100000,
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Sri Lankan numbers (07XXXXXXXX / +947XXXXXXXX) plus generic international E.164.
const PHONE_RE = /^\+?[0-9]{9,15}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim()) && value.trim().length <= 254;
}

export function normalizePhone(value: string): string {
  return value.replace(/[\s()-]/g, '');
}

export function isValidPhone(value: string): boolean {
  return PHONE_RE.test(normalizePhone(value));
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function finish<T>(errors: FieldErrors, value: T): Validated<T> {
  return Object.keys(errors).length === 0 ? { ok: true, value } : { ok: false, errors };
}

// --- Auth -----------------------------------------------------------------

export function validateEmailField(value: unknown): string | undefined {
  const email = str(value);
  if (!email) return 'Email is required.';
  if (!isValidEmail(email)) return 'Enter a valid email address.';
  return undefined;
}

export function validatePasswordField(value: unknown): string | undefined {
  const password = typeof value === 'string' ? value : '';
  if (!password) return 'Password is required.';
  if (password.length < LIMITS.minPasswordLength) return `Use at least ${LIMITS.minPasswordLength} characters.`;
  if (password.length > LIMITS.maxPasswordLength) return 'Password is too long.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Include at least one letter and one number.';
  return undefined;
}

export interface LoginInput {
  email: string;
  password: string;
}

export function validateLogin(input: Partial<LoginInput>): Validated<LoginInput> {
  const errors: FieldErrors = {};
  const emailError = validateEmailField(input.email);
  if (emailError) errors.email = emailError;
  if (!input.password) errors.password = 'Password is required.';
  return finish(errors, { email: str(input.email), password: input.password ?? '' });
}

export interface RegistrationInput extends LoginInput {
  name: string;
  confirmPassword: string;
}

export function validateRegistration(input: Partial<RegistrationInput>): Validated<RegistrationInput> {
  const errors: FieldErrors = {};
  const name = str(input.name);
  if (!name) errors.name = 'Full name is required.';
  else if (name.length < 2) errors.name = 'Enter your full name.';
  else if (name.length > LIMITS.maxName) errors.name = `Name must be ${LIMITS.maxName} characters or fewer.`;

  const emailError = validateEmailField(input.email);
  if (emailError) errors.email = emailError;
  const passwordError = validatePasswordField(input.password);
  if (passwordError) errors.password = passwordError;
  if (!errors.password && input.password !== input.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  return finish(errors, {
    name,
    email: str(input.email),
    password: input.password ?? '',
    confirmPassword: input.confirmPassword ?? '',
  });
}

// --- Profile ----------------------------------------------------------------

export interface ProfileInput {
  displayName: string;
  phone?: string;
  bloodGroup?: BloodGroup | null;
  district?: string;
  city?: string;
  location?: Coordinates | null;
  isDonor?: boolean;
  locationConsent?: boolean;
}

export function validateProfile(input: Partial<ProfileInput>): Validated<ProfileInput> {
  const errors: FieldErrors = {};
  const displayName = str(input.displayName);
  if (!displayName) errors.displayName = 'Full name is required.';
  else if (displayName.length > LIMITS.maxName) errors.displayName = `Name must be ${LIMITS.maxName} characters or fewer.`;

  const phone = str(input.phone);
  if (phone && !isValidPhone(phone)) errors.phone = 'Enter a valid phone number, e.g. 0771234567.';

  if (input.bloodGroup !== undefined && input.bloodGroup !== null && !isBloodGroup(input.bloodGroup)) {
    errors.bloodGroup = 'Choose a valid blood group.';
  }

  const district = str(input.district);
  if (district && !findDistrict(district)) errors.district = 'Choose a district from the list.';

  if (input.location && !isValidCoordinates(input.location)) errors.location = 'Location is not valid.';

  return finish(errors, {
    displayName,
    phone: phone ? normalizePhone(phone) : undefined,
    bloodGroup: input.bloodGroup ?? null,
    district: district || undefined,
    city: str(input.city) || undefined,
    location: input.location ?? null,
    isDonor: input.isDonor,
    locationConsent: input.locationConsent,
  });
}

// --- Requests ---------------------------------------------------------------

export interface CreateRequestInput {
  bloodGroup: BloodGroup;
  units: number;
  urgency: Urgency;
  hospitalId?: string | null;
  hospitalName: string;
  district: string;
  city?: string;
  wardUnit?: string;
  /** ISO timestamp */
  requiredBy?: string | null;
  notes?: string;
  relationship?: string;
  location?: Coordinates | null;
}

export function validateCreateRequest(
  input: Partial<CreateRequestInput>,
  now: Date = new Date(),
): Validated<CreateRequestInput> {
  const errors: FieldErrors = {};

  if (!input.bloodGroup) errors.bloodGroup = 'Blood group is required.';
  else if (!isBloodGroup(input.bloodGroup)) errors.bloodGroup = 'Choose a valid blood group.';

  const units = input.units;
  if (units === undefined || units === null || Number.isNaN(units)) errors.units = 'Units required is required.';
  else if (!Number.isInteger(units)) errors.units = 'Enter a whole number of units.';
  else if (units < LIMITS.minUnits || units > LIMITS.maxUnits) {
    errors.units = `Enter between ${LIMITS.minUnits} and ${LIMITS.maxUnits} units.`;
  }

  if (!input.urgency) errors.urgency = 'Urgency is required.';
  else if (!(URGENCY_LEVELS as readonly string[]).includes(input.urgency)) errors.urgency = 'Choose a valid urgency.';

  const hospitalName = str(input.hospitalName);
  if (!hospitalName) errors.hospitalName = 'Hospital is required.';
  else if (hospitalName.length > LIMITS.maxHospitalName) {
    errors.hospitalName = `Hospital name must be ${LIMITS.maxHospitalName} characters or fewer.`;
  }

  const district = str(input.district);
  if (!district) errors.district = 'District is required.';
  else if (!findDistrict(district)) errors.district = 'Choose a district from the list.';

  const notes = str(input.notes);
  if (notes.length > LIMITS.maxNotes) errors.notes = `Notes must be ${LIMITS.maxNotes} characters or fewer.`;

  let requiredBy: string | null = null;
  if (input.requiredBy) {
    const t = new Date(input.requiredBy).getTime();
    if (Number.isNaN(t)) errors.requiredBy = 'Enter a valid date and time.';
    else if (t < now.getTime() - 5 * 60_000) errors.requiredBy = 'Required time cannot be in the past.';
    else if (t > now.getTime() + LIMITS.maxRequestHorizonDays * 864e5) {
      errors.requiredBy = `Choose a time within the next ${LIMITS.maxRequestHorizonDays} days.`;
    } else requiredBy = new Date(t).toISOString();
  }

  if (input.location && !isValidCoordinates(input.location)) errors.location = 'Location is not valid.';

  return finish(errors, {
    bloodGroup: input.bloodGroup as BloodGroup,
    units: units as number,
    urgency: input.urgency as Urgency,
    hospitalId: input.hospitalId ?? null,
    hospitalName,
    district,
    city: str(input.city) || undefined,
    wardUnit: str(input.wardUnit) || undefined,
    requiredBy,
    notes: notes || undefined,
    relationship: str(input.relationship) || undefined,
    location: input.location ?? null,
  });
}

// --- Donor ------------------------------------------------------------------

export interface AvailabilityInput {
  availability: Availability;
  /** ISO timestamp the availability lapses; optional. */
  availableUntil?: string | null;
  radiusKm: number;
  emergencyAlerts: boolean;
}

export function validateAvailability(
  input: Partial<AvailabilityInput>,
  now: Date = new Date(),
): Validated<AvailabilityInput> {
  const errors: FieldErrors = {};
  if (!input.availability || !(AVAILABILITY_STATES as readonly string[]).includes(input.availability)) {
    errors.availability = 'Choose your availability.';
  }
  let availableUntil: string | null = null;
  if (input.availableUntil) {
    const t = new Date(input.availableUntil).getTime();
    if (Number.isNaN(t)) errors.availableUntil = 'Enter a valid date and time.';
    else if (t <= now.getTime()) errors.availableUntil = 'Available-until time must be in the future.';
    else availableUntil = new Date(t).toISOString();
  }
  const radius = input.radiusKm;
  if (radius === undefined || !Number.isFinite(radius)) errors.radiusKm = 'Choose a matching radius.';
  else if (radius < LIMITS.minRadiusKm || radius > LIMITS.maxRadiusKm) {
    errors.radiusKm = `Radius must be between ${LIMITS.minRadiusKm} and ${LIMITS.maxRadiusKm} km.`;
  }
  return finish(errors, {
    availability: input.availability as Availability,
    availableUntil,
    radiusKm: radius as number,
    emergencyAlerts: input.emergencyAlerts ?? true,
  });
}

// --- Inventory ----------------------------------------------------------------

export interface InventoryInput {
  bloodGroup: BloodGroup;
  component: BloodComponent;
  unitsAvailable: number;
  unitsReserved: number;
  lowStockThreshold: number;
}

export function validateInventory(input: Partial<InventoryInput>): Validated<InventoryInput> {
  const errors: FieldErrors = {};
  if (!isBloodGroup(input.bloodGroup)) errors.bloodGroup = 'Choose a valid blood group.';
  if (!input.component || !(BLOOD_COMPONENTS as readonly string[]).includes(input.component)) {
    errors.component = 'Choose a blood component.';
  }
  const check = (key: 'unitsAvailable' | 'unitsReserved' | 'lowStockThreshold', label: string) => {
    const v = input[key];
    if (v === undefined || v === null || Number.isNaN(v)) errors[key] = `${label} is required.`;
    else if (!Number.isInteger(v) || v < 0) errors[key] = `${label} must be a whole number, 0 or more.`;
    else if (v > LIMITS.maxInventoryUnits) errors[key] = `${label} is too large.`;
  };
  check('unitsAvailable', 'Units available');
  check('unitsReserved', 'Units reserved');
  check('lowStockThreshold', 'Low-stock level');
  if (!errors.unitsAvailable && !errors.unitsReserved && input.unitsReserved! > input.unitsAvailable!) {
    errors.unitsReserved = 'Reserved units cannot exceed available units.';
  }
  return finish(errors, input as InventoryInput);
}

/** Stock state from counts. "Available" excludes reserved units. */
export function stockState(unitsAvailable: number, unitsReserved: number, lowStockThreshold: number): StockState {
  const free = Math.max(0, unitsAvailable - unitsReserved);
  if (free === 0) return 'out';
  if (free <= Math.max(1, Math.floor(lowStockThreshold / 2))) return 'critical';
  if (free <= lowStockThreshold) return 'low';
  return 'ok';
}

// --- Verification, organization, support -----------------------------------

export interface VerificationSubmissionInput {
  documentType: VerificationDocumentType;
  note?: string;
  documentFileIds: string[];
}

export function validateVerificationSubmission(
  input: Partial<VerificationSubmissionInput>,
): Validated<VerificationSubmissionInput> {
  const errors: FieldErrors = {};
  if (!input.documentType || !(VERIFICATION_DOCUMENT_TYPES as readonly string[]).includes(input.documentType)) {
    errors.documentType = 'Choose a document type.';
  }
  if (!input.documentFileIds || input.documentFileIds.length === 0) {
    errors.documentFileIds = 'Upload at least one document.';
  } else if (input.documentFileIds.length > 3) {
    errors.documentFileIds = 'Upload up to 3 documents.';
  }
  const note = str(input.note);
  if (note.length > 300) errors.note = 'Note must be 300 characters or fewer.';
  return finish(errors, {
    documentType: input.documentType as VerificationDocumentType,
    note: note || undefined,
    documentFileIds: input.documentFileIds ?? [],
  });
}

export interface OrganizationRegistrationInput {
  name: string;
  type: OrganizationType;
  district: string;
  city?: string;
  address?: string;
  phone: string;
  registrationNumber?: string;
  location?: Coordinates | null;
}

export function validateOrganizationRegistration(
  input: Partial<OrganizationRegistrationInput>,
): Validated<OrganizationRegistrationInput> {
  const errors: FieldErrors = {};
  const name = str(input.name);
  if (!name) errors.name = 'Organization name is required.';
  else if (name.length > LIMITS.maxHospitalName) errors.name = `Name must be ${LIMITS.maxHospitalName} characters or fewer.`;
  if (!input.type || !(ORGANIZATION_TYPES as readonly string[]).includes(input.type)) {
    errors.type = 'Choose an organization type.';
  }
  const district = str(input.district);
  if (!district) errors.district = 'District is required.';
  else if (!findDistrict(district)) errors.district = 'Choose a district from the list.';
  const phone = str(input.phone);
  if (!phone) errors.phone = 'Phone is required.';
  else if (!isValidPhone(phone)) errors.phone = 'Enter a valid phone number.';
  if (input.location && !isValidCoordinates(input.location)) errors.location = 'Location is not valid.';
  return finish(errors, {
    name,
    type: input.type as OrganizationType,
    district,
    city: str(input.city) || undefined,
    address: str(input.address) || undefined,
    phone: normalizePhone(phone),
    registrationNumber: str(input.registrationNumber) || undefined,
    location: input.location ?? null,
  });
}

export interface SupportTicketInput {
  category: SupportCategory;
  subject: string;
  message: string;
}

export function validateSupportTicket(input: Partial<SupportTicketInput>): Validated<SupportTicketInput> {
  const errors: FieldErrors = {};
  if (!input.category || !(SUPPORT_CATEGORIES as readonly string[]).includes(input.category)) {
    errors.category = 'Choose a category.';
  }
  const subject = str(input.subject);
  if (!subject) errors.subject = 'Subject is required.';
  else if (subject.length > 100) errors.subject = 'Subject must be 100 characters or fewer.';
  const message = str(input.message);
  if (!message) errors.message = 'Message is required.';
  else if (message.length < 10) errors.message = 'Please add a little more detail.';
  else if (message.length > 1000) errors.message = 'Message must be 1000 characters or fewer.';
  return finish(errors, { category: input.category as SupportCategory, subject, message });
}

export function validateDeclineReason(value: unknown): string | undefined {
  const reason = str(value);
  if (reason.length > 200) return 'Reason must be 200 characters or fewer.';
  return undefined;
}
