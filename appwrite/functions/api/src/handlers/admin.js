const { ID, Query } = require('node-appwrite');
const domain = require('../lib/domain');
const { validation, notFound, conflict } = require('../lib/errors');
const { audit, requireAdmin, requireFields, getSettings, DEFAULT_SETTINGS } = require('../lib/context');

const sanitizeUser = (u) => ({
  id: u.$id,
  name: u.name,
  email: u.email,
  enabled: u.status !== false,
  emailVerified: !!u.emailVerification,
  labels: u.labels || [],
  registeredAt: u.registration || u.$createdAt,
});

async function listUsers(ctx, payload) {
  requireAdmin(ctx);
  const limit = Math.max(1, Math.min(50, Number(payload && payload.limit) || 25));
  const queries = [Query.limit(limit), Query.orderDesc('$createdAt')];
  if (payload && payload.cursor) queries.push(Query.cursorAfter(String(payload.cursor)));
  const search = payload && typeof payload.search === 'string' && payload.search.trim() ? payload.search.trim() : undefined;
  const result = await ctx.users.list({ queries, search });
  return { users: result.users.map(sanitizeUser), total: result.total };
}

async function getUser(ctx, payload) {
  requireAdmin(ctx);
  requireFields(payload, ['userId']);
  let user;
  try {
    user = await ctx.users.get({ userId: payload.userId });
  } catch {
    throw notFound('User not found.');
  }
  const [profile, donor, requests, donations, verifications] = await Promise.all([
    ctx.store.get('profiles', user.$id),
    ctx.store.get('donor_profiles', user.$id),
    ctx.store.count('blood_requests', [Query.equal('requesterId', [user.$id])]),
    ctx.store.count('donations', [Query.equal('donorId', [user.$id])]),
    ctx.store.list('verifications', [Query.equal('userId', [user.$id]), Query.orderDesc('$createdAt')], 10),
  ]);
  return {
    user: sanitizeUser(user),
    profile: profile && {
      displayName: profile.displayName,
      bloodGroup: profile.bloodGroup,
      district: profile.district,
      isDonor: profile.isDonor,
      verificationStatus: profile.verificationStatus,
      onboardingComplete: profile.onboardingComplete,
    },
    donor: donor && {
      availability: donor.availability,
      donationCount: donor.donationCount,
      verificationStatus: donor.verificationStatus,
    },
    counts: { requests, donations },
    verifications,
  };
}

async function setAdminRole(ctx, payload) {
  requireAdmin(ctx);
  requireFields(payload, ['userId']);
  if (typeof payload.admin !== 'boolean') throw validation({ admin: 'Choose whether this user is an admin.' });
  if (payload.userId === ctx.userId) throw conflict('self_change', 'You cannot change your own admin access.');
  const user = await ctx.users.get({ userId: payload.userId }).catch(() => null);
  if (!user) throw notFound('User not found.');
  await ctx.users.updateLabels({ userId: user.$id, labels: domain.withAdmin(user.labels || [], payload.admin) });
  await audit(ctx, payload.admin ? 'admin.granted' : 'admin.revoked', 'user', user.$id, `${payload.admin ? 'Granted' : 'Revoked'} admin access`);
  return { userId: user.$id, admin: payload.admin };
}

async function setUserStatus(ctx, payload) {
  requireAdmin(ctx);
  requireFields(payload, ['userId']);
  if (typeof payload.enabled !== 'boolean') throw validation({ enabled: 'Choose enable or disable.' });
  if (payload.userId === ctx.userId) throw conflict('self_change', 'You cannot disable your own account.');
  const user = await ctx.users.get({ userId: payload.userId }).catch(() => null);
  if (!user) throw notFound('User not found.');
  await ctx.users.updateStatus({ userId: user.$id, status: payload.enabled });
  await audit(ctx, payload.enabled ? 'user.enabled' : 'user.disabled', 'user', user.$id, `${payload.enabled ? 'Enabled' : 'Disabled'} account`);
  return { userId: user.$id, enabled: payload.enabled };
}

async function analytics(ctx) {
  requireAdmin(ctx);
  const store = ctx.store;
  const byStatus = {};
  for (const status of domain.REQUEST_STATUSES) {
    byStatus[status] = await store.count('blood_requests', [Query.equal('status', [status])]);
  }
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const active = domain.ACTIVE_REQUEST_STATUSES.reduce((sum, s) => sum + byStatus[s], 0);

  const days = [];
  const today = new Date(ctx.now());
  today.setUTCHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const start = new Date(today.getTime() - i * 864e5);
    const end = new Date(start.getTime() + 864e5);
    const count = await store.count('blood_requests', [
      Query.greaterThanEqual('$createdAt', start.toISOString()),
      Query.lessThan('$createdAt', end.toISOString()),
    ]);
    days.push({ date: start.toISOString().slice(0, 10), count });
  }

  const [pendingResp, acceptedResp, declinedResp, completedResp, totalResp] = await Promise.all([
    store.count('request_responses', [Query.equal('status', ['pending'])]),
    store.count('request_responses', [Query.equal('status', ['accepted'])]),
    store.count('request_responses', [Query.equal('status', ['declined'])]),
    store.count('request_responses', [Query.equal('status', ['completed'])]),
    store.count('request_responses'),
  ]);
  const answered = acceptedResp + declinedResp + completedResp;
  const positive = acceptedResp + completedResp;

  const [users, donorsTotal, donorsAvailable, donorsVerified, donationsCompleted, donationsOpen, orgsVerified, orgsTotal, verificationsPending, notificationsTotal, notificationsRead] =
    await Promise.all([
      ctx.users.list({ queries: [Query.limit(1)] }).then((r) => r.total),
      store.count('donor_profiles'),
      store.count('donor_profiles', [Query.equal('availability', ['available'])]),
      store.count('donor_profiles', [Query.equal('verificationStatus', ['verified'])]),
      store.count('donations', [Query.equal('status', ['completed'])]),
      store.count('donations', [Query.equal('status', ['scheduled'])]),
      store.count('organizations', [Query.equal('verificationStatus', ['verified'])]),
      store.count('organizations'),
      store.count('verifications', [Query.equal('status', ['pending'])]),
      store.count('notifications'),
      store.count('notifications', [Query.equal('read', [true])]),
    ]);

  const inventory = await store.listAll('blood_inventory', [], 500);
  let lowStock = 0;
  let outOfStock = 0;
  for (const row of inventory) {
    const state = domain.stockState(row.unitsAvailable, row.unitsReserved, row.lowStockThreshold ?? 5);
    if (state === 'out') outOfStock += 1;
    else if (state === 'critical' || state === 'low') lowStock += 1;
  }

  return {
    generatedAt: ctx.now().toISOString(),
    users,
    requests: { total, active, completed: byStatus.completed, byStatus, last7Days: days },
    donors: { registered: donorsTotal, availableNow: donorsAvailable, verified: donorsVerified },
    responses: {
      total: totalResp,
      pending: pendingResp,
      accepted: acceptedResp + completedResp,
      declined: declinedResp,
      acceptanceRate: answered > 0 ? Math.round((positive / answered) * 100) : null,
    },
    donations: { completed: donationsCompleted, open: donationsOpen },
    organizations: { verified: orgsVerified, total: orgsTotal },
    verifications: { pending: verificationsPending },
    notifications: { sent: notificationsTotal, read: notificationsRead },
    inventory: { items: inventory.length, lowStock, outOfStock },
  };
}

async function upsertOrganization(ctx, payload) {
  requireAdmin(ctx);
  const errors = {};
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name) errors.name = 'Name is required.';
  if (!domain.ORGANIZATION_TYPES.includes(payload.type)) errors.type = 'Choose an organization type.';
  if (!domain.findDistrict(payload.district)) errors.district = 'Choose a district from the list.';
  if (payload.phone && !domain.isValidPhone(String(payload.phone))) errors.phone = 'Enter a valid phone number.';
  if (payload.verificationStatus && !domain.VERIFICATION_STATUSES.includes(payload.verificationStatus)) {
    errors.verificationStatus = 'Choose a valid status.';
  }
  if (Object.keys(errors).length) throw validation(errors);

  const centre = domain.districtCentre(payload.district);
  const data = {
    name,
    type: payload.type,
    district: payload.district,
    city: payload.city ? String(payload.city).slice(0, 60) : null,
    address: payload.address ? String(payload.address).slice(0, 200) : null,
    phone: payload.phone ? domain.normalizePhone(String(payload.phone)) : null,
  };
  if (payload.verificationStatus) data.verificationStatus = payload.verificationStatus;

  if (payload.organizationId) {
    const existing = await ctx.store.get('organizations', payload.organizationId);
    if (!existing) throw notFound('Organization not found.');
    const updated = await ctx.store.update('organizations', existing.$id, data);
    await audit(ctx, 'organization.updated', 'organization', existing.$id, `${name} updated by admin`);
    return { organization: updated };
  }
  const created = await ctx.store.create('organizations', ID.unique(), {
    ...data,
    approxLat: centre ? centre.lat : null,
    approxLng: centre ? centre.lng : null,
    verificationStatus: data.verificationStatus || 'not_submitted',
    claimed: false,
  });
  await audit(ctx, 'organization.created', 'organization', created.$id, `${name} added to the directory`);
  return { organization: created };
}

async function updateSettings(ctx, payload) {
  requireAdmin(ctx);
  const errors = {};
  const data = {};
  const int = (key, label, min, max) => {
    if (payload[key] === undefined) return;
    const v = payload[key];
    if (!Number.isInteger(v) || v < min || v > max) errors[key] = `${label} must be a whole number between ${min} and ${max}.`;
    else data[key] = v;
  };
  int('defaultRadiusKm', 'Default radius', 1, 100);
  int('requestExpiryHours', 'Request expiry', 1, 720);
  int('maxDonorsContacted', 'Donors contacted', 1, 50);
  for (const key of ['requireVerifiedDonors', 'maintenanceMode']) {
    if (payload[key] === undefined) continue;
    if (typeof payload[key] !== 'boolean') errors[key] = 'Choose on or off.';
    else data[key] = payload[key];
  }
  if (Object.keys(errors).length) throw validation(errors);
  if (Object.keys(data).length === 0) throw validation({ defaultRadiusKm: 'Nothing to update.' });
  data.updatedBy = ctx.userId;
  const existing = await ctx.store.get('system_settings', 'global');
  const settings = existing
    ? await ctx.store.update('system_settings', 'global', data)
    : await ctx.store.create('system_settings', 'global', { ...DEFAULT_SETTINGS, ...data });
  ctx.settingsCache = null;
  await audit(ctx, 'settings.updated', 'system_settings', 'global', 'Platform settings changed', data);
  return { settings };
}

module.exports = {
  listUsers,
  getUser,
  setAdminRole,
  setUserStatus,
  analytics,
  upsertOrganization,
  updateSettings,
  getSettings,
};
