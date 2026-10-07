/** @jest-environment node */
const { Permission, Role } = require('node-appwrite');
const { createScenario } = require('./helpers/scenario');

async function matchingRequest(units) {
  const { w, baseRequest } = await createScenario();
  const created = await w.ok('req1', 'request.create', { request: { ...baseRequest, units }, clientId: 'race1' });
  await w.ok('admin1', 'request.verify', { requestId: created.request.$id, approve: true });
  return { w, requestId: created.request.$id };
}

describe('accepting a request concurrently', () => {
  it('never accepts more donors than units when two donors accept at once', async () => {
    const { w, requestId } = await matchingRequest(1);
    const results = await Promise.all([
      w.call('don1', 'response.accept', { requestId }),
      w.call('don2', 'response.accept', { requestId }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const loser = results.find((r) => r.status === 409);
    expect(loser.body.error.code).toBe('enough_donors');

    const request = await w.store.get('blood_requests', requestId);
    expect(request.unitsAccepted).toBe(1);
    expect(request.status).toBe('fulfilled');
    expect(w.rows('donations').filter((d) => d.status === 'scheduled')).toHaveLength(1);
  });

  it('counts a double-tapped accept once', async () => {
    const { w, requestId } = await matchingRequest(2);
    const results = await Promise.all([
      w.call('don1', 'response.accept', { requestId }),
      w.call('don1', 'response.accept', { requestId }),
    ]);

    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    const request = await w.store.get('blood_requests', requestId);
    expect(request.unitsAccepted).toBe(1);
    expect(w.rows('donations')).toHaveLength(1);
  });

  it('releases the unit again when an accepted donor withdraws', async () => {
    const { w, requestId } = await matchingRequest(1);
    await w.ok('don1', 'response.accept', { requestId });
    await w.ok('don1', 'response.withdraw', { requestId });
    const request = await w.store.get('blood_requests', requestId);
    expect(request.unitsAccepted).toBe(0);
    expect(request.status).toBe('donors_contacted');
  });
});

describe('profile avatar ownership', () => {
  it('rejects missing files and files uploaded by someone else', async () => {
    const { w } = await createScenario();
    w.storage.addFile('files', 'mine', [Permission.read(Role.user('don1'))]);
    w.storage.addFile('files', 'theirs', [Permission.read(Role.user('don2'))]);
    const save = (avatarFileId) =>
      w.call('don1', 'profile.save', { profile: { displayName: 'Kasun Perera' }, avatarFileId });

    const missing = await save('nope');
    expect(missing.status).toBe(400);
    expect(missing.body.error.fields.avatarFileId).toBeTruthy();

    const stolen = await save('theirs');
    expect(stolen.status).toBe(400);

    const own = await save('mine');
    expect(own.status).toBe(200);
    expect(own.body.data.profile.avatarFileId).toBe('mine');
  });
});

describe('notifications are server-written', () => {
  it('gives the owner read-only access to new notifications', async () => {
    const { w } = await createScenario();
    await w.ok('req1', 'request.create', {
      request: { bloodGroup: 'A+', units: 1, urgency: 'urgent', hospitalName: 'Some Clinic', district: 'Colombo' },
      clientId: 'notif1',
    });
    const mine = w.rows('notifications').filter((n) => n.userId === 'req1');
    expect(mine.length).toBeGreaterThan(0);
    for (const row of mine) expect(row.$permissions).toEqual([Permission.read(Role.user('req1'))]);
  });

  it('marks only the caller\'s own notification as read', async () => {
    const { w, baseRequest } = await createScenario();
    await w.ok('req1', 'request.create', { request: baseRequest, clientId: 'notif2' });
    const own = w.rows('notifications').find((n) => n.userId === 'req1');
    expect(own.read).toBe(false);

    const foreign = await w.call('stranger', 'notifications.markRead', { notificationId: own.$id });
    expect(foreign.status).toBe(404);
    expect((await w.store.get('notifications', own.$id)).read).toBe(false);

    await w.ok('req1', 'notifications.markRead', { notificationId: own.$id });
    const after = await w.store.get('notifications', own.$id);
    expect(after.read).toBe(true);
    expect(after.readAt).toBeTruthy();
  });
});
