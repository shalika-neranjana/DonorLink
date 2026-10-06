import { canCancelRequest, canTransitionDonation, canTransitionRequest, canTransitionResponse, assertRequestTransition, InvalidTransitionError, REQUEST_TRANSITIONS } from '../transitions';
import { NOTIFICATION_TYPES, REQUEST_STATUSES, TERMINAL_REQUEST_STATUSES } from '../statuses';
import { buildTimeline, parseStatusHistory } from '../tracking';
import {
  canConfirmDonation,
  canVerifyRequest,
  isAdmin,
  isOrganizationMember,
  organizationIdsFromLabels,
  organizationLabel,
  rolesFromLabels,
  withAdmin,
  withOrganizationMembership,
} from '../permissions';
import { buildNotification } from '../notifications';

describe('request status transitions', () => {
  it('defines a transition entry for every status', () => {
    for (const status of REQUEST_STATUSES) expect(REQUEST_TRANSITIONS[status]).toBeDefined();
  });

  it('follows the documented happy path', () => {
    const path = [
      'draft',
      'submitted',
      'pending_verification',
      'verified',
      'matching',
      'donors_contacted',
      'partially_fulfilled',
      'fulfilled',
      'completed',
    ] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransitionRequest(path[i], path[i + 1])).toBe(true);
    }
  });

  it('rejects skipping verification and arbitrary jumps', () => {
    expect(canTransitionRequest('pending_verification', 'matching')).toBe(false);
    expect(canTransitionRequest('submitted', 'completed')).toBe(false);
    expect(canTransitionRequest('verified', 'fulfilled')).toBe(false);
  });

  it('treats terminal statuses as final', () => {
    for (const status of TERMINAL_REQUEST_STATUSES) {
      expect(REQUEST_TRANSITIONS[status]).toHaveLength(0);
      expect(canCancelRequest(status)).toBe(false);
    }
  });

  it('allows cancelling active requests', () => {
    expect(canCancelRequest('pending_verification')).toBe(true);
    expect(canCancelRequest('donors_contacted')).toBe(true);
  });

  it('throws a descriptive error on invalid transitions', () => {
    expect(() => assertRequestTransition('completed', 'matching')).toThrow(InvalidTransitionError);
    expect(() => assertRequestTransition('completed', 'matching')).toThrow(/completed/);
  });
});

describe('response and donation transitions', () => {
  it('allows accept/decline from pending only', () => {
    expect(canTransitionResponse('pending', 'accepted')).toBe(true);
    expect(canTransitionResponse('pending', 'declined')).toBe(true);
    expect(canTransitionResponse('declined', 'accepted')).toBe(false);
    expect(canTransitionResponse('accepted', 'declined')).toBe(false);
  });
  it('allows an accepted donor to withdraw or complete', () => {
    expect(canTransitionResponse('accepted', 'withdrawn')).toBe(true);
    expect(canTransitionResponse('accepted', 'completed')).toBe(true);
  });
  it('lets a scheduled donation finish, cancel or no-show only', () => {
    expect(canTransitionDonation('scheduled', 'completed')).toBe(true);
    expect(canTransitionDonation('completed', 'cancelled')).toBe(false);
  });
});

describe('buildTimeline', () => {
  const history = parseStatusHistory(
    JSON.stringify([
      { status: 'submitted', at: '2026-03-10T08:00:00Z' },
      { status: 'verified', at: '2026-03-10T08:10:00Z' },
      { status: 'donors_contacted', at: '2026-03-10T08:12:00Z' },
    ]),
  );

  it('marks the verification stage as current while pending', () => {
    const stages = buildTimeline('pending_verification', [{ status: 'submitted', at: '2026-03-10T08:00:00Z' }]);
    expect(stages[0].state).toBe('done');
    expect(stages[1].state).toBe('current');
    expect(stages.slice(2).every((s) => s.state === 'upcoming')).toBe(true);
  });

  it('attaches timestamps to completed stages', () => {
    const stages = buildTimeline('donors_contacted', history);
    expect(stages.filter((s) => s.state === 'done')).toHaveLength(4);
    expect(stages[0].at).toBe('2026-03-10T08:00:00Z');
    expect(stages[1].at).toBe('2026-03-10T08:10:00Z');
    expect(stages[4].state).toBe('current');
  });

  it('completes every stage for a completed request', () => {
    const stages = buildTimeline('completed', history);
    expect(stages.every((s) => s.state === 'done')).toBe(true);
  });

  it('freezes progress for cancelled requests with no current stage', () => {
    const stages = buildTimeline('cancelled', history);
    expect(stages.some((s) => s.state === 'current')).toBe(false);
    expect(stages.filter((s) => s.state === 'done').length).toBeGreaterThan(0);
  });

  it('parses malformed history defensively', () => {
    expect(parseStatusHistory('not json')).toEqual([]);
    expect(parseStatusHistory(null)).toEqual([]);
    expect(parseStatusHistory('{"a":1}')).toEqual([]);
  });
});

describe('role-based access', () => {
  const orgA = 'abc123';
  const labels = ['organization', organizationLabel(orgA)];

  it('derives roles from labels', () => {
    expect(rolesFromLabels([])).toEqual(['user']);
    expect(rolesFromLabels(labels)).toEqual(['user', 'organization']);
    expect(rolesFromLabels(['admin'])).toEqual(['user', 'admin']);
  });

  it('extracts and checks organization membership', () => {
    expect(organizationIdsFromLabels(labels)).toEqual([orgA]);
    expect(isOrganizationMember(labels, orgA)).toBe(true);
    expect(isOrganizationMember(labels, 'other')).toBe(false);
    expect(isAdmin(labels)).toBe(false);
  });

  it('grants and revokes membership labels coherently', () => {
    const granted = withOrganizationMembership([], orgA, true);
    expect(granted).toEqual(expect.arrayContaining(['organization', organizationLabel(orgA)]));
    const revoked = withOrganizationMembership(granted, orgA, false);
    expect(revoked).not.toContain('organization');
    expect(withAdmin([], true)).toContain('admin');
    expect(withAdmin(['admin'], false)).not.toContain('admin');
  });

  it('only lets admins or addressed-hospital staff verify a request', () => {
    const base = { requesterId: 'r1', hospitalOrganizationId: orgA };
    expect(canVerifyRequest({ ...base, userId: 'u2', labels: ['admin'] })).toBe(true);
    expect(canVerifyRequest({ ...base, userId: 'u2', labels })).toBe(true);
    expect(canVerifyRequest({ ...base, userId: 'u2', labels: [] })).toBe(false);
    expect(canVerifyRequest({ ...base, userId: 'u2', labels: [organizationLabel('zzz')] })).toBe(false);
  });

  it('never lets a requester verify their own request through an organization role', () => {
    expect(
      canVerifyRequest({ userId: 'r1', requesterId: 'r1', hospitalOrganizationId: orgA, labels }),
    ).toBe(false);
  });

  it('lets requester, hospital staff and admins confirm donations, but not strangers', () => {
    const base = { requesterId: 'r1', hospitalOrganizationId: orgA };
    expect(canConfirmDonation({ ...base, userId: 'r1', labels: [] })).toBe(true);
    expect(canConfirmDonation({ ...base, userId: 'staff', labels })).toBe(true);
    expect(canConfirmDonation({ ...base, userId: 'x', labels: [] })).toBe(false);
  });
});

describe('notifications', () => {
  it('builds a title, body, category and deep link for every type', () => {
    for (const type of NOTIFICATION_TYPES) {
      const n = buildNotification(type, {
        requestId: 'req1',
        bloodGroup: 'O+',
        units: 2,
        urgency: 'critical',
        hospitalName: 'General Hospital',
        distanceKm: 3.2,
        donorName: 'Kasun P.',
      });
      expect(n.title.length).toBeGreaterThan(0);
      expect(n.body.length).toBeGreaterThan(0);
      expect(n.route.startsWith('/')).toBe(true);
      expect(n.actionLabel.length).toBeGreaterThan(0);
    }
  });

  it('routes emergency requests to the incoming-request screen as an Emergency notification', () => {
    const n = buildNotification('emergency_request', {
      requestId: 'req1',
      bloodGroup: 'A-',
      units: 1,
      urgency: 'critical',
      hospitalName: 'General Hospital',
      distanceKm: 2.4,
    });
    expect(n.category).toBe('emergency');
    expect(n.route).toBe('/donor/incoming/req1');
    expect(n.title).toContain('Critical');
    expect(n.body).toContain('2.4 km');
  });
});
