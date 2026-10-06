const { ID, Query, Permission, Role } = require('node-appwrite');
const domain = require('../lib/domain');
const { validation, notFound, conflict, forbidden } = require('../lib/errors');
const {
  audit,
  notify,
  requireOrgAdmin,
  requireOrgMember,
  requireFields,
  orgMembership,
} = require('../lib/context');

const inventoryPerms = (organizationId) => [
  Permission.read(Role.label(domain.organizationLabel(organizationId))),
  Permission.read(Role.label(domain.LABEL_ADMIN)),
];

async function updateInventory(ctx, payload) {
  requireFields(payload, ['organizationId']);
  await requireOrgMember(ctx, payload.organizationId);
  const org = await ctx.store.get('organizations', payload.organizationId);
  if (!org) throw notFound('Organization not found.');
  if (org.verificationStatus !== 'verified' && !ctx.isAdmin) {
    throw forbidden('Your organization must be verified before it can manage inventory.');
  }

  const result = domain.validateInventory(payload.item || {});
  if (!result.ok) throw validation(result.errors);
  const item = result.value;

  const existing = await ctx.store.first('blood_inventory', [
    Query.equal('organizationId', [org.$id]),
    Query.equal('bloodGroup', [item.bloodGroup]),
    Query.equal('component', [item.component]),
  ]);
  const data = {
    unitsAvailable: item.unitsAvailable,
    unitsReserved: item.unitsReserved,
    lowStockThreshold: item.lowStockThreshold,
    updatedBy: ctx.userId,
  };
  let row;
  if (existing) row = await ctx.store.update('blood_inventory', existing.$id, data);
  else {
    row = await ctx.store.create(
      'blood_inventory',
      ID.unique(),
      { organizationId: org.$id, bloodGroup: item.bloodGroup, component: item.component, ...data },
      inventoryPerms(org.$id),
    );
  }
  const before = existing ? existing.unitsAvailable : 0;
  await audit(
    ctx,
    'inventory.updated',
    'blood_inventory',
    row.$id,
    `${org.name}: ${item.bloodGroup} ${item.component} ${before} -> ${item.unitsAvailable} units`,
  );
  return { item: row };
}

async function updateOrganizationProfile(ctx, payload) {
  requireFields(payload, ['organizationId']);
  await requireOrgAdmin(ctx, payload.organizationId);
  const org = await ctx.store.get('organizations', payload.organizationId);
  if (!org) throw notFound('Organization not found.');

  const errors = {};
  const data = {};
  if (payload.phone !== undefined) {
    if (!domain.isValidPhone(String(payload.phone))) errors.phone = 'Enter a valid phone number.';
    else data.phone = domain.normalizePhone(String(payload.phone));
  }
  if (payload.address !== undefined) {
    const address = String(payload.address).trim();
    if (address.length > 200) errors.address = 'Address must be 200 characters or fewer.';
    else data.address = address || null;
  }
  if (payload.city !== undefined) data.city = String(payload.city).trim().slice(0, 60) || null;
  if (Object.keys(errors).length) throw validation(errors);
  if (Object.keys(data).length === 0) throw validation({ phone: 'Nothing to update.' });

  const updated = await ctx.store.update('organizations', org.$id, data);
  await audit(ctx, 'organization.updated', 'organization', org.$id, `${org.name} profile updated`);
  return { organization: updated };
}

async function addMember(ctx, payload) {
  requireFields(payload, ['organizationId', 'email']);
  await requireOrgAdmin(ctx, payload.organizationId);
  const org = await ctx.store.get('organizations', payload.organizationId);
  if (!org) throw notFound('Organization not found.');
  const role = payload.role || 'staff';
  if (!domain.ORGANIZATION_MEMBER_ROLES.includes(role)) throw validation({ role: 'Choose a valid role.' });
  const emailError = domain.validateEmailField(payload.email);
  if (emailError) throw validation({ email: emailError });

  const found = await ctx.users.list({ queries: [Query.equal('email', [String(payload.email).trim().toLowerCase()]), Query.limit(1)] });
  const user = found.users[0];
  if (!user) throw notFound('No DonorLink account uses that email. Ask them to register first.');
  if (user.status === false) throw conflict('user_disabled', 'That account is disabled.');

  const existing = await orgMembership(ctx, org.$id, user.$id);
  if (existing) throw conflict('already_member', 'That person is already a member.');

  const inactive = await ctx.store.first('organization_members', [
    Query.equal('organizationId', [org.$id]),
    Query.equal('userId', [user.$id]),
  ]);
  const perms = [
    Permission.read(Role.user(user.$id)),
    Permission.read(Role.label(domain.LABEL_ADMIN)),
    Permission.read(Role.label(domain.organizationLabel(org.$id))),
  ];
  let member;
  if (inactive) member = await ctx.store.update('organization_members', inactive.$id, { role, active: true });
  else {
    member = await ctx.store.create(
      'organization_members',
      ID.unique(),
      { organizationId: org.$id, userId: user.$id, displayName: user.name || user.email, role, active: true },
      perms,
    );
  }
  await ctx.users.updateLabels({ userId: user.$id, labels: domain.withOrganizationMembership(user.labels || [], org.$id, true) });
  await notify(ctx, user.$id, 'organization_update', { note: `You were added to ${org.name} as ${role}.` });
  await audit(ctx, 'organization.member_added', 'organization', org.$id, `Added a ${role} to ${org.name}`);
  return { member };
}

async function removeMember(ctx, payload) {
  requireFields(payload, ['organizationId', 'userId']);
  await requireOrgAdmin(ctx, payload.organizationId);
  const membership = await orgMembership(ctx, payload.organizationId, payload.userId);
  if (!membership) throw notFound('That person is not a member.');
  if (membership.role === 'admin') {
    const admins = await ctx.store.count('organization_members', [
      Query.equal('organizationId', [payload.organizationId]),
      Query.equal('role', ['admin']),
      Query.equal('active', [true]),
    ]);
    if (admins <= 1) throw conflict('last_admin', 'An organization needs at least one admin.');
  }
  await ctx.store.update('organization_members', membership.$id, { active: false });
  const user = await ctx.users.get({ userId: payload.userId });
  await ctx.users.updateLabels({
    userId: payload.userId,
    labels: domain.withOrganizationMembership(user.labels || [], payload.organizationId, false),
  });
  await audit(ctx, 'organization.member_removed', 'organization', payload.organizationId, 'Removed an organization member');
  return { removed: true };
}

module.exports = { updateInventory, updateOrganizationProfile, addMember, removeMember };
