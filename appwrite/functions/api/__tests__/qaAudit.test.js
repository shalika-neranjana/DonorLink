/** @jest-environment node */
/**
 * QA audit (2026-10-09): authorization/IDOR, request lifecycle, concurrency,
 * idempotency and malformed-input tests against the real handlers on the
 * in-memory Appwrite stand-in. These prove server-side rules only; live
 * Appwrite row permissions are a separate (manual) check.
 */
const { createScenario } = require('./helpers/scenario');
const { actions } = require('../src/handlers');

const HOUR = 36e5;

/** Two verified organizations: A (staff1, claims NHSL) and B (staff2, claims Kandy). */
async function twoOrganizations() {
  const { w, baseRequest } = await createScenario();
  w.users.add('staff2', { name: 'Kandy Staff' });
  w.users.add('nurse1', { name: 'Nurse One' });
  await w.ok('staff2', 'profile.save', { profile: { displayName: 'Kandy Staff', district: 'Kandy' }, onboardingComplete: true });
  await w.store.create('organizations', 'dirkandy', {
    name: 'Teaching Hospital Kandy',
    type: 'hospital',
    district: 'Kandy',
    approxLat: 7.29,
    approxLng: 80.64,
    verificationStatus: 'not_submitted',
    claimed: false,
  });
  const register = async (userId, claim, name, district) => {
    w.storage.addFile('files', `doc-${userId}`, [`read("user:${userId}")`]);
    const sub = await w.ok(userId, 'verification.submit', {
      subjectType: 'organization',
      documentType: 'organization_registration',
      documentFileIds: [`doc-${userId}`],
      organization: { name, type: 'hospital', district, phone: '0112691111', claimOrganizationId: claim },
    });
    await w.ok('admin1', 'verification.review', { verificationId: sub.verification.$id, decision: 'verified' });
  };
  await register('staff1', 'dirnhsl', 'National Hospital of Sri Lanka', 'Colombo');
  await register('staff2', 'dirkandy', 'Teaching Hospital Kandy', 'Kandy');
  return { w, baseRequest, orgA: 'dirnhsl', orgB: 'dirkandy' };
}

async function verifiedRequest(units = 1, clientId = 'qa1') {
  const { w, baseRequest } = await createScenario();
  await w.ok('req1', 'request.create', { request: { ...baseRequest, units }, clientId });
  await w.ok('admin1', 'request.verify', { requestId: clientId, approve: true });
  return { w, requestId: clientId };
}

// ---------------------------------------------------------------------------
describe('TC-SEC: cross-tenant and wrong-role access (IDOR)', () => {
  it('TC-SEC-001 organization A cannot change organization B inventory', async () => {
    const { w, orgB } = await twoOrganizations();
    const item = { bloodGroup: 'O+', component: 'whole_blood', unitsAvailable: 5, unitsReserved: 0, lowStockThreshold: 2 };
    const result = await w.call('staff1', 'org.updateInventory', { organizationId: orgB, item });
    expect(result.status).toBe(403);
    expect(w.rows('blood_inventory')).toHaveLength(0);
  });

  it('TC-SEC-002 organization A cannot add, remove or edit organization B members/profile', async () => {
    const { w, orgB } = await twoOrganizations();
    expect((await w.call('staff1', 'org.addMember', { organizationId: orgB, email: 'nurse1@example.com', role: 'admin' })).status).toBe(403);
    expect((await w.call('staff1', 'org.removeMember', { organizationId: orgB, userId: 'staff2' })).status).toBe(403);
    expect((await w.call('staff1', 'org.updateProfile', { organizationId: orgB, phone: '0770000000' })).status).toBe(403);
    expect((await w.users.get({ userId: 'nurse1' })).labels).toEqual([]);
  });

  it('TC-SEC-003 organization A staff cannot verify a request addressed to organization B', async () => {
    const { w, baseRequest, orgB } = await twoOrganizations();
    await w.ok('req1', 'request.create', {
      request: { ...baseRequest, hospitalId: orgB, hospitalName: 'Teaching Hospital Kandy', district: 'Kandy' },
      clientId: 'kandy1',
    });
    const result = await w.call('staff1', 'request.verify', { requestId: 'kandy1', approve: true });
    expect(result.status).toBe(403);
    expect((await w.call('staff1', 'request.matches', { requestId: 'kandy1' })).status).toBe(403);
    expect((await w.call('staff2', 'request.verify', { requestId: 'kandy1', approve: true })).status).toBe(200);
  });

  it('TC-SEC-004 a staff (non-admin) organization member cannot manage the team', async () => {
    const { w, orgA } = await twoOrganizations();
    await w.ok('staff1', 'org.addMember', { organizationId: orgA, email: 'nurse1@example.com', role: 'staff' });
    expect((await w.call('nurse1', 'org.addMember', { organizationId: orgA, email: 'stranger@example.com', role: 'admin' })).status).toBe(403);
    expect((await w.call('nurse1', 'org.removeMember', { organizationId: orgA, userId: 'staff1' })).status).toBe(403);
  });

  it('TC-SEC-005 organization members and donors cannot use admin actions', async () => {
    const { w } = await twoOrganizations();
    for (const caller of ['staff1', 'don1']) {
      for (const action of ['admin.getUser', 'admin.setAdminRole', 'admin.setUserStatus', 'admin.updateSettings', 'maintenance.run']) {
        const r = await w.call(caller, action, { userId: 'req1', admin: true, enabled: false, maintenanceMode: true });
        expect(r.status).toBe(403);
      }
    }
    expect((await w.users.get({ userId: 'req1' })).labels).toEqual([]);
  });

  it('TC-SEC-006 a donor cannot confirm, schedule or cancel their own donation', async () => {
    const { w, requestId } = await verifiedRequest(1, 'own-don');
    const { donation } = await w.ok('don1', 'response.accept', { requestId });
    expect((await w.call('don1', 'donation.confirm', { donationId: donation.$id })).status).toBe(403);
    expect((await w.call('don1', 'donation.schedule', { donationId: donation.$id, note: 'x' })).status).toBe(403);
    expect((await w.call('don1', 'donation.cancel', { donationId: donation.$id })).status).toBe(403);
    expect((await w.call('stranger', 'donation.confirm', { donationId: donation.$id })).status).toBe(403);
  });

  it('TC-SEC-007 a stranger cannot cancel or complete someone else\'s request', async () => {
    const { w, requestId } = await verifiedRequest(1, 'idor-cancel');
    expect((await w.call('stranger', 'request.cancel', { requestId })).status).toBe(403);
    expect((await w.call('don1', 'request.cancel', { requestId })).status).toBe(403);
    expect((await w.call('stranger', 'request.complete', { requestId })).status).toBe(403);
    expect((await w.store.get('blood_requests', requestId)).status).toBe('donors_contacted');
  });

  it('TC-SEC-008 a donor cannot answer an invitation sent to another donor', async () => {
    const { w, requestId } = await verifiedRequest(1, 'idor-resp');
    // don1 and don2 were contacted; "stranger" was not.
    expect((await w.call('stranger', 'response.accept', { requestId })).status).toBe(404);
    expect((await w.call('stranger', 'response.decline', { requestId })).status).toBe(404);
    const responses = w.rows('request_responses');
    expect(responses.every((r) => r.status === 'pending')).toBe(true);
  });

  it('TC-SEC-009 an ID supplied in the payload never changes who the caller is', async () => {
    const { w } = await createScenario();
    const r = await w.ok('stranger', 'profile.save', { profile: { displayName: 'Mallory', userId: 'don1' }, userId: 'don1' });
    expect(r.profile.userId).toBe('stranger');
    expect((await w.store.get('profiles', 'don1')).displayName).toBe('Kasun Perera');
    const t = await w.ok('stranger', 'support.create', { category: 'other', subject: 'Hi', message: 'Hello there, testing.', userId: 'don1' });
    expect(t.ticket.userId).toBe('stranger');
  });

  it('TC-SEC-010 a scheduled trigger without a user can only run maintenance', async () => {
    const { w } = await createScenario();
    const forged = await w.call(null, 'admin.setAdminRole', { userId: 'stranger', admin: true }, 'schedule');
    expect(forged.status).not.toBe(200);
    expect((await w.users.get({ userId: 'stranger' })).labels).toEqual([]);
    const created = await w.call(null, 'support.create', { category: 'other', subject: 'x', message: 'no user at all here' }, 'schedule');
    expect(created.status).not.toBe(200);
    expect(w.rows('support_tickets')).toHaveLength(0);
    // The legitimate scheduled run still works.
    expect((await w.call(null, 'maintenance.run', {}, 'schedule')).status).toBe(200);
  });

  it('TC-SEC-011 admin.listUsers and getUser never return secrets', async () => {
    const { w } = await createScenario();
    const list = await w.ok('admin1', 'admin.listUsers', {});
    for (const u of list.users) expect(Object.keys(u).sort()).toEqual(['email', 'emailVerified', 'enabled', 'id', 'labels', 'name', 'registeredAt']);
    const detail = await w.ok('admin1', 'admin.getUser', { userId: 'don1' });
    expect(detail.profile).not.toHaveProperty('phone');
  });
});

// ---------------------------------------------------------------------------
describe('TC-REQ: request lifecycle through the API', () => {
  it('TC-REQ-001 rejects actions on terminal requests', async () => {
    const { w, requestId } = await verifiedRequest(1, 'term1');
    await w.ok('req1', 'request.cancel', { requestId, reason: 'Found blood' });
    expect((await w.call('req1', 'request.cancel', { requestId })).status).toBe(409);
    expect((await w.call('admin1', 'request.verify', { requestId, approve: true })).status).toBe(409);
    expect((await w.call('req1', 'request.complete', { requestId })).status).toBe(409);
    expect((await w.call('req1', 'request.contactDonor', { requestId, donorId: 'far1' })).status).toBe(409);
    const accept = await w.call('don1', 'response.accept', { requestId });
    expect(accept.status).toBe(409);
    expect((await w.store.get('blood_requests', requestId)).unitsAccepted).toBe(0);
    expect(w.rows('donations')).toHaveLength(0);
  });

  it('TC-REQ-002 a declined response cannot later be accepted, and accept cannot repeat', async () => {
    const { w, requestId } = await verifiedRequest(2, 'resp1');
    await w.ok('don1', 'response.decline', { requestId, reason: 'Travelling' });
    const after = await w.call('don1', 'response.accept', { requestId });
    expect(after.status).toBe(409);
    await w.ok('don2', 'response.accept', { requestId });
    const again = await w.call('don2', 'response.accept', { requestId });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('already_accepted');
    expect((await w.call('don2', 'response.decline', { requestId })).status).toBe(409);
    expect((await w.store.get('blood_requests', requestId)).unitsAccepted).toBe(1);
  });

  it('TC-REQ-003 a request past its expiry time cannot be accepted even before maintenance runs', async () => {
    const { w, requestId } = await verifiedRequest(1, 'late1');
    const request = await w.store.get('blood_requests', requestId);
    w.advance(new Date(request.expiresAt).getTime() - w.clock().getTime() + HOUR);
    const result = await w.call('don1', 'response.accept', { requestId });
    expect(result.status).toBe(409);
    expect(w.rows('donations')).toHaveLength(0);
  });

  it('TC-REQ-008 expiring a request tells donors whose donation was cancelled', async () => {
    const { w, requestId } = await verifiedRequest(2, 'exp-acc');
    await w.ok('don1', 'response.accept', { requestId });
    const request = await w.store.get('blood_requests', requestId);
    w.advance(new Date(request.expiresAt).getTime() - w.clock().getTime() + HOUR);
    await w.ok('admin1', 'maintenance.run', {});
    expect((await w.store.get('blood_requests', requestId)).status).toBe('expired');
    expect(w.rows('donations')[0].status).toBe('cancelled');
    expect(w.rows('notifications').some((n) => n.userId === 'don1' && n.type === 'donation_cancelled')).toBe(true);
  });

  it('TC-REQ-004 only a fulfilled request can be completed; donations close it automatically', async () => {
    const { w, requestId } = await verifiedRequest(1, 'done1');
    expect((await w.call('req1', 'request.complete', { requestId })).status).toBe(409);
    const { donation } = await w.ok('don1', 'response.accept', { requestId });
    const confirmed = await w.ok('req1', 'donation.confirm', { donationId: donation.$id });
    expect(confirmed.request.status).toBe('completed');
    expect((await w.call('req1', 'donation.confirm', { donationId: donation.$id })).status).toBe(409);
    expect((await w.call('req1', 'donation.cancel', { donationId: donation.$id })).status).toBe(409);
  });

  it('TC-REQ-005 a no-show releases the unit and re-opens the request', async () => {
    const { w, requestId } = await verifiedRequest(1, 'noshow1');
    const { donation } = await w.ok('don1', 'response.accept', { requestId });
    const r = await w.ok('req1', 'donation.cancel', { donationId: donation.$id, noShow: true });
    expect(r.donation.status).toBe('no_show');
    const request = await w.store.get('blood_requests', requestId);
    expect(request.unitsAccepted).toBe(0);
    expect(request.status).toBe('donors_contacted');
  });

  it('TC-REQ-006 a rejected request stays rejected and notifies nobody else', async () => {
    const { w, baseRequest } = await createScenario();
    await w.ok('req1', 'request.create', { request: baseRequest, clientId: 'rej1' });
    await w.ok('admin1', 'request.verify', { requestId: 'rej1', approve: false, note: 'Hospital could not confirm' });
    expect((await w.call('admin1', 'request.verify', { requestId: 'rej1', approve: true })).status).toBe(409);
    expect(w.rows('request_responses')).toHaveLength(0);
    expect(w.rows('notifications').some((n) => n.type === 'emergency_request')).toBe(false);
  });

  it('TC-REQ-007 boundary units: 1 and 20 accepted, 0, 21, 1.5 and "2" rejected', async () => {
    const { w, baseRequest } = await createScenario();
    for (const [units, status] of [[0, 400], [21, 400], [1.5, 400], ['2', 400], [-1, 400]]) {
      expect((await w.call('req1', 'request.create', { request: { ...baseRequest, units }, clientId: `u${String(units).replace('.', '')}x` })).status).toBe(status);
    }
    expect((await w.call('req1', 'request.create', { request: { ...baseRequest, units: 20 }, clientId: 'u20' })).status).toBe(200);
    expect((await w.call('stranger', 'request.create', { request: { ...baseRequest, units: 1 }, clientId: 'u1' })).status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
describe('TC-CON: concurrency and idempotency', () => {
  it('TC-CON-001 two simultaneous submissions with the same client id create one request and no server error', async () => {
    const { w, baseRequest } = await createScenario();
    const results = await Promise.all([
      w.call('req1', 'request.create', { request: baseRequest, clientId: 'same1' }),
      w.call('req1', 'request.create', { request: baseRequest, clientId: 'same1' }),
    ]);
    expect(results.map((r) => r.status)).not.toContain(500);
    expect(results.filter((r) => r.status === 200).length).toBeGreaterThanOrEqual(1);
    expect(w.rows('blood_requests')).toHaveLength(1);
  });

  it('TC-CON-002 a retried submission (after a timeout) returns the original request', async () => {
    const { w, baseRequest } = await createScenario();
    const first = await w.ok('req1', 'request.create', { request: baseRequest, clientId: 'retry1' });
    const retry = await w.ok('req1', 'request.create', { request: baseRequest, clientId: 'retry1' });
    expect(retry.duplicate).toBe(true);
    expect(retry.request.$id).toBe(first.request.$id);
    // Another user replaying the same client id gets nothing.
    expect((await w.call('stranger', 'request.create', { request: baseRequest, clientId: 'retry1' })).status).toBe(403);
  });

  it('TC-CON-003 two donors accepting the last two units at once leave the request fulfilled', async () => {
    const { w, requestId } = await verifiedRequest(2, 'two1');
    const results = await Promise.all([
      w.call('don1', 'response.accept', { requestId }),
      w.call('don2', 'response.accept', { requestId }),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    const request = await w.store.get('blood_requests', requestId);
    expect(request.unitsAccepted).toBe(2);
    expect(request.unitsAccepted).toBeLessThanOrEqual(request.units);
    expect(request.status).toBe('fulfilled');
  });

  it('TC-CON-004 a donation confirmed twice at once (requester + hospital) is counted once', async () => {
    const { w, baseRequest } = await twoOrganizations();
    await w.ok('req1', 'request.create', { request: { ...baseRequest, units: 1 }, clientId: 'conf1' });
    await w.ok('staff1', 'request.verify', { requestId: 'conf1', approve: true });
    const { donation } = await w.ok('don1', 'response.accept', { requestId: 'conf1' });
    const results = await Promise.all([
      w.call('req1', 'donation.confirm', { donationId: donation.$id }),
      w.call('staff1', 'donation.confirm', { donationId: donation.$id }),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    const donor = await w.store.get('donor_profiles', 'don1');
    expect(donor.donationCount).toBe(1);
    const request = await w.store.get('blood_requests', 'conf1');
    expect(request.unitsCompleted).toBe(1);
    expect(w.rows('notifications').filter((n) => n.userId === 'don1' && n.type === 'donation_completed')).toHaveLength(1);
  });

  it('TC-CON-007 two different donations of one request confirmed at once both count', async () => {
    const { w, baseRequest } = await twoOrganizations();
    await w.ok('admin1', 'admin.updateSettings', { defaultRadiusKm: 100 });
    await w.ok('req1', 'request.create', { request: { ...baseRequest, bloodGroup: 'O-', units: 2 }, clientId: 'conf2' });
    await w.ok('staff1', 'request.verify', { requestId: 'conf2', approve: true });
    const a = await w.ok('don2', 'response.accept', { requestId: 'conf2' });
    // don1 is A+ and cannot give O-; contact a second O- donor directly.
    w.users.add('don3', { name: 'Third Donor' });
    await w.ok('don3', 'profile.save', { profile: { displayName: 'Third Donor', bloodGroup: 'O-', district: 'Colombo', isDonor: true }, onboardingComplete: true });
    await w.ok('don3', 'donor.updateAvailability', { availability: 'available', radiusKm: 25, emergencyAlerts: true });
    const b = await w.ok('don3', 'response.accept', { requestId: 'conf2' });
    await Promise.all([
      w.ok('req1', 'donation.confirm', { donationId: a.donation.$id }),
      w.ok('staff1', 'donation.confirm', { donationId: b.donation.$id }),
    ]);
    const request = await w.store.get('blood_requests', 'conf2');
    expect(request.unitsCompleted).toBe(2);
    expect(request.status).toBe('completed');
  });

  it('TC-CON-005 double-tapped decline records one decline and one notification', async () => {
    const { w, requestId } = await verifiedRequest(1, 'dd1');
    const before = w.rows('notifications').filter((n) => n.type === 'donor_declined').length;
    const results = await Promise.all([
      w.call('don1', 'response.decline', { requestId }),
      w.call('don1', 'response.decline', { requestId }),
    ]);
    expect(results.filter((r) => r.status === 200).length).toBeGreaterThanOrEqual(1);
    expect(w.rows('notifications').filter((n) => n.type === 'donor_declined').length - before).toBe(1);
  });

  it('TC-CON-006 marking a notification read twice is harmless', async () => {
    const { w, requestId } = await verifiedRequest(1, 'nr1');
    const n = w.rows('notifications').find((row) => row.userId === 'don1' && row.requestId === requestId);
    const results = await Promise.all([
      w.call('don1', 'notifications.markRead', { notificationId: n.$id }),
      w.call('don1', 'notifications.markRead', { notificationId: n.$id }),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
  });
});

// ---------------------------------------------------------------------------
describe('TC-VER: verification review', () => {
  it('TC-VER-001 re-approving an organization verification never creates a second organization', async () => {
    const { w } = await createScenario();
    w.storage.addFile('files', 'od', ['read("user:staff1")']);
    const sub = await w.ok('staff1', 'verification.submit', {
      subjectType: 'organization',
      documentType: 'organization_registration',
      documentFileIds: ['od'],
      organization: { name: 'Galle Blood Centre', type: 'blood_bank', district: 'Galle', phone: '0912345678' },
    });
    const id = sub.verification.$id;
    await w.ok('admin1', 'verification.review', { verificationId: id, decision: 'verified' });
    await w.ok('admin1', 'verification.review', { verificationId: id, decision: 'needs_attention', note: 'Re-check phone' });
    await w.call('admin1', 'verification.review', { verificationId: id, decision: 'verified' });
    const orgs = w.rows('organizations').filter((o) => o.name === 'Galle Blood Centre');
    expect(orgs).toHaveLength(1);
    expect(w.rows('organization_members').filter((m) => m.userId === 'staff1')).toHaveLength(1);
  });

  it('TC-VER-002 withdrawing approval of an organization stops it acting as verified', async () => {
    const { w } = await createScenario();
    w.storage.addFile('files', 'od2', ['read("user:staff1")']);
    const sub = await w.ok('staff1', 'verification.submit', {
      subjectType: 'organization',
      documentType: 'organization_registration',
      documentFileIds: ['od2'],
      organization: { name: 'Matara Blood Bank', type: 'blood_bank', district: 'Matara', phone: '0412345678' },
    });
    const { organization } = await w.ok('admin1', 'verification.review', { verificationId: sub.verification.$id, decision: 'verified' });
    await w.ok('admin1', 'verification.review', { verificationId: sub.verification.$id, decision: 'rejected', note: 'Registration number is fake' });
    expect((await w.store.get('organizations', organization.$id)).verificationStatus).toBe('rejected');
    const item = { bloodGroup: 'O+', component: 'whole_blood', unitsAvailable: 5, unitsReserved: 0, lowStockThreshold: 2 };
    expect((await w.call('staff1', 'org.updateInventory', { organizationId: organization.$id, item })).status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
describe('TC-NET: malformed input never causes a server error', () => {
  const MALFORMED = [null, 'text', 42, true, [], ['x'], { requestId: {} }, { requestId: ['a'] }, { donationId: 5 }, { notificationId: null }];

  it('TC-NET-001 every action answers malformed payloads with 4xx, never 500', async () => {
    const { w } = await createScenario();
    const failures = [];
    for (const action of Object.keys(actions)) {
      for (const caller of ['req1', 'admin1']) {
        for (const payload of MALFORMED) {
          const r = await w.call(caller, action, payload);
          if (r.status >= 500) failures.push(`${caller} ${action} ${JSON.stringify(payload)} -> ${r.status}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('TC-NET-002 malformed nested fields are rejected as validation errors', async () => {
    const { w, baseRequest } = await createScenario();
    const cases = [
      ['request.create', { request: { ...baseRequest, hospitalId: { $ne: null } }, clientId: 'n1' }],
      ['request.create', { request: { ...baseRequest, location: 'here' }, clientId: 'n2' }],
      ['profile.save', { profile: { displayName: 'X', location: { lat: 'a', lng: 1 } } }],
      ['donor.updateAvailability', { availability: 'available', radiusKm: 10, emergencyAlerts: 'yes' }],
      ['verification.submit', { subjectType: 'user', documentType: 'national_id', documentFileIds: 'abc' }],
    ];
    for (const [action, payload] of cases) {
      const r = await w.call('don1', action, payload);
      expect(`${action} ${r.status}`).toBe(`${action} 400`);
    }
  });
});
