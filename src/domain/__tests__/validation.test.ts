import { coarsenCoordinate, formatDistance, haversineKm } from '../geo';
import { nearestDistrict } from '../districts';
import {
  stockState,
  validateAvailability,
  validateCreateRequest,
  validateInventory,
  validateLogin,
  validateOrganizationRegistration,
  validatePasswordField,
  validateProfile,
  validateRegistration,
  validateSupportTicket,
  validateVerificationSubmission,
} from '../validation';

const NOW = new Date('2026-03-10T10:00:00Z');
const inHours = (h: number) => new Date(NOW.getTime() + h * 36e5).toISOString();

describe('auth validation', () => {
  it('requires a valid email and a password on login', () => {
    const result = validateLogin({ email: 'nope', password: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.email).toBe('Enter a valid email address.');
      expect(result.errors.password).toBe('Password is required.');
    }
    expect(validateLogin({ email: 'a@b.lk', password: 'x' }).ok).toBe(true);
  });

  it('enforces password strength rules', () => {
    expect(validatePasswordField('short1')).toMatch(/at least 8/);
    expect(validatePasswordField('longenoughbutnodigit')).toMatch(/letter and one number/);
    expect(validatePasswordField('Sufficient1')).toBeUndefined();
  });

  it('validates registration including password confirmation', () => {
    const mismatch = validateRegistration({
      name: 'Nimal Perera',
      email: 'nimal@example.com',
      password: 'Sufficient1',
      confirmPassword: 'Different1',
    });
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.errors.confirmPassword).toBe('Passwords do not match.');

    const ok = validateRegistration({
      name: ' Nimal Perera ',
      email: 'nimal@example.com',
      password: 'Sufficient1',
      confirmPassword: 'Sufficient1',
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.name).toBe('Nimal Perera');
  });
});

describe('profile validation', () => {
  it('accepts Sri Lankan and international phone formats, rejects junk', () => {
    expect(validateProfile({ displayName: 'A B', phone: '077 123 4567' }).ok).toBe(true);
    expect(validateProfile({ displayName: 'A B', phone: '+94771234567' }).ok).toBe(true);
    const bad = validateProfile({ displayName: 'A B', phone: '12ab' });
    expect(bad.ok).toBe(false);
  });
  it('validates blood group and district', () => {
    const result = validateProfile({ displayName: 'A B', bloodGroup: 'Z+' as never, district: 'Atlantis' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.bloodGroup).toBeDefined();
      expect(result.errors.district).toBeDefined();
    }
  });
});

describe('emergency request validation', () => {
  const valid = {
    bloodGroup: 'O+' as const,
    units: 2,
    urgency: 'critical' as const,
    hospitalName: 'National Hospital of Sri Lanka',
    district: 'Colombo',
  };

  it('accepts a minimal valid request (fast to complete in an emergency)', () => {
    expect(validateCreateRequest(valid, NOW).ok).toBe(true);
  });

  it('reports every missing required field with consistent wording', () => {
    const result = validateCreateRequest({}, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(
        ['bloodGroup', 'district', 'hospitalName', 'units', 'urgency'].sort(),
      );
      expect(result.errors.hospitalName).toBe('Hospital is required.');
    }
  });

  it.each([0, -1, 21, 1.5])('rejects units = %s', (units) => {
    const result = validateCreateRequest({ ...valid, units }, NOW);
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown urgency and unknown district', () => {
    expect(validateCreateRequest({ ...valid, urgency: 'whenever' as never }, NOW).ok).toBe(false);
    expect(validateCreateRequest({ ...valid, district: 'Nowhere' }, NOW).ok).toBe(false);
  });

  it('validates the required-by time window', () => {
    expect(validateCreateRequest({ ...valid, requiredBy: inHours(-5) }, NOW).ok).toBe(false);
    expect(validateCreateRequest({ ...valid, requiredBy: inHours(24 * 40) }, NOW).ok).toBe(false);
    expect(validateCreateRequest({ ...valid, requiredBy: 'garbage' }, NOW).ok).toBe(false);
    const ok = validateCreateRequest({ ...valid, requiredBy: inHours(6) }, NOW);
    expect(ok.ok).toBe(true);
  });

  it('limits notes length', () => {
    expect(validateCreateRequest({ ...valid, notes: 'x'.repeat(501) }, NOW).ok).toBe(false);
  });
});

describe('availability validation', () => {
  it('requires a future available-until time and a sensible radius', () => {
    expect(validateAvailability({ availability: 'available', radiusKm: 10, availableUntil: inHours(-1) }, NOW).ok).toBe(false);
    expect(validateAvailability({ availability: 'available', radiusKm: 0 }, NOW).ok).toBe(false);
    expect(validateAvailability({ availability: 'available', radiusKm: 500 }, NOW).ok).toBe(false);
    expect(validateAvailability({ availability: 'nope' as never, radiusKm: 10 }, NOW).ok).toBe(false);
    const ok = validateAvailability({ availability: 'available', radiusKm: 15, availableUntil: inHours(8) }, NOW);
    expect(ok.ok).toBe(true);
  });
});

describe('inventory validation', () => {
  const base = {
    bloodGroup: 'A+' as const,
    component: 'whole_blood' as const,
    unitsAvailable: 10,
    unitsReserved: 2,
    lowStockThreshold: 5,
  };
  it('accepts valid counts', () => expect(validateInventory(base).ok).toBe(true));
  it('rejects negative, fractional and over-reserved counts', () => {
    expect(validateInventory({ ...base, unitsAvailable: -1 }).ok).toBe(false);
    expect(validateInventory({ ...base, unitsAvailable: 1.5 }).ok).toBe(false);
    expect(validateInventory({ ...base, unitsReserved: 11 }).ok).toBe(false);
  });
  it('computes stock state from free units', () => {
    expect(stockState(10, 10, 5)).toBe('out');
    expect(stockState(3, 1, 5)).toBe('critical');
    expect(stockState(8, 3, 5)).toBe('low');
    expect(stockState(30, 2, 5)).toBe('ok');
  });
});

describe('verification, organization and support validation', () => {
  it('requires 1-3 documents and a document type', () => {
    expect(validateVerificationSubmission({ documentType: 'national_id', documentFileIds: [] }).ok).toBe(false);
    expect(validateVerificationSubmission({ documentType: 'national_id', documentFileIds: ['a', 'b', 'c', 'd'] }).ok).toBe(false);
    expect(validateVerificationSubmission({ documentFileIds: ['a'] }).ok).toBe(false);
    expect(validateVerificationSubmission({ documentType: 'national_id', documentFileIds: ['a'] }).ok).toBe(true);
  });
  it('validates organization registration', () => {
    expect(validateOrganizationRegistration({}).ok).toBe(false);
    expect(
      validateOrganizationRegistration({ name: 'Kandy Blood Bank', type: 'blood_bank', district: 'Kandy', phone: '0812223344' }).ok,
    ).toBe(true);
  });
  it('validates support tickets', () => {
    expect(validateSupportTicket({ category: 'account', subject: 'Help', message: 'short' }).ok).toBe(false);
    expect(
      validateSupportTicket({ category: 'account', subject: 'Help', message: 'I cannot update my phone number.' }).ok,
    ).toBe(true);
  });
});

describe('geo helpers', () => {
  it('computes realistic distances', () => {
    const colombo = { lat: 6.9271, lng: 79.8612 };
    const kandy = { lat: 7.2906, lng: 80.6337 };
    const d = haversineKm(colombo, kandy);
    expect(d).toBeGreaterThan(85);
    expect(d).toBeLessThan(100);
    expect(haversineKm(colombo, colombo)).toBe(0);
  });
  it('coarsens coordinates for privacy (about 1 km)', () => {
    expect(coarsenCoordinate(6.927079)).toBe(6.93);
    expect(coarsenCoordinate(79.861243)).toBe(79.86);
  });
  it('formats approximate distances', () => {
    expect(formatDistance(0.4)).toBe('Under 1 km');
    expect(formatDistance(2.44)).toBe('2.4 km');
    expect(formatDistance(18.6)).toBe('19 km');
    expect(formatDistance(null)).toBe('Distance unknown');
  });
  it('labels a GPS point with its nearest district', () => {
    expect(nearestDistrict({ lat: 6.92, lng: 79.85 })).toBe('Colombo');
    expect(nearestDistrict({ lat: 9.7, lng: 80.0 })).toBe('Jaffna');
  });
});
