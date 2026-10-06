/** @jest-environment node */
const { createScenario } = require('./helpers/scenario');

describe('authentication and authorization', () => {
  it('rejects unauthenticated calls and unknown actions', async () => {
    const { w } = await createScenario();
    expect((await w.call(null, 'request.create', {})).status).toBe(401);
    expect((await w.call('ghost-user', 'request.create', {})).status).toBe(401);
    const unknown = await w.call('req1', 'admin.dropEverything');
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe('unknown_action');
  });

  it('never trusts a client-supplied user id, role or verification state', async () => {
    const { w, baseRequest } = await createScenario();
    const created = await w.ok('req1', 'request.create', {
      request: { ...baseRequest, requesterId: 'admin1', status: 'verified', verificationStatus: 'verified' },
      requesterId: 'admin1',
      labels: ['admin'],
      clientId: 'sec1',
    });
    expect(created.request.requesterId).toBe('req1');
    expect(created.request.status).toBe('pending_verification');
    expect(created.request.verificationStatus).toBe('pending');
    // Having a label claim in the body does not grant admin actions.
    const forged = await w.call('req1', 'admin.analytics', { labels: ['admin'] });
    expect(forged.status).toBe(403);
  });

  it('blocks non-admins from every admin action', async () => {
    const { w } = await createScenario();
    for (const action of ['admin.listUsers', 'admin.analytics', 'admin.setAdminRole', 'admin.setUserStatus', 'admin.updateSettings', 'admin.upsertOrganization', 'verification.review', 'support.reply']) {
      const result = await w.call('req1', action, { userId: 'don1', admin: true, enabled: false });
      expect(result.status).toBe(403);
    }
  });

  it('protects request data and actions by ownership', async () => {
    const { w, baseRequest } = await createScenario();
    await w.ok('req1', 'request.create', { request: baseRequest, clientId: 'own1' });
    await w.ok('admin1', 'request.verify', { requestId: 'own1', approve: true });
    expect((await w.call('stranger', 'request.matches', { requestId: 'own1' })).status).toBe(403);
    expect((await w.call('stranger', 'request.verify', { requestId: 'own1', approve: true })).status).toBe(403);
    expect((await w.call('don1', 'request.contactDonor', { requestId: 'own1', donorId: 'far1' })).status).toBe(403);
    expect((await w.call('req1', 'request.verify', { requestId: 'own1', approve: true })).status).toBe(403);
    // A request's owner and admin may view matches; donors' exact data is never returned.
    const matches = await w.ok('req1', 'request.matches', { requestId: 'own1' });
    expect(matches.matches.length).toBeGreaterThan(0);
    for (const m of matches.matches) {
      expect(Object.keys(m)).not.toEqual(expect.arrayContaining(['approxLat', 'approxLng', 'phone', 'email']));
    }
    expect(matches.disclaimer).toMatch(/not medical approval/);
  });

  it('blocks writes while the platform is in maintenance mode, but not for admins', async () => {
    const { w, baseRequest } = await createScenario();
    await w.ok('admin1', 'admin.updateSettings', { maintenanceMode: true });
    const blocked = await w.call('req1', 'request.create', { request: baseRequest });
    expect(blocked.status).toBe(503);
    await w.ok('admin1', 'admin.updateSettings', { maintenanceMode: false });
    expect((await w.call('req1', 'request.create', { request: baseRequest, clientId: 'm1' })).status).toBe(200);
  });

  it('prevents admins from locking themselves out', async () => {
    const { w } = await createScenario();
    expect((await w.call('admin1', 'admin.setAdminRole', { userId: 'admin1', admin: false })).status).toBe(409);
    expect((await w.call('admin1', 'admin.setUserStatus', { userId: 'admin1', enabled: false })).status).toBe(409);
    await w.ok('admin1', 'admin.setUserStatus', { userId: 'stranger', enabled: false });
    expect((await w.call('stranger', 'request.create', {})).status).toBe(403);
  });
});

describe('verification workflow', () => {
  async function upload(w, userId, fileId) {
    w.storage.addFile('files', fileId, [`read("user:${userId}")`, 'read("label:admin")']);
  }

  it('lets a user submit documents and an admin review them', async () => {
    const { w } = await createScenario();
    upload(w, 'don1', 'file1');
    const submitted = await w.ok('don1', 'verification.submit', {
      subjectType: 'donor',
      documentType: 'donor_card',
      documentFileIds: ['file1'],
    });
    expect(submitted.verification.status).toBe('pending');
    expect((await w.store.get('donor_profiles', 'don1')).verificationStatus).toBe('pending');

    const duplicate = await w.call('don1', 'verification.submit', { subjectType: 'donor', documentType: 'donor_card', documentFileIds: ['file1'] });
    expect(duplicate.status).toBe(409);

    const id = submitted.verification.$id;
    const noNote = await w.call('admin1', 'verification.review', { verificationId: id, decision: 'rejected' });
    expect(noNote.status).toBe(400);
    await w.ok('admin1', 'verification.review', { verificationId: id, decision: 'verified' });
    expect((await w.store.get('donor_profiles', 'don1')).verificationStatus).toBe('verified');
    expect(w.rows('notifications').some((n) => n.userId === 'don1' && n.type === 'verification_update')).toBe(true);
    expect(w.rows('audit_logs').some((a) => a.action === 'verification.reviewed')).toBe(true);
  });

  it('rejects documents the user did not upload', async () => {
    const { w } = await createScenario();
    upload(w, 'someone-else', 'foreign');
    const result = await w.call('don1', 'verification.submit', { subjectType: 'user', documentType: 'national_id', documentFileIds: ['foreign'] });
    expect(result.status).toBe(400);
    const missing = await w.call('don1', 'verification.submit', { subjectType: 'user', documentType: 'national_id', documentFileIds: ['nope'] });
    expect(missing.status).toBe(400);
  });

  it('registers an organization through verification, granting membership labels', async () => {
    const { w } = await createScenario();
    upload(w, 'staff1', 'orgdoc');
    const submitted = await w.ok('staff1', 'verification.submit', {
      subjectType: 'organization',
      documentType: 'organization_registration',
      documentFileIds: ['orgdoc'],
      organization: {
        name: 'Colombo Blood Bank',
        type: 'blood_bank',
        district: 'Colombo',
        phone: '0112345678',
      },
    });
    expect((await w.users.get({ userId: 'staff1' })).labels).toEqual([]);
    const reviewed = await w.ok('admin1', 'verification.review', { verificationId: submitted.verification.$id, decision: 'verified' });
    expect(reviewed.organization.name).toBe('Colombo Blood Bank');
    const labels = (await w.users.get({ userId: 'staff1' })).labels;
    expect(labels).toEqual(expect.arrayContaining(['organization', `orgm${reviewed.organization.$id}`]));
    expect(w.rows('organization_members')[0]).toMatchObject({ userId: 'staff1', role: 'admin', active: true });
  });
});

describe('organization workflows', () => {
  async function registerOrg(w) {
    w.storage.addFile('files', 'doc', ['read("user:staff1")']);
    const sub = await w.ok('staff1', 'verification.submit', {
      subjectType: 'organization',
      documentType: 'organization_registration',
      documentFileIds: ['doc'],
      organization: { name: 'NHSL Blood Bank', type: 'hospital', district: 'Colombo', phone: '0112691111', claimOrganizationId: 'dirnhsl' },
    });
    const { organization } = await w.ok('admin1', 'verification.review', { verificationId: sub.verification.$id, decision: 'verified' });
    return organization;
  }

  it('claims a directory hospital and lets staff verify requests addressed to it', async () => {
    const { w, baseRequest } = await createScenario();
    const org = await registerOrg(w);
    expect(org.$id).toBe('dirnhsl');
    expect(org.claimed).toBe(true);

    await w.ok('req1', 'request.create', { request: baseRequest, clientId: 'org1' });
    const row = await w.store.get('blood_requests', 'org1');
    expect(row.$permissions).toContain('read("label:orgmdirnhsl")');

    const result = await w.ok('staff1', 'request.verify', { requestId: 'org1', approve: true });
    expect(result.request.status).toBe('donors_contacted');
    // Staff of another organization cannot verify.
    expect((await w.call('stranger', 'request.verify', { requestId: 'org1', approve: true })).status).toBe(403);
  });

  it('auto-verifies requests created by staff of a verified hospital', async () => {
    const { w, baseRequest } = await createScenario();
    await registerOrg(w);
    const created = await w.ok('staff1', 'request.create', { request: baseRequest, clientId: 'org2' });
    expect(created.request.status).toBe('donors_contacted');
    expect(created.request.verificationStatus).toBe('verified');
  });

  it('lets hospital staff coordinate: schedule and confirm a donation', async () => {
    const { w, baseRequest } = await createScenario();
    await registerOrg(w);
    await w.ok('req1', 'request.create', { request: { ...baseRequest, units: 1 }, clientId: 'org3' });
    await w.ok('staff1', 'request.verify', { requestId: 'org3', approve: true });
    const accepted = await w.ok('don1', 'response.accept', { requestId: 'org3' });
    const when = new Date(w.clock().getTime() + 3 * 36e5).toISOString();
    const scheduled = await w.ok('staff1', 'donation.schedule', { donationId: accepted.donation.$id, scheduledFor: when, note: 'Ward 12, blood bank counter' });
    expect(scheduled.donation.scheduledFor).toBe(when);
    expect(w.rows('notifications').some((n) => n.userId === 'don1' && n.body.includes('Ward 12'))).toBe(true);
    const confirmed = await w.ok('staff1', 'donation.confirm', { donationId: accepted.donation.$id });
    expect(confirmed.request.status).toBe('completed');
    expect((await w.call('stranger', 'donation.confirm', { donationId: accepted.donation.$id })).status).toBe(403);
  });

  it('restricts inventory to verified organization members and validates counts', async () => {
    const { w } = await createScenario();
    const org = await registerOrg(w);
    const item = { bloodGroup: 'O-', component: 'whole_blood', unitsAvailable: 4, unitsReserved: 1, lowStockThreshold: 6 };

    const outsider = await w.call('stranger', 'org.updateInventory', { organizationId: org.$id, item });
    expect(outsider.status).toBe(403);
    const invalid = await w.call('staff1', 'org.updateInventory', { organizationId: org.$id, item: { ...item, unitsReserved: 9 } });
    expect(invalid.status).toBe(400);

    const created = await w.ok('staff1', 'org.updateInventory', { organizationId: org.$id, item });
    expect(created.item.$permissions).toEqual(expect.arrayContaining([`read("label:orgm${org.$id}")`, 'read("label:admin")']));
    await w.ok('staff1', 'org.updateInventory', { organizationId: org.$id, item: { ...item, unitsAvailable: 20 } });
    const rows = w.rows('blood_inventory');
    expect(rows).toHaveLength(1);
    expect(rows[0].unitsAvailable).toBe(20);
    expect(w.rows('audit_logs').some((a) => a.action === 'inventory.updated' && a.summary.includes('4 -> 20'))).toBe(true);
  });

  it('manages organization members with last-admin protection', async () => {
    const { w } = await createScenario();
    const org = await registerOrg(w);
    const added = await w.ok('staff1', 'org.addMember', { organizationId: org.$id, email: 'don2@example.com', role: 'coordinator' });
    expect(added.member.role).toBe('coordinator');
    expect((await w.users.get({ userId: 'don2' })).labels).toContain(`orgm${org.$id}`);
    expect((await w.call('don2', 'org.addMember', { organizationId: org.$id, email: 'stranger@example.com' })).status).toBe(403);
    expect((await w.call('staff1', 'org.addMember', { organizationId: org.$id, email: 'nobody@example.com' })).status).toBe(404);
    expect((await w.call('staff1', 'org.removeMember', { organizationId: org.$id, userId: 'staff1' })).status).toBe(409);
    await w.ok('staff1', 'org.removeMember', { organizationId: org.$id, userId: 'don2' });
    expect((await w.users.get({ userId: 'don2' })).labels).not.toContain(`orgm${org.$id}`);
  });
});

describe('notifications and support', () => {
  it('respects notification preferences and marks everything read', async () => {
    const { w, baseRequest } = await createScenario();
    await w.ok('don1', 'profile.save', {
      profile: { displayName: 'Kasun Perera', bloodGroup: 'A+', district: 'Colombo', isDonor: true },
      notificationPrefs: { emergencyRequests: false, requestUpdates: true },
    });
    await w.ok('req1', 'request.create', { request: baseRequest, clientId: 'np1' });
    await w.ok('admin1', 'request.verify', { requestId: 'np1', approve: true });
    // don1 turned emergency alerts off: no longer matched or notified.
    expect(w.rows('notifications').some((n) => n.userId === 'don1')).toBe(false);
    const don2 = w.rows('notifications').filter((n) => n.userId === 'don2');
    expect(don2.length).toBeGreaterThan(0);
    const result = await w.ok('don2', 'notifications.markAllRead');
    expect(result.updated).toBe(don2.length);
    expect(w.rows('notifications').filter((n) => n.userId === 'don2').every((n) => n.read)).toBe(true);
  });

  it('creates support tickets and lets admins reply', async () => {
    const { w } = await createScenario();
    const bad = await w.call('req1', 'support.create', { category: 'account', subject: '', message: 'x' });
    expect(bad.status).toBe(400);
    const { ticket } = await w.ok('req1', 'support.create', { category: 'account', subject: 'Phone number', message: 'I cannot update my phone number.' });
    expect(ticket.$permissions).toContain('read("user:req1")');
    await w.ok('admin1', 'support.reply', { ticketId: ticket.$id, reply: 'Fixed, please retry.' });
    expect((await w.store.get('support_tickets', ticket.$id)).status).toBe('resolved');
    expect(w.rows('notifications').some((n) => n.userId === 'req1' && n.type === 'support_reply')).toBe(true);
  });

  it('computes admin analytics', async () => {
    const { w, baseRequest } = await createScenario();
    await w.ok('req1', 'request.create', { request: baseRequest, clientId: 'an1' });
    await w.ok('admin1', 'request.verify', { requestId: 'an1', approve: true });
    await w.ok('don1', 'response.accept', { requestId: 'an1' });
    await w.ok('don2', 'response.decline', { requestId: 'an1' });
    const stats = await w.ok('admin1', 'admin.analytics');
    expect(stats.requests.total).toBe(1);
    expect(stats.requests.last7Days).toHaveLength(7);
    expect(stats.responses.acceptanceRate).toBe(50);
    expect(stats.donors.registered).toBe(3);
  });
});
