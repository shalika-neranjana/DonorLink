/**
 * QA audit (2026-10-09): boundary, null and schema-size cases for the shared
 * domain rules. The same functions run in the app and in the Appwrite
 * Function, so a gap here is a gap on the server too.
 */
import fs from 'fs';
import path from 'path';

import {
  BLOOD_GROUPS,
  canTransitionDonation,
  canTransitionRequest,
  canTransitionResponse,
  compatibleDonorGroups,
  effectiveAvailability,
  evaluateCandidate,
  haversineKm,
  isCompatibleDonor,
  recipientGroupsFor,
  REQUEST_TRANSITIONS,
  stockState,
  validateAvailability,
  validateCreateRequest,
  validateInventory,
  validateOrganizationRegistration,
  validateProfile,
  type BloodGroup,
  type DonorCandidate,
  type RequestStatus,
} from '..';

const NOW = new Date('2026-03-10T10:00:00.000Z');
const validRequest = { bloodGroup: 'O+' as const, units: 1, urgency: 'critical' as const, hospitalName: 'NHSL', district: 'Colombo' };

type SchemaTable = { id: string; columns: { key: string; size?: number }[] };
function loadTables(): SchemaTable[] {
  const file = path.resolve(__dirname, '..', '..', '..', 'appwrite', 'schema.mjs');
  const source = fs.readFileSync(file, 'utf8').replace(/export const (\w+) =/g, 'const $1 = exports.$1 =');
  const exports: { TABLES?: SchemaTable[] } = {};
  new Function('exports', source)(exports);
  return exports.TABLES!;
}
const TABLES = loadTables();

function columnSize(table: string, column: string): number {
  const t = (TABLES as { id: string; columns: { key: string; size?: number }[] }[]).find((x) => x.id === table)!;
  return t.columns.find((c) => c.key === column)!.size!;
}

describe('blood group compatibility: full 8x8 table', () => {
  // Conventional ABO/Rh red-cell compatibility, written out independently.
  const canGive = (donor: BloodGroup, recipient: BloodGroup) => {
    const abo = (g: string) => g.replace(/[+-]/, '');
    const aboOk = abo(donor) === 'O' || abo(donor) === abo(recipient) || abo(recipient) === 'AB';
    const rhOk = donor.endsWith('-') || recipient.endsWith('+');
    return aboOk && rhOk;
  };

  it.each(BLOOD_GROUPS.flatMap((d) => BLOOD_GROUPS.map((r) => [d, r] as const)))('%s donor -> %s recipient', (donor, recipient) => {
    expect(isCompatibleDonor(donor, recipient)).toBe(canGive(donor, recipient));
    expect(recipientGroupsFor(donor).includes(recipient)).toBe(canGive(donor, recipient));
  });

  it('O- is the universal donor and AB+ the universal recipient', () => {
    expect(recipientGroupsFor('O-')).toHaveLength(8);
    expect(compatibleDonorGroups('AB+')).toHaveLength(8);
    expect(compatibleDonorGroups('O-')).toEqual(['O-']);
  });
});

describe('request transitions: every pair', () => {
  const statuses = Object.keys(REQUEST_TRANSITIONS) as RequestStatus[];
  const INVALID: [RequestStatus, RequestStatus][] = [
    ['cancelled', 'matching'],
    ['expired', 'matching'],
    ['completed', 'matching'],
    ['fulfilled', 'pending_verification'],
    ['rejected', 'verified'],
    ['pending_verification', 'matching'],
    ['submitted', 'donors_contacted'],
    ['fulfilled', 'expired'],
  ];

  it.each(INVALID)('rejects %s -> %s', (from, to) => expect(canTransitionRequest(from, to)).toBe(false));

  it('never allows a self-transition', () => {
    for (const s of statuses) expect(canTransitionRequest(s, s)).toBe(false);
  });

  it('declined/withdrawn/completed/expired responses are final; accepted cannot be accepted again', () => {
    expect(canTransitionResponse('declined', 'accepted')).toBe(false);
    expect(canTransitionResponse('accepted', 'accepted')).toBe(false);
    expect(canTransitionResponse('expired', 'accepted')).toBe(false);
    expect(canTransitionDonation('cancelled', 'completed')).toBe(false);
    expect(canTransitionDonation('no_show', 'completed')).toBe(false);
  });
});

describe('request validation boundaries', () => {
  it.each([
    [1, true],
    [20, true],
    [0, false],
    [21, false],
    [-1, false],
    [1.5, false],
    [Number.NaN, false],
    [Number.POSITIVE_INFINITY, false],
    [null, false],
    [undefined, false],
  ])('units=%s -> ok=%s', (units, ok) => {
    expect(validateCreateRequest({ ...validRequest, units: units as number }, NOW).ok).toBe(ok);
  });

  it('accepts required-by up to 30 days ahead and a 5-minute clock skew, rejects beyond', () => {
    const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();
    expect(validateCreateRequest({ ...validRequest, requiredBy: at(30 * 864e5) }, NOW).ok).toBe(true);
    expect(validateCreateRequest({ ...validRequest, requiredBy: at(30 * 864e5 + 60_000) }, NOW).ok).toBe(false);
    expect(validateCreateRequest({ ...validRequest, requiredBy: at(-4 * 60_000) }, NOW).ok).toBe(true);
    expect(validateCreateRequest({ ...validRequest, requiredBy: at(-6 * 60_000) }, NOW).ok).toBe(false);
    expect(validateCreateRequest({ ...validRequest, requiredBy: 'not a date' }, NOW).ok).toBe(false);
  });

  it('trims whitespace-only required fields to "missing"', () => {
    const r = validateCreateRequest({ ...validRequest, hospitalName: '   ', district: '  ' }, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['district', 'hospitalName']);
  });
});

describe('free-text fields never exceed their database column (DL-QA-008)', () => {
  const cases: [string, (len: number) => boolean, number][] = [
    ['blood_requests.wardUnit', (n) => validateCreateRequest({ ...validRequest, wardUnit: 'w'.repeat(n) }, NOW).ok, columnSize('blood_requests', 'wardUnit')],
    ['blood_requests.relationship', (n) => validateCreateRequest({ ...validRequest, relationship: 'r'.repeat(n) }, NOW).ok, columnSize('blood_requests', 'relationship')],
    ['blood_requests.city', (n) => validateCreateRequest({ ...validRequest, city: 'c'.repeat(n) }, NOW).ok, columnSize('blood_requests', 'city')],
    ['blood_requests.notes', (n) => validateCreateRequest({ ...validRequest, notes: 'n'.repeat(n) }, NOW).ok, columnSize('blood_requests', 'notes')],
    ['blood_requests.hospitalName', (n) => validateCreateRequest({ ...validRequest, hospitalName: 'h'.repeat(n) }, NOW).ok, columnSize('blood_requests', 'hospitalName')],
    ['profiles.city', (n) => validateProfile({ displayName: 'Kasun', city: 'c'.repeat(n) }).ok, columnSize('profiles', 'city')],
    ['profiles.displayName', (n) => validateProfile({ displayName: 'd'.repeat(n) }).ok, columnSize('profiles', 'displayName')],
    ...(['city', 'address', 'registrationNumber'] as const).map(
      (key) =>
        [
          `organizations.${key}`,
          (n: number) => validateOrganizationRegistration({ name: 'Org', type: 'hospital', district: 'Colombo', phone: '0112345678', [key]: 'x'.repeat(n) }).ok,
          columnSize('organizations', key),
        ] as [string, (len: number) => boolean, number],
    ),
  ];

  it.each(cases)('%s: accepts its column size, rejects one more', (_name, accepts, size) => {
    expect(accepts(size)).toBe(true);
    expect(accepts(size + 1)).toBe(false);
  });
});

describe('availability and inventory edge cases', () => {
  it('rejects non-boolean emergency alerts instead of storing junk (DL-QA-007)', () => {
    expect(validateAvailability({ availability: 'available', radiusKm: 10, emergencyAlerts: 'yes' as never }, NOW).ok).toBe(false);
    expect(validateAvailability({ availability: 'available', radiusKm: 10 }, NOW).ok).toBe(true);
  });

  it('radius boundaries 1 and 100 km are inclusive', () => {
    for (const [radiusKm, ok] of [[1, true], [100, true], [0.5, false], [101, false]] as const) {
      expect(validateAvailability({ availability: 'available', radiusKm }, NOW).ok).toBe(ok);
    }
  });

  it('treats temporarily unavailable donors as not available', () => {
    expect(effectiveAvailability('temporarily_unavailable', NOW.toISOString(), null, NOW)).toBe('temporarily_unavailable');
    const donor: DonorCandidate = {
      donorId: 'd',
      displayName: 'D',
      bloodGroup: 'O+',
      availability: 'temporarily_unavailable',
      availabilityUpdatedAt: NOW.toISOString(),
      radiusKm: 15,
      emergencyAlerts: true,
      verificationStatus: 'verified',
    };
    expect(evaluateCandidate(donor, { requesterId: 'r', bloodGroup: 'O+', urgency: 'critical' }, { now: NOW })).toBeNull();
  });

  it('inventory: zero stock is "out", reserved equal to available is "out", huge counts are refused', () => {
    expect(stockState(0, 0, 5)).toBe('out');
    expect(stockState(5, 5, 5)).toBe('out');
    expect(validateInventory({ bloodGroup: 'O+', component: 'plasma', unitsAvailable: 100001, unitsReserved: 0, lowStockThreshold: 1 }).ok).toBe(false);
    expect(validateInventory({ bloodGroup: 'O+', component: 'plasma', unitsAvailable: 100000, unitsReserved: 100000, lowStockThreshold: 0 }).ok).toBe(true);
  });
});

describe('geo edge cases', () => {
  it('distance is zero for the same point and symmetric', () => {
    const a = { lat: 6.92, lng: 79.87 };
    const b = { lat: 9.66, lng: 80.01 };
    expect(haversineKm(a, a)).toBe(0);
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10);
  });

  it('rejects out-of-range coordinates in profile input', () => {
    expect(validateProfile({ displayName: 'K', location: { lat: 91, lng: 0 } }).ok).toBe(false);
    expect(validateProfile({ displayName: 'K', location: { lat: 0, lng: 181 } }).ok).toBe(false);
  });
});
