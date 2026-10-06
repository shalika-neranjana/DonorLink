const { createWorld } = require('./fakeBackend');

/**
 * A small, realistic world: one admin, a requester, three donors (two nearby,
 * one far away), a hospital directory listing and an org staff user.
 */
async function createScenario() {
  const w = createWorld();
  w.users.add('admin1', { name: 'Ada Admin', labels: ['admin'] });
  w.users.add('req1', { name: 'Ravi Requester' });
  w.users.add('don1', { name: 'Kasun Perera' });
  w.users.add('don2', { name: 'Nimali Silva' });
  w.users.add('far1', { name: 'Jaffna Donor' });
  w.users.add('staff1', { name: 'Sam Staff' });
  w.users.add('stranger', { name: 'Not Involved' });

  await w.store.create('organizations', 'dirnhsl', {
    name: 'National Hospital of Sri Lanka',
    type: 'hospital',
    district: 'Colombo',
    city: 'Colombo 10',
    approxLat: 6.92,
    approxLng: 79.87,
    verificationStatus: 'not_submitted',
    claimed: false,
  });

  const profile = (userId, displayName, bloodGroup, district, isDonor) =>
    w.ok(userId, 'profile.save', {
      profile: { displayName, bloodGroup, district, isDonor, phone: '0771234567' },
      onboardingComplete: true,
    });

  await profile('req1', 'Ravi Requester', 'A+', 'Colombo', false);
  await profile('don1', 'Kasun Perera', 'A+', 'Colombo', true);
  await profile('don2', 'Nimali Silva', 'O-', 'Gampaha', true);
  await profile('far1', 'Jaffna Donor', 'A+', 'Jaffna', true);
  await profile('staff1', 'Sam Staff', 'B+', 'Colombo', false);

  const available = (userId) =>
    w.ok(userId, 'donor.updateAvailability', { availability: 'available', radiusKm: 25, emergencyAlerts: true });
  await available('don1');
  await available('don2');
  await available('far1');

  const baseRequest = {
    bloodGroup: 'A+',
    units: 2,
    urgency: 'critical',
    hospitalId: 'dirnhsl',
    hospitalName: 'National Hospital of Sri Lanka',
    district: 'Colombo',
  };

  return { w, baseRequest };
}

module.exports = { createScenario };
