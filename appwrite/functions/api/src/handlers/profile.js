const domain = require('../lib/domain');
const { validation, notFound } = require('../lib/errors');
const { audit, ownerReadPerms, shortName, iso } = require('../lib/context');

const NOTIFICATION_PREF_KEYS = [
  'emergencyRequests',
  'requestUpdates',
  'donationUpdates',
  'accountAlerts',
  'reminders',
];
const PRIVACY_PREF_KEYS = ['anonymousDonor', 'shareApproxLocation'];

function sanitizePrefs(input, keys) {
  if (input == null) return undefined;
  if (typeof input !== 'object') throw validation({ preferences: 'Invalid preferences.' });
  const out = {};
  for (const key of keys) {
    if (key in input) out[key] = input[key] === true;
  }
  return JSON.stringify(out);
}

function parsePrefs(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Builds the donor_profiles data from a profile row. */
function donorDataFromProfile(profile) {
  const privacy = parsePrefs(profile.privacyPrefs);
  const shareLocation = privacy.shareApproxLocation !== false;
  return {
    donorId: profile.userId,
    displayName: privacy.anonymousDonor === true ? 'Anonymous donor' : shortName(profile.displayName),
    bloodGroup: profile.bloodGroup,
    district: profile.district || null,
    approxLat: shareLocation && profile.approxLat != null ? profile.approxLat : null,
    approxLng: shareLocation && profile.approxLng != null ? profile.approxLng : null,
    verificationStatus: undefined,
  };
}

async function syncDonorProfile(ctx, profile) {
  if (!profile.isDonor || !profile.bloodGroup) return null;
  const existing = await ctx.store.get('donor_profiles', profile.userId);
  const data = donorDataFromProfile(profile);
  delete data.verificationStatus;
  if (existing) return ctx.store.update('donor_profiles', profile.userId, data);
  return ctx.store.create(
    'donor_profiles',
    profile.userId,
    { ...data, availability: 'unknown', radiusKm: 15, emergencyAlerts: true, donationCount: 0, verificationStatus: 'not_submitted' },
    ownerReadPerms(profile.userId),
  );
}

async function saveProfile(ctx, payload) {
  const result = domain.validateProfile(payload && payload.profile ? payload.profile : {});
  if (!result.ok) throw validation(result.errors);
  const input = result.value;

  const existing = await ctx.store.get('profiles', ctx.userId);
  const provided = payload.profile || {};
  // Only fields the caller sent are changed; everything else keeps its stored value.
  const pick = (key, value, fallback) => (key in provided ? value : existing ? existing[key] : fallback);

  let location = input.location ? domain.coarsenCoordinates(input.location) : null;
  if (!location && 'district' in provided && input.district) location = domain.districtCentre(input.district) || null;

  const data = {
    userId: ctx.userId,
    displayName: input.displayName,
    phone: pick('phone', input.phone ?? null, null),
    bloodGroup: pick('bloodGroup', input.bloodGroup ?? null, null),
    district: pick('district', input.district ?? null, null),
    city: pick('city', input.city ?? null, null),
    approxLat: location ? location.lat : existing ? existing.approxLat : null,
    approxLng: location ? location.lng : existing ? existing.approxLng : null,
    isDonor: pick('isDonor', input.isDonor === true, false),
    locationConsent: pick('locationConsent', input.locationConsent === true, false),
  };
  const notificationPrefs = sanitizePrefs(payload.notificationPrefs, NOTIFICATION_PREF_KEYS);
  if (notificationPrefs !== undefined) data.notificationPrefs = notificationPrefs;
  const privacyPrefs = sanitizePrefs(payload.privacyPrefs, PRIVACY_PREF_KEYS);
  if (privacyPrefs !== undefined) data.privacyPrefs = privacyPrefs;
  if (payload.onboardingComplete === true) data.onboardingComplete = true;
  if (typeof payload.avatarFileId === 'string' && payload.avatarFileId) data.avatarFileId = payload.avatarFileId;

  let profile;
  if (existing) {
    profile = await ctx.store.update('profiles', ctx.userId, data);
  } else {
    profile = await ctx.store.create(
      'profiles',
      ctx.userId,
      { ...data, verificationStatus: 'not_submitted', onboardingComplete: data.onboardingComplete === true },
      ownerReadPerms(ctx.userId),
    );
  }

  let donor = await syncDonorProfile(ctx, profile);
  if (donor && typeof payload.notificationPrefs === 'object' && payload.notificationPrefs && 'emergencyRequests' in payload.notificationPrefs) {
    const wanted = payload.notificationPrefs.emergencyRequests === true;
    if (donor.emergencyAlerts !== wanted) donor = await ctx.store.update('donor_profiles', ctx.userId, { emergencyAlerts: wanted });
  }
  if (!existing) await audit(ctx, 'profile.created', 'profile', ctx.userId, 'Profile created');
  return { profile, donor };
}

async function updateAvailability(ctx, payload) {
  const result = domain.validateAvailability(payload || {}, ctx.now());
  if (!result.ok) throw validation(result.errors);
  const input = result.value;

  const profile = await ctx.store.get('profiles', ctx.userId);
  if (!profile) throw notFound('Complete your profile before setting availability.');
  if (!profile.bloodGroup) {
    throw validation({ bloodGroup: 'Add your blood group to your profile first.' }, 'Add your blood group first.');
  }

  let donor = await ctx.store.get('donor_profiles', ctx.userId);
  const base = donorDataFromProfile(profile);
  delete base.verificationStatus;
  const now = iso(ctx.now());
  const data = {
    ...base,
    availability: input.availability,
    availabilityUpdatedAt: now,
    availableUntil: input.availability === 'available' ? input.availableUntil : null,
    radiusKm: Math.round(input.radiusKm),
    emergencyAlerts: input.emergencyAlerts,
  };
  if (payload && payload.lastDonationDate !== undefined) {
    if (payload.lastDonationDate === null) data.lastDonationDate = null;
    else {
      const t = new Date(payload.lastDonationDate).getTime();
      if (Number.isNaN(t) || t > ctx.now().getTime()) {
        throw validation({ lastDonationDate: 'Enter a valid past date.' });
      }
      data.lastDonationDate = new Date(t).toISOString();
    }
  }

  if (donor) donor = await ctx.store.update('donor_profiles', ctx.userId, data);
  else {
    donor = await ctx.store.create(
      'donor_profiles',
      ctx.userId,
      { ...data, donationCount: 0, verificationStatus: 'not_submitted' },
      ownerReadPerms(ctx.userId),
    );
  }
  const prefs = parsePrefs(profile.notificationPrefs);
  const profileUpdate = {};
  if (!profile.isDonor) profileUpdate.isDonor = true;
  if (prefs.emergencyRequests !== input.emergencyAlerts) {
    profileUpdate.notificationPrefs = JSON.stringify({ ...prefs, emergencyRequests: input.emergencyAlerts });
  }
  if (Object.keys(profileUpdate).length) await ctx.store.update('profiles', ctx.userId, profileUpdate);

  let offered = 0;
  if (input.availability === 'available' && input.emergencyAlerts) {
    const { offerOpenRequestsToDonor } = require('./request');
    offered = await offerOpenRequestsToDonor(ctx, donor);
  }
  return { donor, offeredRequests: offered };
}

module.exports = { saveProfile, updateAvailability, syncDonorProfile, parsePrefs };
