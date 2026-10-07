const { ID, Query, Permission, Role } = require('node-appwrite');
const domain = require('../lib/domain');
const { validation, forbidden, conflict } = require('../lib/errors');
const {
  audit,
  notify,
  notifyOrganization,
  notificationContext,
  getSettings,
  requestPerms,
  requestRowPerms,
  transitionRequest,
  loadRequest,
  accessContext,
  isValidRowId,
  iso,
  requireFields,
} = require('../lib/context');

const OPEN_FOR_DONORS = ['matching', 'donors_contacted', 'partially_fulfilled'];
const EXPIRY_HOURS = { critical: 24, urgent: 48 };

// --- candidates -------------------------------------------------------------

function toCandidate(row) {
  return {
    donorId: row.donorId,
    displayName: row.displayName,
    bloodGroup: row.bloodGroup,
    availability: row.availability,
    availabilityUpdatedAt: row.availabilityUpdatedAt,
    availableUntil: row.availableUntil,
    radiusKm: row.radiusKm ?? 15,
    emergencyAlerts: row.emergencyAlerts !== false,
    location: row.approxLat != null && row.approxLng != null ? { lat: row.approxLat, lng: row.approxLng } : null,
    verificationStatus: row.verificationStatus || 'not_submitted',
    lastDonationDate: row.lastDonationDate,
    donationCount: row.donationCount ?? 0,
  };
}

function matchInput(request) {
  return {
    requesterId: request.requesterId,
    bloodGroup: request.bloodGroup,
    urgency: request.urgency,
    location:
      request.approxLat != null && request.approxLng != null
        ? { lat: request.approxLat, lng: request.approxLng }
        : null,
  };
}

async function loadCandidates(ctx, request) {
  const groups = [...domain.compatibleDonorGroups(request.bloodGroup)];
  const rows = await ctx.store.listAll(
    'donor_profiles',
    [Query.equal('availability', ['available']), Query.equal('bloodGroup', groups)],
    300,
  );
  return rows.map(toCandidate);
}

// --- contacting donors -------------------------------------------------------

async function contactDonor(ctx, request, match) {
  const existing = await ctx.store.first('request_responses', [
    Query.equal('requestId', [request.$id]),
    Query.equal('donorId', [match.donorId]),
  ]);
  if (existing) return { response: null, request };

  const response = await ctx.store.create(
    'request_responses',
    ID.unique(),
    {
      requestId: request.$id,
      donorId: match.donorId,
      donorName: match.displayName,
      donorBloodGroup: match.bloodGroup,
      requesterId: request.requesterId,
      hospitalId: request.hospitalId || null,
      status: 'pending',
      matchQuality: match.quality,
      distanceKm: match.distanceKm,
    },
    requestRowPerms({ donorId: match.donorId, requesterId: request.requesterId, hospitalId: request.hospitalId }),
  );

  // Contacted donors may read the request they were asked to help with.
  const permissions = Array.from(new Set([...(request.$permissions || []), Permission.read(Role.user(match.donorId))]));
  await ctx.store.update('blood_requests', request.$id, {}, permissions);
  const updated = await ctx.store.increment('blood_requests', request.$id, 'contactedCount');

  await notify(ctx, match.donorId, 'emergency_request', notificationContext(request, { distanceKm: match.distanceKm }));
  return { response, request: updated };
}

/** Runs matching for a verified request and contacts the best donors. */
async function startMatching(ctx, request) {
  let current = request;
  if (current.status === 'verified') current = await transitionRequest(ctx, current, 'matching', 'Finding donors');

  const settings = await getSettings(ctx);
  const candidates = await loadCandidates(ctx, current);
  const ranked = domain.rankCandidates(candidates, matchInput(current), {
    now: ctx.now(),
    maxRadiusKm: settings.defaultRadiusKm,
    minVerification: settings.requireVerifiedDonors ? 'verified' : 'any',
    limit: settings.maxDonorsContacted,
  });

  let contacted = 0;
  for (const match of ranked) {
    const result = await contactDonor(ctx, current, match);
    if (result.response) {
      contacted += 1;
      current = result.request;
    }
  }

  if (contacted > 0 && current.status === 'matching') {
    current = await transitionRequest(ctx, current, 'donors_contacted', `${contacted} donor${contacted === 1 ? '' : 's'} contacted`);
    await notify(
      ctx,
      current.requesterId,
      'request_status_changed',
      notificationContext(current, { status: domain.REQUEST_STATUS_LABELS.donors_contacted }),
    );
  }
  return { request: current, contacted };
}

/** When a donor becomes available, offer them still-open compatible requests. */
async function offerOpenRequestsToDonor(ctx, donorRow) {
  const recipients = domain.recipientGroupsFor(donorRow.bloodGroup);
  if (recipients.length === 0) return 0;
  const open = await ctx.store.list(
    'blood_requests',
    [Query.equal('status', OPEN_FOR_DONORS), Query.equal('bloodGroup', recipients), Query.orderDesc('$createdAt')],
    20,
  );
  const settings = await getSettings(ctx);
  const candidate = toCandidate(donorRow);
  let offered = 0;
  for (const request of open) {
    if ((request.unitsAccepted || 0) >= request.units) continue;
    if (request.expiresAt && new Date(request.expiresAt).getTime() < ctx.now().getTime()) continue;
    const match = domain.evaluateCandidate(candidate, matchInput(request), {
      now: ctx.now(),
      maxRadiusKm: settings.defaultRadiusKm,
      minVerification: settings.requireVerifiedDonors ? 'verified' : 'any',
    });
    if (!match) continue;
    const result = await contactDonor(ctx, request, match);
    if (result.response) {
      offered += 1;
      if (result.request.status === 'matching') {
        await transitionRequest(ctx, result.request, 'donors_contacted', '1 donor contacted');
      }
    }
  }
  return offered;
}

// --- create ---------------------------------------------------------------

async function createRequest(ctx, payload) {
  const result = domain.validateCreateRequest(payload && payload.request ? payload.request : {}, ctx.now());
  if (!result.ok) throw validation(result.errors);
  const input = result.value;

  const profile = await ctx.store.get('profiles', ctx.userId);
  const requesterName = (profile && profile.displayName) || (ctx.user && ctx.user.name) || 'Requester';

  let org = null;
  if (input.hospitalId) {
    org = await ctx.store.get('organizations', input.hospitalId);
    if (!org) throw validation({ hospitalName: 'Choose a hospital from the list.' });
  }

  const requestId = isValidRowId(payload.clientId) ? payload.clientId : ID.unique();
  const duplicate = await ctx.store.get('blood_requests', requestId);
  if (duplicate) {
    if (duplicate.requesterId !== ctx.userId) throw forbidden();
    return { request: duplicate, duplicate: true };
  }

  // Protect against accidental double submissions with a different id.
  const recent = await ctx.store.list(
    'blood_requests',
    [Query.equal('requesterId', [ctx.userId]), Query.equal('status', domain.ACTIVE_REQUEST_STATUSES), Query.orderDesc('$createdAt')],
    5,
  );
  const cutoff = ctx.now().getTime() - 15 * 60_000;
  const similar = recent.find(
    (r) =>
      r.bloodGroup === input.bloodGroup &&
      r.hospitalName === input.hospitalName &&
      new Date(r.$createdAt).getTime() > cutoff,
  );
  if (similar) {
    throw conflict('duplicate_request', 'You already submitted a similar request a moment ago. Open it from My requests.');
  }

  let location = null;
  if (org && org.approxLat != null && org.approxLng != null) location = { lat: org.approxLat, lng: org.approxLng };
  else if (input.location) location = domain.coarsenCoordinates(input.location);
  else location = domain.districtCentre(input.district) || null;

  const settings = await getSettings(ctx);
  const now = ctx.now();
  const baseHours = EXPIRY_HOURS[input.urgency] ?? settings.requestExpiryHours;
  const expiresAt = input.requiredBy
    ? new Date(new Date(input.requiredBy).getTime() + 12 * 36e5)
    : new Date(now.getTime() + baseHours * 36e5);

  const autoVerify =
    ctx.isAdmin || (!!org && org.verificationStatus === 'verified' && domain.isOrganizationMember(ctx.labels, org.$id));

  let request = await ctx.store.create(
    'blood_requests',
    requestId,
    {
      requesterId: ctx.userId,
      requesterName,
      bloodGroup: input.bloodGroup,
      units: input.units,
      unitsAccepted: 0,
      unitsCompleted: 0,
      contactedCount: 0,
      urgency: input.urgency,
      status: 'submitted',
      verificationStatus: 'pending',
      hospitalId: org ? org.$id : null,
      hospitalName: input.hospitalName,
      district: input.district,
      city: input.city ?? (org ? org.city : null) ?? null,
      wardUnit: input.wardUnit ?? null,
      approxLat: location ? location.lat : null,
      approxLng: location ? location.lng : null,
      requiredBy: input.requiredBy ?? null,
      expiresAt: iso(expiresAt),
      notes: input.notes ?? null,
      relationship: input.relationship ?? null,
      statusHistory: JSON.stringify([{ status: 'submitted', at: iso(now) }]),
    },
    requestPerms({ requesterId: ctx.userId, hospitalId: org ? org.$id : null }),
  );

  await audit(ctx, 'request.created', 'blood_request', request.$id, `${input.urgency} request for ${input.units} x ${input.bloodGroup} at ${input.hospitalName}`);

  if (autoVerify) {
    request = await applyVerification(ctx, request, true, 'Verified by hospital staff');
    const matched = await startMatching(ctx, request);
    request = matched.request;
  } else {
    request = await transitionRequest(ctx, request, 'pending_verification', 'Awaiting verification');
    if (org) {
      await notifyOrganization(ctx, org.$id, 'request_submitted', notificationContext(request, { note: 'A new request needs verification.' }), ctx.userId);
    }
  }
  await notify(ctx, ctx.userId, 'request_submitted', notificationContext(request));
  return { request, duplicate: false };
}

// --- verification -------------------------------------------------------------

async function applyVerification(ctx, request, approve, note) {
  const extra = {
    verificationStatus: approve ? 'verified' : 'rejected',
    verifiedBy: ctx.userId,
    verifiedAt: iso(ctx.now()),
  };
  const next = await transitionRequest(ctx, request, approve ? 'verified' : 'rejected', note, extra);
  await notify(
    ctx,
    next.requesterId,
    approve ? 'request_verified' : 'request_rejected',
    notificationContext(next, { note: approve ? undefined : note }),
  );
  return next;
}

async function verifyRequest(ctx, payload) {
  requireFields(payload, ['requestId']);
  const request = await loadRequest(ctx, payload.requestId);
  if (!domain.canVerifyRequest(accessContext(ctx, request))) {
    throw forbidden('Only the addressed hospital or an administrator can verify this request.');
  }
  if (!['submitted', 'pending_verification'].includes(request.status)) {
    throw conflict('invalid_state', 'This request has already been reviewed.');
  }
  const approve = payload.approve === true;
  const note = typeof payload.note === 'string' ? payload.note.trim().slice(0, 200) : '';
  if (!approve && !note) throw validation({ note: 'Add a short reason so the requester can act on it.' });

  let updated = await applyVerification(ctx, request, approve, approve ? 'Verified' : note);
  await audit(ctx, approve ? 'request.verified' : 'request.rejected', 'blood_request', request.$id, `${approve ? 'Verified' : 'Rejected'} request`, note ? { note } : undefined);

  let contacted = 0;
  if (approve) {
    const matched = await startMatching(ctx, updated);
    updated = matched.request;
    contacted = matched.contacted;
  }
  return { request: updated, contacted };
}

// --- matches ------------------------------------------------------------------

function assertCanManage(ctx, request) {
  const access = accessContext(ctx, request);
  if (!domain.canConfirmDonation(access)) throw forbidden();
}

async function requestMatches(ctx, payload) {
  requireFields(payload, ['requestId']);
  const request = await loadRequest(ctx, payload.requestId);
  assertCanManage(ctx, request);

  const settings = await getSettings(ctx);
  let radius = Number(payload.radiusKm);
  if (!Number.isFinite(radius)) radius = settings.defaultRadiusKm;
  radius = Math.max(5, Math.min(100, radius));
  const minVerification = payload.verifiedOnly === true || settings.requireVerifiedDonors ? 'verified' : 'any';

  const candidates = await loadCandidates(ctx, request);
  const ranked = domain.rankCandidates(candidates, matchInput(request), {
    now: ctx.now(),
    maxRadiusKm: radius,
    minVerification,
    limit: 50,
  });

  const responses = await ctx.store.listAll('request_responses', [Query.equal('requestId', [request.$id])]);
  const byDonor = new Map(responses.map((r) => [r.donorId, r.status]));
  return {
    matches: ranked.map((m) => ({ ...m, responseStatus: byDonor.get(m.donorId) || null })),
    searchedRadiusKm: radius,
    totalCandidates: candidates.length,
    disclaimer: domain.MATCHING_DISCLAIMER,
  };
}

async function contactDonorAction(ctx, payload) {
  requireFields(payload, ['requestId', 'donorId']);
  const request = await loadRequest(ctx, payload.requestId);
  assertCanManage(ctx, request);
  if (!OPEN_FOR_DONORS.includes(request.status) && request.status !== 'verified') {
    throw conflict('invalid_state', 'This request is not open for donors.');
  }
  if ((request.unitsAccepted || 0) >= request.units) {
    throw conflict('enough_donors', 'This request already has enough accepted donors.');
  }

  const donorRow = await ctx.store.get('donor_profiles', payload.donorId);
  if (!donorRow) throw validation({ donorId: 'That donor is not available.' }, 'That donor is not available.');
  const settings = await getSettings(ctx);
  const match = domain.evaluateCandidate(toCandidate(donorRow), matchInput(request), {
    now: ctx.now(),
    maxRadiusKm: Math.max(settings.defaultRadiusKm, 100),
  });
  if (!match) throw conflict('donor_unavailable', 'That donor is no longer available for this request.');

  let current = request;
  if (current.status === 'verified') current = await transitionRequest(ctx, current, 'matching', 'Finding donors');
  const result = await contactDonor(ctx, current, match);
  if (!result.response) throw conflict('already_contacted', 'That donor has already been contacted.');
  current = result.request;
  if (current.status === 'matching') current = await transitionRequest(ctx, current, 'donors_contacted', '1 donor contacted');
  await audit(ctx, 'request.donor_contacted', 'blood_request', request.$id, 'Contacted a donor');
  return { request: current, response: result.response };
}

// --- cancel / complete / expire --------------------------------------------------

async function closeResponses(ctx, request, { notifyAccepted }) {
  const responses = await ctx.store.listAll('request_responses', [Query.equal('requestId', [request.$id])]);
  for (const response of responses) {
    if (response.status === 'pending') {
      await ctx.store.update('request_responses', response.$id, { status: 'expired' });
    } else if (response.status === 'accepted') {
      await ctx.store.update('request_responses', response.$id, { status: 'withdrawn' });
      const donation = await ctx.store.first('donations', [Query.equal('responseId', [response.$id])]);
      if (donation && donation.status === 'scheduled') {
        await ctx.store.update('donations', donation.$id, { status: 'cancelled' });
      }
      if (notifyAccepted) {
        await notify(ctx, response.donorId, 'donation_cancelled', notificationContext(request));
      }
    }
  }
}

async function cancelRequest(ctx, payload) {
  requireFields(payload, ['requestId']);
  const request = await loadRequest(ctx, payload.requestId);
  if (!domain.canCancelRequestAs(accessContext(ctx, request))) {
    throw forbidden('Only the requester can cancel this request.');
  }
  if (!domain.canCancelRequest(request.status)) {
    throw conflict('invalid_state', `This request is already ${domain.REQUEST_STATUS_LABELS[request.status].toLowerCase()} and can't be cancelled.`);
  }
  const reason = typeof payload.reason === 'string' ? payload.reason.trim().slice(0, 200) : '';
  const updated = await transitionRequest(ctx, request, 'cancelled', reason || 'Cancelled by requester', {
    cancelledReason: reason || null,
  });
  await closeResponses(ctx, updated, { notifyAccepted: true });
  await audit(ctx, 'request.cancelled', 'blood_request', request.$id, 'Request cancelled', reason ? { reason } : undefined);
  return { request: updated };
}

async function completeRequest(ctx, payload) {
  requireFields(payload, ['requestId']);
  const request = await loadRequest(ctx, payload.requestId);
  assertCanManage(ctx, request);
  if (request.status !== 'fulfilled') {
    throw conflict('invalid_state', 'Only a request whose blood is secured can be marked completed.');
  }
  const updated = await transitionRequest(ctx, request, 'completed', 'Marked completed');
  await notify(ctx, updated.requesterId, 'request_status_changed', notificationContext(updated, { status: domain.REQUEST_STATUS_LABELS.completed }));
  await audit(ctx, 'request.completed', 'blood_request', request.$id, 'Request completed');
  return { request: updated };
}

async function expireRequest(ctx, request) {
  if (!domain.canTransitionRequest(request.status, 'expired')) return null;
  const updated = await transitionRequest(ctx, request, 'expired', 'Expired');
  await closeResponses(ctx, updated, { notifyAccepted: false });
  await notify(ctx, updated.requesterId, 'request_expired', notificationContext(updated));
  await audit(ctx, 'request.expired', 'blood_request', request.$id, 'Request expired');
  return updated;
}

/**
 * After an accepted donor leaves (withdraws, or the donation is cancelled)
 * one accepted unit is released and the request steps back accordingly.
 */
async function releaseAcceptedUnit(ctx, requestId) {
  const request = await ctx.store.get('blood_requests', requestId);
  if (!request) return null;
  let current = (request.unitsAccepted || 0) > 0 ? await ctx.store.decrement('blood_requests', request.$id, 'unitsAccepted') : request;
  const accepted = current.unitsAccepted || 0;
  if (current.status === 'fulfilled' && accepted < current.units) {
    current = await transitionRequest(ctx, current, 'partially_fulfilled', 'A donor is no longer available');
  }
  if (current.status === 'partially_fulfilled' && accepted === 0) {
    current = await transitionRequest(ctx, current, 'donors_contacted', 'Looking for more donors');
  }
  return current;
}

module.exports = {
  createRequest,
  verifyRequest,
  requestMatches,
  contactDonorAction,
  cancelRequest,
  completeRequest,
  expireRequest,
  startMatching,
  offerOpenRequestsToDonor,
  releaseAcceptedUnit,
  closeResponses,
  toCandidate,
  OPEN_FOR_DONORS,
};
