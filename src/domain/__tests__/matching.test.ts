import { compatibleDonorGroups, isCompatibleDonor, BLOOD_GROUPS } from '../bloodGroups';
import {
  effectiveAvailability,
  evaluateCandidate,
  qualityForScore,
  rankCandidates,
  type DonorCandidate,
  type MatchRequestInput,
} from '../matching';

const NOW = new Date('2026-03-10T10:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 36e5).toISOString();
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 864e5).toISOString();

const COLOMBO = { lat: 6.93, lng: 79.86 };
const near = { lat: 6.95, lng: 79.87 }; // ~2.5 km
const far = { lat: 7.29, lng: 80.63 }; // Kandy, ~95 km

const request: MatchRequestInput = {
  requesterId: 'requester-1',
  bloodGroup: 'A+',
  urgency: 'critical',
  location: COLOMBO,
};

function donor(overrides: Partial<DonorCandidate> = {}): DonorCandidate {
  return {
    donorId: 'donor-1',
    displayName: 'Nimal P.',
    bloodGroup: 'A+',
    availability: 'available',
    availabilityUpdatedAt: hoursAgo(1),
    availableUntil: null,
    radiusKm: 25,
    emergencyAlerts: true,
    location: near,
    verificationStatus: 'verified',
    lastDonationDate: null,
    donationCount: 2,
    ...overrides,
  };
}

describe('blood group compatibility (application-level)', () => {
  it('maps every recipient to at least itself', () => {
    for (const group of BLOOD_GROUPS) {
      expect(compatibleDonorGroups(group)).toContain(group);
    }
  });

  it.each([
    ['A+', 'A+', true],
    ['A+', 'O-', true],
    ['A+', 'B+', false],
    ['A+', 'AB+', false],
    ['O-', 'O+', false],
    ['O-', 'O-', true],
    ['AB+', 'O-', true],
    ['AB+', 'AB+', true],
    ['B-', 'B+', false],
  ] as const)('recipient %s with donor %s -> %s', (recipient, donorGroup, expected) => {
    expect(isCompatibleDonor(donorGroup, recipient)).toBe(expected);
  });
});

describe('effectiveAvailability', () => {
  it('keeps fresh availability', () => {
    expect(effectiveAvailability('available', hoursAgo(2), null, NOW)).toBe('available');
  });
  it('treats stale availability as unknown instead of current', () => {
    expect(effectiveAvailability('available', hoursAgo(100), null, NOW)).toBe('unknown');
  });
  it('lapses after availableUntil', () => {
    expect(effectiveAvailability('available', hoursAgo(1), hoursAgo(0.5), NOW)).toBe('unavailable');
  });
  it('treats never-set availability as unknown', () => {
    expect(effectiveAvailability('available', null, null, NOW)).toBe('unknown');
  });
  it('passes through non-available states', () => {
    expect(effectiveAvailability('unavailable', hoursAgo(1), null, NOW)).toBe('unavailable');
  });
});

describe('evaluateCandidate exclusions', () => {
  it('excludes incompatible blood groups', () => {
    expect(evaluateCandidate(donor({ bloodGroup: 'B+' }), request, { now: NOW })).toBeNull();
  });
  it('excludes unavailable donors', () => {
    expect(evaluateCandidate(donor({ availability: 'unavailable' }), request, { now: NOW })).toBeNull();
    expect(evaluateCandidate(donor({ availability: 'temporarily_unavailable' }), request, { now: NOW })).toBeNull();
  });
  it('excludes donors whose availability is stale', () => {
    expect(evaluateCandidate(donor({ availabilityUpdatedAt: hoursAgo(200) }), request, { now: NOW })).toBeNull();
  });
  it('excludes the requester themselves', () => {
    expect(evaluateCandidate(donor({ donorId: 'requester-1' }), request, { now: NOW })).toBeNull();
  });
  it('excludes donors who turned emergency alerts off', () => {
    expect(evaluateCandidate(donor({ emergencyAlerts: false }), request, { now: NOW })).toBeNull();
  });
  it('excludes donors beyond their own preferred radius', () => {
    expect(evaluateCandidate(donor({ location: far, radiusKm: 25 }), request, { now: NOW, maxRadiusKm: 200 })).toBeNull();
  });
  it('excludes donors beyond the search radius', () => {
    expect(evaluateCandidate(donor({ location: far, radiusKm: 200 }), request, { now: NOW, maxRadiusKm: 30 })).toBeNull();
  });
  it('can require verified donors', () => {
    const unverified = donor({ verificationStatus: 'not_submitted' });
    expect(evaluateCandidate(unverified, request, { now: NOW, minVerification: 'verified' })).toBeNull();
    expect(evaluateCandidate(unverified, request, { now: NOW, minVerification: 'any' })).not.toBeNull();
  });
});

describe('evaluateCandidate scoring', () => {
  it('rates a near, verified, exact-group donor as excellent with transparent reasons', () => {
    const result = evaluateCandidate(donor(), request, { now: NOW })!;
    expect(result.quality).toBe('excellent');
    expect(result.exactGroup).toBe(true);
    expect(result.distanceKm).toBeGreaterThan(0);
    expect(result.distanceKm).toBeLessThan(5);
    expect(result.reasons).toEqual(
      expect.arrayContaining(['Exact blood group (A+)', 'Available now', 'Verified donor']),
    );
  });

  it('scores nearer donors above farther ones', () => {
    const nearResult = evaluateCandidate(donor({ location: near }), request, { now: NOW })!;
    const midResult = evaluateCandidate(donor({ location: { lat: 7.1, lng: 79.95 } }), request, { now: NOW })!;
    expect(nearResult.score).toBeGreaterThan(midResult.score);
  });

  it('scores exact group above a merely compatible group', () => {
    const exact = evaluateCandidate(donor({ bloodGroup: 'A+' }), request, { now: NOW })!;
    const universal = evaluateCandidate(donor({ bloodGroup: 'O-' }), request, { now: NOW })!;
    expect(exact.score).toBeGreaterThan(universal.score);
    expect(universal.exactGroup).toBe(false);
  });

  it('penalises recent self-reported donations without excluding the donor', () => {
    const rested = evaluateCandidate(donor({ lastDonationDate: daysAgo(200) }), request, { now: NOW })!;
    const recent = evaluateCandidate(donor({ lastDonationDate: daysAgo(10) }), request, { now: NOW })!;
    expect(recent.recentlyDonated).toBe(true);
    expect(rested.recentlyDonated).toBe(false);
    expect(recent.score).toBeLessThan(rested.score);
    expect(recent.reasons).toContain('Donated recently (self-reported)');
  });

  it('keeps donors with unknown location but marks distance unknown', () => {
    const result = evaluateCandidate(donor({ location: null }), request, { now: NOW })!;
    expect(result.distanceKm).toBeNull();
    expect(result.reasons).toContain('Distance unknown');
  });

  it('never exceeds 100 or drops below 0', () => {
    const result = evaluateCandidate(donor({ location: COLOMBO }), request, { now: NOW })!;
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('maps score bands to quality labels', () => {
    expect(qualityForScore(90)).toBe('excellent');
    expect(qualityForScore(60)).toBe('good');
    expect(qualityForScore(20)).toBe('fair');
  });
});

describe('rankCandidates', () => {
  it('orders by score then distance, drops excluded donors, honours limit', () => {
    const list: DonorCandidate[] = [
      donor({ donorId: 'far-unverified', verificationStatus: 'not_submitted', location: { lat: 7.1, lng: 79.95 } }),
      donor({ donorId: 'best' }),
      donor({ donorId: 'blocked', availability: 'unavailable' }),
      donor({ donorId: 'wrong-group', bloodGroup: 'B-' }),
      donor({ donorId: 'universal', bloodGroup: 'O-' }),
    ];
    const ranked = rankCandidates(list, request, { now: NOW });
    expect(ranked.map((r) => r.donorId)).toEqual(['best', 'universal', 'far-unverified']);
    expect(rankCandidates(list, request, { now: NOW, limit: 1 })).toHaveLength(1);
  });

  it('returns an empty list when nobody qualifies', () => {
    expect(rankCandidates([donor({ availability: 'unavailable' })], request, { now: NOW })).toEqual([]);
  });
});
