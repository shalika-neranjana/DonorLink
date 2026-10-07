const { ID, Permission, Role, Query } = require('node-appwrite');
const domain = require('./domain');
const { forbidden, notFound, conflict } = require('./errors');

const DEFAULT_SETTINGS = {
  defaultRadiusKm: 30,
  requestExpiryHours: 72,
  maxDonorsContacted: 5,
  requireVerifiedDonors: false,
  maintenanceMode: false,
};

/**
 * Builds the per-invocation context handed to every handler.
 * `userId` is the authenticated Appwrite user (from the trusted
 * x-appwrite-user-id header), never anything the client sends in the body.
 */
function createContext({ store, users, storage, userId, user, now = () => new Date(), log = () => {}, trigger = 'http' }) {
  const labels = (user && user.labels) || [];
  return {
    store,
    users,
    storage,
    userId,
    user,
    labels,
    trigger,
    isAdmin: domain.isAdmin(labels),
    now,
    log,
    settingsCache: null,
  };
}

// --- helpers ---------------------------------------------------------------

const iso = (date) => date.toISOString();

function shortName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Donor';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

async function getSettings(ctx) {
  if (ctx.settingsCache) return ctx.settingsCache;
  const row = await ctx.store.get('system_settings', 'global');
  ctx.settingsCache = { ...DEFAULT_SETTINGS, ...(row || {}) };
  return ctx.settingsCache;
}

function orgAdminPerms(organizationId) {
  return organizationId ? [Permission.read(Role.label(domain.organizationLabel(organizationId)))] : [];
}

/** Read permissions for rows tied to a request (responses, donations). */
function requestRowPerms({ donorId, requesterId, hospitalId, write = false }) {
  const perms = [
    Permission.read(Role.user(requesterId)),
    Permission.read(Role.label(domain.LABEL_ADMIN)),
    ...orgAdminPerms(hospitalId),
  ];
  if (donorId) perms.push(Permission.read(Role.user(donorId)));
  void write;
  return Array.from(new Set(perms));
}

function requestPerms({ requesterId, hospitalId }) {
  return [
    Permission.read(Role.user(requesterId)),
    Permission.read(Role.label(domain.LABEL_ADMIN)),
    ...orgAdminPerms(hospitalId),
  ];
}

const ownerReadPerms = (userId) => [Permission.read(Role.user(userId)), Permission.read(Role.label(domain.LABEL_ADMIN))];

async function audit(ctx, action, entityType, entityId, summary, metadata) {
  try {
    await ctx.store.create(
      'audit_logs',
      ID.unique(),
      {
        actorId: ctx.userId || 'system',
        actorRole: ctx.isAdmin ? 'admin' : ctx.userId ? 'user' : 'system',
        action,
        entityType,
        entityId,
        summary: String(summary).slice(0, 300),
        metadata: metadata ? JSON.stringify(metadata).slice(0, 1000) : undefined,
      },
      [Permission.read(Role.label(domain.LABEL_ADMIN))],
    );
  } catch (error) {
    ctx.log(`audit failed for ${action}: ${error && error.message}`);
  }
}

const PREF_BY_CATEGORY = {
  emergency: 'emergencyRequests',
  requests: 'requestUpdates',
  donations: 'donationUpdates',
  account: 'accountAlerts',
};

/** Respects the recipient's notification preferences (stored on their profile). */
async function wantsNotification(ctx, userId, draft) {
  const profile = await ctx.store.get('profiles', userId);
  if (!profile || !profile.notificationPrefs) return true;
  let prefs = {};
  try {
    prefs = JSON.parse(profile.notificationPrefs);
  } catch {
    return true;
  }
  const key = draft.type === 'reminder' ? 'reminders' : PREF_BY_CATEGORY[draft.category];
  return prefs[key] !== false;
}

async function notify(ctx, userId, type, context) {
  if (!userId) return null;
  try {
    const draft = domain.buildNotification(type, context);
    if (!(await wantsNotification(ctx, userId, draft))) return null;
    return await ctx.store.create(
      'notifications',
      ID.unique(),
      {
        userId,
        type: draft.type,
        category: draft.category,
        title: draft.title.slice(0, 120),
        body: draft.body.slice(0, 400),
        route: draft.route.slice(0, 200),
        actionLabel: draft.actionLabel,
        requestId: context && context.requestId,
        read: false,
      },
      // Read-only for the owner: marking read goes through `notifications.markRead`.
      [Permission.read(Role.user(userId))],
    );
  } catch (error) {
    ctx.log(`notify failed (${type}): ${error && error.message}`);
    return null;
  }
}

async function organizationMemberIds(ctx, organizationId) {
  if (!organizationId) return [];
  const members = await ctx.store.listAll('organization_members', [
    Query.equal('organizationId', [organizationId]),
    Query.equal('active', [true]),
  ]);
  return members.map((m) => m.userId);
}

async function notifyOrganization(ctx, organizationId, type, context, exceptUserId) {
  const ids = await organizationMemberIds(ctx, organizationId);
  for (const id of ids) {
    if (id !== exceptUserId) await notify(ctx, id, type, context);
  }
}

// --- request helpers ---------------------------------------------------------

function notificationContext(request, extra = {}) {
  return {
    requestId: request.$id,
    bloodGroup: request.bloodGroup,
    units: request.units,
    urgency: request.urgency,
    hospitalName: request.hospitalName,
    ...extra,
  };
}

function serializeHistory(history) {
  let entries = history;
  let text = JSON.stringify(entries);
  while (text.length > 5800 && entries.length > 2) {
    entries = entries.slice(1);
    text = JSON.stringify(entries);
  }
  return text;
}

/** Applies a validated request status transition and records history. */
async function transitionRequest(ctx, request, to, note, extra = {}) {
  domain.assertRequestTransition(request.status, to);
  const history = domain.parseStatusHistory(request.statusHistory);
  history.push({ status: to, at: iso(ctx.now()), ...(note ? { note: String(note).slice(0, 120) } : {}) });
  return ctx.store.update('blood_requests', request.$id, {
    ...extra,
    status: to,
    statusHistory: serializeHistory(history),
  });
}

async function loadRequest(ctx, requestId) {
  if (typeof requestId !== 'string' || !requestId) throw notFound('Request not found.');
  const request = await ctx.store.get('blood_requests', requestId);
  if (!request) throw notFound('Request not found.');
  return request;
}

function accessContext(ctx, request) {
  return {
    userId: ctx.userId,
    labels: ctx.labels,
    requesterId: request.requesterId,
    hospitalOrganizationId: request.hospitalId || null,
  };
}

async function orgMembership(ctx, organizationId, userId = ctx.userId) {
  return ctx.store.first('organization_members', [
    Query.equal('organizationId', [organizationId]),
    Query.equal('userId', [userId]),
    Query.equal('active', [true]),
  ]);
}

/** Admin, or an org-admin member of the organization. */
async function requireOrgAdmin(ctx, organizationId) {
  if (ctx.isAdmin) return;
  const membership = await orgMembership(ctx, organizationId);
  if (!membership || membership.role !== 'admin') throw forbidden('Only organization admins can do that.');
}

/** Admin, or any active member of the organization. */
async function requireOrgMember(ctx, organizationId) {
  if (ctx.isAdmin) return;
  if (!domain.isOrganizationMember(ctx.labels, organizationId)) {
    throw forbidden('You are not a member of this organization.');
  }
  const membership = await orgMembership(ctx, organizationId);
  if (!membership) throw forbidden('You are not a member of this organization.');
}

function requireAdmin(ctx) {
  if (!ctx.isAdmin) throw forbidden('Administrator access required.');
}

function requireFields(payload, keys) {
  const missing = {};
  for (const key of keys) {
    if (payload == null || payload[key] === undefined || payload[key] === null || payload[key] === '') {
      missing[key] = 'This field is required.';
    }
  }
  if (Object.keys(missing).length) {
    const { validation } = require('./errors');
    throw validation(missing);
  }
}

function isValidRowId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/.test(value);
}

module.exports = {
  DEFAULT_SETTINGS,
  createContext,
  iso,
  shortName,
  getSettings,
  requestRowPerms,
  requestPerms,
  ownerReadPerms,
  audit,
  notify,
  notifyOrganization,
  organizationMemberIds,
  notificationContext,
  transitionRequest,
  loadRequest,
  accessContext,
  orgMembership,
  requireOrgAdmin,
  requireOrgMember,
  requireAdmin,
  requireFields,
  isValidRowId,
  conflict,
};
