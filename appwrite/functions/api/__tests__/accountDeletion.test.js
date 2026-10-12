/** @jest-environment node */
const { createScenario } = require('./helpers/scenario');

describe('account.delete', () => {
  it('requires explicit confirmation', async () => {
    const { w } = await createScenario();
    const result = await w.call('stranger', 'account.delete', {});
    expect(result.status).toBe(400);
    expect(w.users.map.has('stranger')).toBe(true);
  });

  it('refuses administrators', async () => {
    const { w } = await createScenario();
    const result = await w.call('admin1', 'account.delete', { confirm: true });
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe('admin_account');
    expect(w.users.map.has('admin1')).toBe(true);
  });

  it('cancels open requests, withdraws donor offers and removes personal data', async () => {
    const { w, baseRequest } = await createScenario();
    await w.ok('req1', 'request.create', { request: baseRequest, clientId: 'reqA' });
    await w.ok('admin1', 'request.verify', { requestId: 'reqA', approve: true });

    await w.ok('don1', 'support.create', { category: 'other', subject: 'Question', message: 'A question before I leave.' });

    // A donor deleting their account steps back from the pending offer.
    await w.ok('don1', 'account.delete', { confirm: true });
    expect(w.rows('support_tickets').some((t) => t.userId === 'don1')).toBe(false);
    expect(w.users.map.has('don1')).toBe(false);
    expect(w.rows('profiles').some((p) => p.userId === 'don1')).toBe(false);
    expect(w.rows('donor_profiles').some((p) => p.donorId === 'don1')).toBe(false);
    expect(w.rows('request_responses').find((r) => r.donorId === 'don1').status).toBe('expired');

    // A requester deleting their account cancels the request and notifies no one it can't.
    await w.ok('req1', 'account.delete', { confirm: true });
    expect(w.users.map.has('req1')).toBe(false);
    expect(w.rows('blood_requests')[0].status).toBe('cancelled');
    expect(w.rows('profiles').some((p) => p.userId === 'req1')).toBe(false);
    expect(w.rows('audit_logs').some((a) => a.action === 'account.deleted')).toBe(true);
  });
});
