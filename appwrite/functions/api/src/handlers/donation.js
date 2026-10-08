const domain = require('../lib/domain');
const { validation, forbidden, notFound, conflict } = require('../lib/errors');
const {
  audit,
  claimAudit,
  notify,
  notificationContext,
  transitionRequest,
  loadRequest,
  accessContext,
  requireFields,
  iso,
} = require('../lib/context');
const { releaseAcceptedUnit } = require('./request');

async function loadDonation(ctx, donationId) {
  requireFields({ donationId }, ['donationId']);
  const donation = await ctx.store.get('donations', donationId);
  if (!donation) throw notFound('Donation not found.');
  return donation;
}

/** Requester, hospital staff or an admin - never the donor themselves. */
async function authorizeCoordinator(ctx, donation) {
  const request = await loadRequest(ctx, donation.requestId);
  const access = accessContext(ctx, request);
  if (ctx.userId === donation.donorId && ctx.userId !== request.requesterId) {
    throw forbidden('Donation status is confirmed by the requester or hospital staff.');
  }
  if (!domain.canConfirmDonation(access)) throw forbidden();
  return request;
}

async function confirmDonation(ctx, payload) {
  const donation = await loadDonation(ctx, payload && payload.donationId);
  let request = await authorizeCoordinator(ctx, donation);
  if (!domain.canTransitionDonation(donation.status, 'completed')) {
    throw conflict('invalid_state', `This donation is already ${domain.DONATION_STATUS_LABELS[donation.status].toLowerCase()}.`);
  }
  // The requester and hospital staff may both press Confirm at the same moment;
  // only the caller that writes this fixed-ID audit row goes on to count it.
  const claimId = `dc${donation.$id}`;
  if (!(await claimAudit(ctx, claimId, 'donation.completed', 'donation', donation.$id, 'Donation confirmed'))) {
    throw conflict('invalid_state', 'This donation is already completed.');
  }

  const now = iso(ctx.now());
  let updated;
  try {
    updated = await ctx.store.update('donations', donation.$id, {
      status: 'completed',
      completedAt: now,
      confirmedBy: ctx.userId,
    });
  } catch (error) {
    await ctx.store.remove('audit_logs', claimId).catch(() => undefined);
    throw error;
  }
  if (donation.responseId) {
    const response = await ctx.store.get('request_responses', donation.responseId);
    if (response && domain.canTransitionResponse(response.status, 'completed')) {
      await ctx.store.update('request_responses', response.$id, { status: 'completed' });
    }
  }
  const donor = await ctx.store.get('donor_profiles', donation.donorId);
  if (donor) {
    await ctx.store.increment('donor_profiles', donor.$id, 'donationCount');
    await ctx.store.update('donor_profiles', donor.$id, { lastDonationDate: now });
  }

  // Atomic, so confirming two different donations at once counts both.
  request = await ctx.store.increment('blood_requests', request.$id, 'unitsCompleted');
  if ((request.unitsCompleted || 0) >= request.units) {
    if (request.status === 'partially_fulfilled' || request.status === 'donors_contacted') {
      request = await transitionRequest(ctx, request, 'fulfilled', 'All units donated');
    }
    if (request.status === 'fulfilled') {
      request = await transitionRequest(ctx, request, 'completed', 'All donations confirmed');
      await notify(ctx, request.requesterId, 'request_status_changed', notificationContext(request, { status: domain.REQUEST_STATUS_LABELS.completed }));
    }
  }

  await notify(ctx, donation.donorId, 'donation_completed', notificationContext(request));
  return { donation: updated, request };
}

async function scheduleDonation(ctx, payload) {
  const donation = await loadDonation(ctx, payload && payload.donationId);
  const request = await authorizeCoordinator(ctx, donation);
  if (donation.status !== 'scheduled') {
    throw conflict('invalid_state', 'Only an open donation can be rescheduled.');
  }
  const data = {};
  if (payload.scheduledFor) {
    const t = new Date(payload.scheduledFor).getTime();
    if (Number.isNaN(t)) throw validation({ scheduledFor: 'Enter a valid date and time.' });
    if (t < ctx.now().getTime() - 5 * 60_000) throw validation({ scheduledFor: 'Choose a time in the future.' });
    data.scheduledFor = new Date(t).toISOString();
  }
  if (typeof payload.note === 'string') {
    const note = payload.note.trim();
    if (note.length > 300) throw validation({ note: 'Note must be 300 characters or fewer.' });
    data.coordinationNote = note || null;
  }
  if (Object.keys(data).length === 0) throw validation({ scheduledFor: 'Add a time or a note.' });
  const updated = await ctx.store.update('donations', donation.$id, data);
  await notify(ctx, donation.donorId, 'donation_scheduled', notificationContext(request, { note: data.coordinationNote }));
  await audit(ctx, 'donation.scheduled', 'donation', donation.$id, 'Donation coordination updated');
  return { donation: updated };
}

async function cancelDonation(ctx, payload) {
  const donation = await loadDonation(ctx, payload && payload.donationId);
  const request = await authorizeCoordinator(ctx, donation);
  const next = payload.noShow === true ? 'no_show' : 'cancelled';
  if (!domain.canTransitionDonation(donation.status, next)) {
    throw conflict('invalid_state', `This donation is already ${domain.DONATION_STATUS_LABELS[donation.status].toLowerCase()}.`);
  }
  const updated = await ctx.store.update('donations', donation.$id, { status: next });
  if (donation.responseId) {
    const response = await ctx.store.get('request_responses', donation.responseId);
    if (response && domain.canTransitionResponse(response.status, 'withdrawn')) {
      await ctx.store.update('request_responses', response.$id, { status: 'withdrawn' });
    }
  }
  const current = await releaseAcceptedUnit(ctx, request.$id);
  await notify(ctx, donation.donorId, 'donation_cancelled', notificationContext(current || request));
  await audit(ctx, 'donation.cancelled', 'donation', donation.$id, next === 'no_show' ? 'Donor did not attend' : 'Donation cancelled');
  return { donation: updated, request: current };
}

module.exports = { confirmDonation, scheduleDonation, cancelDonation };
