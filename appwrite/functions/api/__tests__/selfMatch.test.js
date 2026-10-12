/** @jest-environment node */
const { createScenario } = require('./helpers/scenario');

describe('requester is also an available donor', () => {
  it('never appears in their own matches or gets contacted', async () => {
    const { w, baseRequest } = await createScenario();
    await w.ok('req1', 'donor.updateAvailability', { availability: 'available', radiusKm: 25, emergencyAlerts: true });
    await w.ok('req1', 'request.create', { request: baseRequest, clientId: 'selfA' });
    await w.ok('admin1', 'request.verify', { requestId: 'selfA', approve: true });

    const { matches } = await w.ok('req1', 'request.matches', { requestId: 'selfA' });
    expect(matches.map((m) => m.donorId)).not.toContain('req1');
    expect(w.rows('request_responses').map((r) => r.donorId)).not.toContain('req1');

    const direct = await w.call('req1', 'request.contactDonor', { requestId: 'selfA', donorId: 'req1' });
    expect(direct.status).toBe(409);
  });
});
