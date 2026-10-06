const { ID, Query } = require('node-appwrite');
const domain = require('../lib/domain');
const { validation, notFound, conflict } = require('../lib/errors');
const {
  audit,
  notify,
  notifyOrganization,
  notificationContext,
  requestRowPerms,
  transitionRequest,
  requireFields,
  iso,
} = require('../lib/context');
const { OPEN_FOR_DONORS, closeResponses, releaseAcceptedUnit } = require('./request');

async function findOwnResponse(ctx, requestId) {
  requireFields({ requestId }, ['requestId']);
  const response = await ctx.store.first('request_responses', [
    Query.equal('requestId', [requestId]),
    Query.equal('donorId', [ctx.userId]),
  ]);
  if (!response) throw notFound('You have not been asked to help with this request.');
  return response;
}

async function acceptResponse(ctx, payload) {
  const response = await findOwnResponse(ctx, payload && payload.requestId);
  if (response.status === 'accepted') throw conflict('already_accepted', 'You already accepted this request.');
  if (!domain.canTransitionResponse(response.status, 'accepted')) {
    throw conflict('invalid_state', `This request can't be accepted because it is ${domain.RESPONSE_STATUS_LABELS[response.status].toLowerCase()}.`);
  }

  let request = await ctx.store.get('blood_requests', response.requestId);
  if (!request) throw notFound('Request not found.');
  if (!OPEN_FOR_DONORS.includes(request.status)) {
    await ctx.store.update('request_responses', response.$id, { status: 'expired' });
    throw conflict('request_closed', `This request is no longer open (${domain.REQUEST_STATUS_LABELS[request.status].toLowerCase()}).`);
  }
  if ((request.unitsAccepted || 0) >= request.units) {
    await ctx.store.update('request_responses', response.$id, { status: 'expired' });
    throw conflict('enough_donors', 'Enough donors have already accepted. Thank you for being ready to help.');
  }

  const donor = await ctx.store.get('donor_profiles', ctx.userId);
  if (!donor) throw conflict('no_donor_profile', 'Set up your donor profile before accepting a request.');

  const updatedResponse = await ctx.store.update('request_responses', response.$id, {
    status: 'accepted',
    respondedAt: iso(ctx.now()),
  });

  const donation = await ctx.store.create(
    'donations',
    ID.unique(),
    {
      requestId: request.$id,
      responseId: response.$id,
      donorId: ctx.userId,
      donorName: response.donorName,
      requesterId: request.requesterId,
      hospitalId: request.hospitalId || null,
      hospitalName: request.hospitalName,
      bloodGroup: request.bloodGroup,
      units: 1,
      status: 'scheduled',
    },
    requestRowPerms({ donorId: ctx.userId, requesterId: request.requesterId, hospitalId: request.hospitalId }),
  );

  const accepted = (request.unitsAccepted || 0) + 1;
  request = await ctx.store.update('blood_requests', request.$id, { unitsAccepted: accepted });
  if (request.status === 'matching') request = await transitionRequest(ctx, request, 'donors_contacted', 'Donors contacted');
  const target = accepted >= request.units ? 'fulfilled' : 'partially_fulfilled';
  if (request.status !== target && domain.canTransitionRequest(request.status, target)) {
    request = await transitionRequest(ctx, request, target, target === 'fulfilled' ? 'Enough donors accepted' : 'A donor accepted');
  }

  await notify(ctx, request.requesterId, 'donor_accepted', notificationContext(request, { donorName: response.donorName }));
  await notify(ctx, ctx.userId, 'donation_scheduled', notificationContext(request));
  await notifyOrganization(ctx, request.hospitalId, 'donor_accepted', notificationContext(request, { donorName: response.donorName }), request.requesterId);

  if (request.status === 'fulfilled') {
    // Remaining invitations are no longer needed.
    const others = await ctx.store.listAll('request_responses', [Query.equal('requestId', [request.$id]), Query.equal('status', ['pending'])]);
    for (const other of others) await ctx.store.update('request_responses', other.$id, { status: 'expired' });
    await notify(ctx, request.requesterId, 'request_status_changed', notificationContext(request, { status: domain.REQUEST_STATUS_LABELS.fulfilled }));
  }

  await audit(ctx, 'response.accepted', 'blood_request', request.$id, 'Donor accepted request');
  return { response: updatedResponse, donation, request };
}

async function declineResponse(ctx, payload) {
  const response = await findOwnResponse(ctx, payload && payload.requestId);
  if (response.status === 'declined') throw conflict('already_declined', 'You already declined this request.');
  if (!domain.canTransitionResponse(response.status, 'declined')) {
    throw conflict('invalid_state', `This request can't be declined because it is ${domain.RESPONSE_STATUS_LABELS[response.status].toLowerCase()}.`);
  }
  const reasonError = domain.validateDeclineReason(payload.reason);
  if (reasonError) throw validation({ reason: reasonError });
  const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';

  const updated = await ctx.store.update('request_responses', response.$id, {
    status: 'declined',
    declineReason: reason || null,
    respondedAt: iso(ctx.now()),
  });
  const request = await ctx.store.get('blood_requests', response.requestId);
  if (request) {
    await notify(ctx, request.requesterId, 'donor_declined', notificationContext(request));
  }
  await audit(ctx, 'response.declined', 'blood_request', response.requestId, 'Donor declined request');
  return { response: updated };
}

async function withdrawResponse(ctx, payload) {
  const response = await findOwnResponse(ctx, payload && payload.requestId);
  if (!domain.canTransitionResponse(response.status, 'withdrawn')) {
    throw conflict('invalid_state', 'Only an accepted donation can be withdrawn.');
  }
  const updated = await ctx.store.update('request_responses', response.$id, { status: 'withdrawn', respondedAt: iso(ctx.now()) });
  const donation = await ctx.store.first('donations', [Query.equal('responseId', [response.$id])]);
  if (donation && donation.status === 'scheduled') {
    await ctx.store.update('donations', donation.$id, { status: 'cancelled' });
  }
  const request = await releaseAcceptedUnit(ctx, response.requestId);
  if (request) {
    await notify(ctx, request.requesterId, 'donation_cancelled', notificationContext(request));
    await notifyOrganization(ctx, request.hospitalId, 'donation_cancelled', notificationContext(request), request.requesterId);
  }
  await audit(ctx, 'response.withdrawn', 'blood_request', response.requestId, 'Donor withdrew');
  return { response: updated, request };
}

module.exports = { acceptResponse, declineResponse, withdrawResponse, closeResponses };
