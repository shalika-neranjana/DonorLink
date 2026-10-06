/** @jest-environment node */
const { createScenario } = require('./helpers/scenario');

describe('request lifecycle (requester + donor + admin)', () => {
  it('runs the full flow: create -> verify -> match -> accept -> confirm -> history', async () => {
    const { w, baseRequest } = await createScenario();

    // Requester submits; an individual request must be verified first.
    const created = await w.ok('req1', 'request.create', { request: baseRequest, clientId: 'reqA' });
    expect(created.request.status).toBe('pending_verification');
    expect(created.request.requesterId).toBe('req1');
    expect(created.request.$permissions).toEqual(
      expect.arrayContaining(['read("user:req1")', 'read("label:admin")']),
    );
    // No donor has been contacted before verification.
    expect(w.rows('request_responses')).toHaveLength(0);

    // Admin verifies -> matching runs -> nearby compatible donors contacted.
    const verified = await w.ok('admin1', 'request.verify', { requestId: 'reqA', approve: true });
    expect(verified.request.status).toBe('donors_contacted');
    expect(verified.contacted).toBe(2); // don1 (A+) and don2 (O-); far1 is out of range
    const responses = w.rows('request_responses');
    expect(responses.map((r) => r.donorId).sort()).toEqual(['don1', 'don2']);
    expect(responses.every((r) => r.status === 'pending')).toBe(true);
    // Donor name is minimised to first name + initial.
    expect(responses.find((r) => r.donorId === 'don1').donorName).toBe('Kasun P.');
    // Contacted donors can read the request; the far donor cannot.
    const perms = w.rows('blood_requests')[0].$permissions;
    expect(perms).toEqual(expect.arrayContaining(['read("user:don1")', 'read("user:don2")']));
    expect(perms).not.toContain('read("user:far1")');

    // Donors were notified with a deep link to the incoming-request screen.
    const donorNotifications = w.rows('notifications').filter((n) => n.userId === 'don1');
    expect(donorNotifications[0]).toMatchObject({
      category: 'emergency',
      type: 'emergency_request',
      route: '/donor/incoming/reqA',
      read: false,
    });

    // First donor accepts -> partially fulfilled (2 units needed).
    const accepted = await w.ok('don1', 'response.accept', { requestId: 'reqA' });
    expect(accepted.request.status).toBe('partially_fulfilled');
    expect(accepted.request.unitsAccepted).toBe(1);
    expect(accepted.donation.status).toBe('scheduled');

    // Duplicate accept is rejected clearly.
    const duplicate = await w.call('don1', 'response.accept', { requestId: 'reqA' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('already_accepted');

    // Second donor accepts -> blood secured; no pending invitations remain.
    const second = await w.ok('don2', 'response.accept', { requestId: 'reqA' });
    expect(second.request.status).toBe('fulfilled');
    expect(w.rows('request_responses').some((r) => r.status === 'pending')).toBe(false);

    // The donor cannot confirm their own donation...
    const own = await w.call('don1', 'donation.confirm', { donationId: accepted.donation.$id });
    expect(own.status).toBe(403);

    // ...the requester (or hospital staff / admin) does.
    await w.ok('req1', 'donation.confirm', { donationId: accepted.donation.$id });
    const midway = await w.store.get('blood_requests', 'reqA');
    expect(midway.status).toBe('fulfilled');
    await w.ok('req1', 'donation.confirm', { donationId: second.donation.$id });
    const done = await w.store.get('blood_requests', 'reqA');
    expect(done.status).toBe('completed');
    expect(done.unitsCompleted).toBe(2);

    // Donor stats and history reflect the donation.
    const donor = await w.store.get('donor_profiles', 'don1');
    expect(donor.donationCount).toBe(1);
    expect(donor.lastDonationDate).toBeTruthy();
    expect(w.rows('donations').every((d) => d.status === 'completed')).toBe(true);

    // Timeline history recorded each stage.
    const history = JSON.parse(done.statusHistory).map((h) => h.status);
    expect(history).toEqual(
      expect.arrayContaining(['submitted', 'pending_verification', 'verified', 'matching', 'donors_contacted', 'fulfilled', 'completed']),
    );

    // Audit trail exists for key actions.
    const actions = w.rows('audit_logs').map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['request.created', 'request.verified', 'response.accepted', 'donation.completed']));
  });

  it('is idempotent for the same client id and blocks near-duplicate submissions', async () => {
    const { w, baseRequest } = await createScenario();
    await w.ok('req1', 'request.create', { request: baseRequest, clientId: 'dup1' });
    const again = await w.ok('req1', 'request.create', { request: baseRequest, clientId: 'dup1' });
    expect(again.duplicate).toBe(true);
    expect(w.rows('blood_requests')).toHaveLength(1);

    const similar = await w.call('req1', 'request.create', { request: baseRequest, clientId: 'dup2' });
    expect(similar.status).toBe(409);
    expect(similar.body.error.code).toBe('duplicate_request');
  });

  it('validates input on the server regardless of the client', async () => {
    const { w } = await createScenario();
    const bad = await w.call('req1', 'request.create', {
      request: { bloodGroup: 'Q+', units: 99, urgency: 'whenever', hospitalName: '', district: 'Atlantis' },
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('validation_failed');
    expect(Object.keys(bad.body.error.fields)).toEqual(
      expect.arrayContaining(['bloodGroup', 'units', 'urgency', 'hospitalName', 'district']),
    );
  });

  it('lets a donor decline with a reason and tells the requester', async () => {
    const { w, baseRequest } = await createScenario();
    await w.ok('req1', 'request.create', { request: baseRequest, clientId: 'reqB' });
    await w.ok('admin1', 'request.verify', { requestId: 'reqB', approve: true });
    await w.ok('don1', 'response.decline', { requestId: 'reqB', reason: 'Too far away' });
    const row = w.rows('request_responses').find((r) => r.donorId === 'don1');
    expect(row).toMatchObject({ status: 'declined', declineReason: 'Too far away' });
    expect(w.rows('notifications').some((n) => n.userId === 'req1' && n.type === 'donor_declined')).toBe(true);
    // Declined is final.
    const again = await w.call('don1', 'response.accept', { requestId: 'reqB' });
    expect(again.status).toBe(409);
  });

  it('rejects requests that cannot be verified, with the reason delivered to the requester', async () => {
    const { w, baseRequest } = await createScenario();
    await w.ok('req1', 'request.create', { request: baseRequest, clientId: 'reqC' });
    const noReason = await w.call('admin1', 'request.verify', { requestId: 'reqC', approve: false });
    expect(noReason.status).toBe(400);
    await w.ok('admin1', 'request.verify', { requestId: 'reqC', approve: false, note: 'Hospital could not confirm this request.' });
    const row = await w.store.get('blood_requests', 'reqC');
    expect(row.status).toBe('rejected');
    expect(w.rows('request_responses')).toHaveLength(0);
    const n = w.rows('notifications').find((x) => x.type === 'request_rejected');
    expect(n.body).toContain('could not confirm');
  });

  it('cancels a request, expires invitations and notifies accepted donors', async () => {
    const { w, baseRequest } = await createScenario();
    await w.ok('req1', 'request.create', { request: baseRequest, clientId: 'reqD' });
    await w.ok('admin1', 'request.verify', { requestId: 'reqD', approve: true });
    await w.ok('don1', 'response.accept', { requestId: 'reqD' });

    const stranger = await w.call('stranger', 'request.cancel', { requestId: 'reqD' });
    expect(stranger.status).toBe(403);

    const cancelled = await w.ok('req1', 'request.cancel', { requestId: 'reqD', reason: 'Blood found elsewhere' });
    expect(cancelled.request.status).toBe('cancelled');
    const states = w.rows('request_responses').map((r) => `${r.donorId}:${r.status}`).sort();
    expect(states).toEqual(['don1:withdrawn', 'don2:expired']);
    expect(w.rows('donations')[0].status).toBe('cancelled');
    expect(w.rows('notifications').some((n) => n.userId === 'don1' && n.type === 'donation_cancelled')).toBe(true);

    // Cancelling again, or accepting afterwards, is a clear conflict.
    const again = await w.call('req1', 'request.cancel', { requestId: 'reqD' });
    expect(again.status).toBe(409);
    const late = await w.call('don2', 'response.accept', { requestId: 'reqD' });
    expect(late.status).toBe(409);
  });

  it('steps the request back when an accepted donor withdraws', async () => {
    const { w, baseRequest } = await createScenario();
    await w.ok('req1', 'request.create', { request: { ...baseRequest, units: 1 }, clientId: 'reqE' });
    await w.ok('admin1', 'request.verify', { requestId: 'reqE', approve: true });
    const accepted = await w.ok('don1', 'response.accept', { requestId: 'reqE' });
    expect(accepted.request.status).toBe('fulfilled');
    const withdrawn = await w.ok('don1', 'response.withdraw', { requestId: 'reqE' });
    expect(withdrawn.request.status).toBe('donors_contacted');
    expect(withdrawn.request.unitsAccepted).toBe(0);
  });

  it('refuses a donor who was never contacted', async () => {
    const { w, baseRequest } = await createScenario();
    await w.ok('req1', 'request.create', { request: baseRequest, clientId: 'reqF' });
    await w.ok('admin1', 'request.verify', { requestId: 'reqF', approve: true });
    const result = await w.call('far1', 'response.accept', { requestId: 'reqF' });
    expect(result.status).toBe(404);
  });

  it('offers open requests to a donor who becomes available later', async () => {
    const { w, baseRequest } = await createScenario();
    await w.ok('don2', 'donor.updateAvailability', { availability: 'unavailable', radiusKm: 25, emergencyAlerts: true });
    await w.ok('req1', 'request.create', { request: baseRequest, clientId: 'reqG' });
    const verified = await w.ok('admin1', 'request.verify', { requestId: 'reqG', approve: true });
    expect(verified.contacted).toBe(1); // only don1
    const result = await w.ok('don2', 'donor.updateAvailability', { availability: 'available', radiusKm: 25, emergencyAlerts: true });
    expect(result.offeredRequests).toBe(1);
    expect(w.rows('request_responses').some((r) => r.donorId === 'don2')).toBe(true);
  });

  it('expires stale requests during maintenance', async () => {
    const { w, baseRequest } = await createScenario();
    await w.ok('req1', 'request.create', { request: baseRequest, clientId: 'reqH' });
    await w.ok('admin1', 'request.verify', { requestId: 'reqH', approve: true });
    const denied = await w.call('req1', 'maintenance.run');
    expect(denied.status).toBe(403);
    w.advance(30 * 36e5); // critical requests expire after 24h
    const result = await w.call(null, 'maintenance.run', {}, 'schedule');
    expect(result.status).toBe(200);
    expect(result.body.data.expired).toBe(1);
    expect((await w.store.get('blood_requests', 'reqH')).status).toBe('expired');
    expect(w.rows('notifications').some((n) => n.userId === 'req1' && n.type === 'request_expired')).toBe(true);
  });
});
