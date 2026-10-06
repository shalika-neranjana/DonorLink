import { compatibleDonorGroups, isBloodGroup, type BloodGroup } from './bloodGroups';
import { haversineKm, type Coordinates } from './geo';
import {
  AVAILABILITY_STALE_HOURS,
  URGENCY_RANK,
  type Availability,
  type MatchQuality,
  type Urgency,
  type VerificationStatus,
} from './statuses';

/**
 * Application-level donor matching.
 *
 * This ranks *who to contact first*. It is deliberately transparent: every
 * result carries the human-readable reasons behind its quality label, and no
 * result claims clinical compatibility or medical eligibility.
 */

/** Typical minimum gap between whole-blood donations; shown as guidance only. */
export const RECENT_DONATION_DAYS = 56;

export interface DonorCandidate {
  donorId: string;
  displayName: string;
  bloodGroup: BloodGroup;
  availability: Availability;
  /** ISO timestamp of the last availability update. */
  availabilityUpdatedAt?: string | null;
  /** ISO timestamp; availability lapses after this moment. */
  availableUntil?: string | null;
  radiusKm: number;
  emergencyAlerts: boolean;
  location?: Coordinates | null;
  verificationStatus: VerificationStatus;
  /** Self-reported. */
  lastDonationDate?: string | null;
  donationCount?: number;
}

export interface MatchRequestInput {
  requesterId: string;
  bloodGroup: BloodGroup;
  urgency: Urgency;
  location?: Coordinates | null;
}

export interface MatchOptions {
  now?: Date;
  /** Hard cap on distance regardless of donor preference. */
  maxRadiusKm?: number;
  /** 'verified' excludes donors whose verification is not "verified". */
  minVerification?: 'any' | 'verified';
  limit?: number;
}

export interface MatchResult {
  donorId: string;
  displayName: string;
  bloodGroup: BloodGroup;
  exactGroup: boolean;
  distanceKm: number | null;
  availability: Availability;
  availableUntil: string | null;
  verificationStatus: VerificationStatus;
  recentlyDonated: boolean;
  donationCount: number;
  score: number;
  quality: MatchQuality;
  /** Plain-language basis for the quality label. */
  reasons: string[];
}

export const DEFAULT_MAX_RADIUS_KM = 30;

/**
 * Availability as it should be *presented*: an "available" flag that has
 * lapsed or gone stale is treated as unknown rather than shown as current.
 */
export function effectiveAvailability(
  availability: Availability,
  updatedAt: string | null | undefined,
  availableUntil: string | null | undefined,
  now: Date = new Date(),
): Availability {
  if (availability !== 'available') return availability;
  if (availableUntil && new Date(availableUntil).getTime() < now.getTime()) return 'unavailable';
  if (updatedAt) {
    const ageHours = (now.getTime() - new Date(updatedAt).getTime()) / 36e5;
    if (ageHours > AVAILABILITY_STALE_HOURS) return 'unknown';
  } else {
    return 'unknown';
  }
  return 'available';
}

function daysSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / 864e5);
}

export function qualityForScore(score: number): MatchQuality {
  if (score >= 75) return 'excellent';
  if (score >= 55) return 'good';
  return 'fair';
}

export function formatKm(km: number): string {
  return km < 10 ? km.toFixed(1) : String(Math.round(km));
}

/** Returns null when the donor must be excluded, otherwise a scored result. */
export function evaluateCandidate(
  candidate: DonorCandidate,
  request: MatchRequestInput,
  options: MatchOptions = {},
): MatchResult | null {
  const now = options.now ?? new Date();
  const maxRadius = options.maxRadiusKm ?? DEFAULT_MAX_RADIUS_KM;

  if (candidate.donorId === request.requesterId) return null;
  if (!isBloodGroup(candidate.bloodGroup)) return null;
  if (!compatibleDonorGroups(request.bloodGroup).includes(candidate.bloodGroup)) return null;
  if (!candidate.emergencyAlerts) return null;

  const availability = effectiveAvailability(
    candidate.availability,
    candidate.availabilityUpdatedAt,
    candidate.availableUntil,
    now,
  );
  if (availability !== 'available') return null;

  const verified = candidate.verificationStatus === 'verified';
  if (options.minVerification === 'verified' && !verified) return null;

  let distanceKm: number | null = null;
  if (candidate.location && request.location) {
    distanceKm = haversineKm(candidate.location, request.location);
    if (distanceKm > maxRadius) return null;
    if (distanceKm > candidate.radiusKm) return null;
  }

  const exactGroup = candidate.bloodGroup === request.bloodGroup;
  const sinceDonation = daysSince(candidate.lastDonationDate, now);
  const recentlyDonated = sinceDonation !== null && sinceDonation < RECENT_DONATION_DAYS;

  let score = 0;
  const reasons: string[] = [];

  if (exactGroup) {
    score += 30;
    reasons.push(`Exact blood group (${candidate.bloodGroup})`);
  } else {
    score += 18;
    reasons.push(`Compatible group (${candidate.bloodGroup})`);
  }

  score += 20;
  reasons.push('Available now');

  if (distanceKm !== null) {
    score += Math.round(30 * Math.max(0, 1 - distanceKm / maxRadius));
    reasons.push(`About ${formatKm(distanceKm)} km away`);
  } else {
    score += 8;
    reasons.push('Distance unknown');
  }

  if (verified) {
    score += 15;
    reasons.push('Verified donor');
  } else if (candidate.verificationStatus === 'pending') {
    score += 3;
    reasons.push('Verification pending');
  } else {
    reasons.push('Not yet verified');
  }

  if (recentlyDonated) {
    score -= 15;
    reasons.push('Donated recently (self-reported)');
  }

  // Urgent requests value nearby donors a little more.
  if (distanceKm !== null && URGENCY_RANK[request.urgency] === 3 && distanceKm <= 5) score += 5;

  score = Math.max(0, Math.min(100, score));

  return {
    donorId: candidate.donorId,
    displayName: candidate.displayName,
    bloodGroup: candidate.bloodGroup,
    exactGroup,
    distanceKm: distanceKm === null ? null : Math.round(distanceKm * 10) / 10,
    availability,
    availableUntil: candidate.availableUntil ?? null,
    verificationStatus: candidate.verificationStatus,
    recentlyDonated,
    donationCount: candidate.donationCount ?? 0,
    score,
    quality: qualityForScore(score),
    reasons,
  };
}

/** Evaluates, filters and ranks candidates. Highest score first, nearest breaks ties. */
export function rankCandidates(
  candidates: DonorCandidate[],
  request: MatchRequestInput,
  options: MatchOptions = {},
): MatchResult[] {
  const results: MatchResult[] = [];
  for (const candidate of candidates) {
    const result = evaluateCandidate(candidate, request, options);
    if (result) results.push(result);
  }
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return a.donorId.localeCompare(b.donorId);
  });
  return options.limit ? results.slice(0, options.limit) : results;
}
