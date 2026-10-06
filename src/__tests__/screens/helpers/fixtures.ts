import type { BloodRequest, DonorProfile, Profile, RequestResponse } from '@/types/entities';

export const NOW = new Date().toISOString();
export const base = { $id: 'row1', $createdAt: NOW, $updatedAt: NOW, $permissions: [] as string[] };

export const profile: Profile = {
  ...base,
  $id: 'u1',
  userId: 'u1',
  displayName: 'Kasun Perera',
  phone: '0771234567',
  bloodGroup: 'O+',
  district: 'Colombo',
  isDonor: true,
  locationConsent: true,
  onboardingComplete: true,
  verificationStatus: 'not_submitted',
};

export const donor: DonorProfile = {
  ...base,
  $id: 'u1',
  donorId: 'u1',
  displayName: 'Kasun P.',
  bloodGroup: 'O+',
  availability: 'available',
  availabilityUpdatedAt: NOW,
  radiusKm: 15,
  emergencyAlerts: true,
  donationCount: 2,
  verificationStatus: 'verified',
};

export const request: BloodRequest = {
  ...base,
  $id: 'req1',
  requesterId: 'u2',
  requesterName: 'Ravi Perera',
  bloodGroup: 'O+',
  units: 2,
  unitsAccepted: 0,
  unitsCompleted: 0,
  contactedCount: 1,
  urgency: 'critical',
  status: 'donors_contacted',
  verificationStatus: 'verified',
  hospitalName: 'National Hospital of Sri Lanka',
  district: 'Colombo',
  notes: 'Please come to the blood bank.',
  statusHistory: JSON.stringify([{ status: 'submitted', at: NOW }]),
};

export const response: RequestResponse = {
  ...base,
  $id: 'resp1',
  requestId: 'req1',
  donorId: 'u1',
  donorName: 'Kasun P.',
  donorBloodGroup: 'O+',
  requesterId: 'u2',
  status: 'pending',
  matchQuality: 'excellent',
  distanceKm: 2.4,
};

