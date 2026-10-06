/**
 * DonorLink Appwrite schema - single source for provisioning and docs.
 *
 * Conventions
 *  - Table IDs equal table names (snake_case) so config is predictable.
 *  - Clients can READ rows they are allowed to see (row-level permissions).
 *    Almost every WRITE goes through the `donorlink-api` Appwrite Function,
 *    which authenticates the caller, validates input and applies the
 *    documented state-transition rules. Only `notifications` rows are
 *    updatable by their owner (mark as read) and `support`-style data is
 *    created through the function as well.
 *  - Column enums mirror src/domain/statuses.ts.
 */

export const DATABASE_ID = 'donorlink';
export const DATABASE_NAME = 'DonorLinkDB';

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const REQUEST_STATUSES = [
  'draft',
  'submitted',
  'pending_verification',
  'verified',
  'matching',
  'donors_contacted',
  'partially_fulfilled',
  'fulfilled',
  'completed',
  'cancelled',
  'expired',
  'rejected',
];
export const URGENCY = ['critical', 'urgent', 'standard'];
export const VERIFICATION = ['not_submitted', 'pending', 'verified', 'needs_attention', 'rejected'];
export const AVAILABILITY = ['available', 'unavailable', 'temporarily_unavailable', 'unknown'];
export const RESPONSE_STATUSES = ['pending', 'accepted', 'declined', 'withdrawn', 'completed', 'expired'];
export const DONATION_STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show'];
export const MATCH_QUALITY = ['excellent', 'good', 'fair'];
export const ORG_TYPES = ['hospital', 'blood_bank', 'donation_center'];
export const ORG_ROLES = ['admin', 'coordinator', 'staff'];
export const BLOOD_COMPONENTS = ['whole_blood', 'red_cells', 'platelets', 'plasma'];
export const NOTIFICATION_CATEGORIES = ['emergency', 'requests', 'donations', 'account'];
export const NOTIFICATION_TYPES = [
  'emergency_request',
  'request_submitted',
  'request_verified',
  'request_rejected',
  'request_status_changed',
  'request_expired',
  'donor_accepted',
  'donor_declined',
  'donation_scheduled',
  'donation_completed',
  'donation_cancelled',
  'verification_update',
  'organization_update',
  'support_reply',
  'reminder',
];
export const VERIFICATION_SUBJECTS = ['user', 'donor', 'organization'];
export const DOCUMENT_TYPES = [
  'national_id',
  'passport',
  'driving_licence',
  'donor_card',
  'organization_registration',
  'other',
];
export const SUPPORT_CATEGORIES = ['account', 'request', 'donation', 'verification', 'other'];
export const SUPPORT_STATUSES = ['open', 'in_progress', 'resolved'];

const s = (key, size, opts = {}) => ({ key, type: 'string', size, required: false, ...opts });
const i = (key, opts = {}) => ({ key, type: 'integer', required: false, ...opts });
const f = (key, opts = {}) => ({ key, type: 'float', required: false, ...opts });
const b = (key, opts = {}) => ({ key, type: 'boolean', required: false, ...opts });
const d = (key, opts = {}) => ({ key, type: 'datetime', required: false, ...opts });
const e = (key, elements, opts = {}) => ({ key, type: 'enum', elements, required: false, ...opts });
const req = (column) => ({ ...column, required: true });

/**
 * `defaults` for required=false columns are applied via xdefault.
 * Index type: key | unique. `orders` optional.
 */
export const TABLES = [
  {
    id: 'profiles',
    name: 'Profiles',
    description: 'One row per user (row ID = Appwrite user ID). Private to the owner and admins.',
    permissions: [],
    columns: [
      req(s('userId', 36)),
      req(s('displayName', 80)),
      s('phone', 20),
      e('bloodGroup', BLOOD_GROUPS),
      s('district', 40),
      s('city', 60),
      f('approxLat', { min: -90, max: 90 }),
      f('approxLng', { min: -180, max: 180 }),
      b('isDonor', { xdefault: false }),
      b('locationConsent', { xdefault: false }),
      b('onboardingComplete', { xdefault: false }),
      e('verificationStatus', VERIFICATION, { xdefault: 'not_submitted' }),
      s('notificationPrefs', 1000),
      s('privacyPrefs', 500),
      s('avatarFileId', 36),
    ],
    indexes: [{ key: 'idx_user', type: 'unique', columns: ['userId'] }],
  },
  {
    id: 'donor_profiles',
    name: 'Donor profiles',
    description:
      'Donor availability and coarse location (row ID = user ID). Never readable by other users; matching runs server-side.',
    permissions: [],
    columns: [
      req(s('donorId', 36)),
      req(s('displayName', 80)),
      req(e('bloodGroup', BLOOD_GROUPS)),
      e('availability', AVAILABILITY, { xdefault: 'unknown' }),
      d('availabilityUpdatedAt'),
      d('availableUntil'),
      i('radiusKm', { min: 1, max: 100, xdefault: 15 }),
      b('emergencyAlerts', { xdefault: true }),
      d('lastDonationDate'),
      i('donationCount', { min: 0, xdefault: 0 }),
      s('district', 40),
      f('approxLat', { min: -90, max: 90 }),
      f('approxLng', { min: -180, max: 180 }),
      e('verificationStatus', VERIFICATION, { xdefault: 'not_submitted' }),
    ],
    indexes: [
      { key: 'idx_donor', type: 'unique', columns: ['donorId'] },
      { key: 'idx_match', type: 'key', columns: ['availability', 'bloodGroup'] },
    ],
  },
  {
    id: 'blood_requests',
    name: 'Blood requests',
    description:
      'Emergency and standard blood requests. Readable by the requester, the addressed hospital organization, contacted donors and admins.',
    permissions: [],
    columns: [
      req(s('requesterId', 36)),
      req(s('requesterName', 80)),
      req(e('bloodGroup', BLOOD_GROUPS)),
      req(i('units', { min: 1, max: 20 })),
      i('unitsAccepted', { min: 0, xdefault: 0 }),
      i('unitsCompleted', { min: 0, xdefault: 0 }),
      i('contactedCount', { min: 0, xdefault: 0 }),
      req(e('urgency', URGENCY)),
      req(e('status', REQUEST_STATUSES)),
      e('verificationStatus', VERIFICATION, { xdefault: 'pending' }),
      s('hospitalId', 36),
      req(s('hospitalName', 120)),
      req(s('district', 40)),
      s('city', 60),
      s('wardUnit', 80),
      f('approxLat', { min: -90, max: 90 }),
      f('approxLng', { min: -180, max: 180 }),
      d('requiredBy'),
      d('expiresAt'),
      s('notes', 500),
      s('relationship', 60),
      s('statusHistory', 6000),
      s('verifiedBy', 36),
      d('verifiedAt'),
      s('cancelledReason', 200),
    ],
    indexes: [
      { key: 'idx_requester', type: 'key', columns: ['requesterId', 'status'] },
      { key: 'idx_status', type: 'key', columns: ['status'] },
      { key: 'idx_hospital', type: 'key', columns: ['hospitalId', 'status'] },
      { key: 'idx_expiry', type: 'key', columns: ['expiresAt'] },
    ],
  },
  {
    id: 'request_responses',
    name: 'Request responses',
    description: 'A donor being contacted for a request, and their accept/decline response.',
    permissions: [],
    columns: [
      req(s('requestId', 36)),
      req(s('donorId', 36)),
      req(s('donorName', 80)),
      req(e('donorBloodGroup', BLOOD_GROUPS)),
      req(s('requesterId', 36)),
      s('hospitalId', 36),
      req(e('status', RESPONSE_STATUSES)),
      e('matchQuality', MATCH_QUALITY),
      f('distanceKm', { min: 0 }),
      s('declineReason', 200),
      d('respondedAt'),
    ],
    indexes: [
      { key: 'idx_request_donor', type: 'unique', columns: ['requestId', 'donorId'] },
      { key: 'idx_donor_status', type: 'key', columns: ['donorId', 'status'] },
      { key: 'idx_request', type: 'key', columns: ['requestId'] },
    ],
  },
  {
    id: 'donations',
    name: 'Donations',
    description: 'Coordination record created when a donor accepts; becomes the donation history entry.',
    permissions: [],
    columns: [
      req(s('requestId', 36)),
      req(s('responseId', 36)),
      req(s('donorId', 36)),
      req(s('donorName', 80)),
      req(s('requesterId', 36)),
      s('hospitalId', 36),
      req(s('hospitalName', 120)),
      req(e('bloodGroup', BLOOD_GROUPS)),
      i('units', { min: 1, xdefault: 1 }),
      req(e('status', DONATION_STATUSES)),
      d('scheduledFor'),
      d('completedAt'),
      s('confirmedBy', 36),
      s('coordinationNote', 300),
    ],
    indexes: [
      { key: 'idx_response', type: 'unique', columns: ['responseId'] },
      { key: 'idx_donor', type: 'key', columns: ['donorId'] },
      { key: 'idx_requester', type: 'key', columns: ['requesterId'] },
      { key: 'idx_request', type: 'key', columns: ['requestId'] },
      { key: 'idx_hospital', type: 'key', columns: ['hospitalId'] },
    ],
  },
  {
    id: 'organizations',
    name: 'Organizations',
    description:
      'Hospitals, blood banks and donation centres. The directory is readable by every signed-in user; writes go through the function.',
    permissions: ['read("users")'],
    columns: [
      req(s('name', 120)),
      req(e('type', ORG_TYPES)),
      req(s('district', 40)),
      s('city', 60),
      s('address', 200),
      f('approxLat', { min: -90, max: 90 }),
      f('approxLng', { min: -180, max: 180 }),
      s('phone', 20),
      s('registrationNumber', 60),
      e('verificationStatus', VERIFICATION, { xdefault: 'not_submitted' }),
      b('claimed', { xdefault: false }),
    ],
    indexes: [
      { key: 'idx_district', type: 'key', columns: ['district', 'type'] },
      { key: 'idx_name', type: 'key', columns: ['name'] },
    ],
  },
  {
    id: 'organization_members',
    name: 'Organization members',
    description: 'Membership of users in organizations.',
    permissions: [],
    columns: [
      req(s('organizationId', 36)),
      req(s('userId', 36)),
      req(s('displayName', 80)),
      req(e('role', ORG_ROLES)),
      b('active', { xdefault: true }),
    ],
    indexes: [
      { key: 'idx_org_user', type: 'unique', columns: ['organizationId', 'userId'] },
      { key: 'idx_user', type: 'key', columns: ['userId'] },
    ],
  },
  {
    id: 'blood_inventory',
    name: 'Blood inventory',
    description: 'Self-reported stock maintained by authorized organization members. Not an authoritative medical inventory.',
    permissions: [],
    columns: [
      req(s('organizationId', 36)),
      req(e('bloodGroup', BLOOD_GROUPS)),
      req(e('component', BLOOD_COMPONENTS)),
      req(i('unitsAvailable', { min: 0 })),
      req(i('unitsReserved', { min: 0 })),
      i('lowStockThreshold', { min: 0, xdefault: 5 }),
      s('updatedBy', 36),
    ],
    indexes: [
      { key: 'idx_org_group', type: 'unique', columns: ['organizationId', 'bloodGroup', 'component'] },
      { key: 'idx_org', type: 'key', columns: ['organizationId'] },
    ],
  },
  {
    id: 'notifications',
    name: 'Notifications',
    description: 'In-app notifications. Owner can read, mark read and delete; created by the function.',
    permissions: [],
    columns: [
      req(s('userId', 36)),
      req(e('type', NOTIFICATION_TYPES)),
      req(e('category', NOTIFICATION_CATEGORIES)),
      req(s('title', 120)),
      req(s('body', 400)),
      req(s('route', 200)),
      s('actionLabel', 40),
      s('requestId', 36),
      b('read', { xdefault: false }),
      d('readAt'),
    ],
    indexes: [
      { key: 'idx_user_read', type: 'key', columns: ['userId', 'read'] },
      { key: 'idx_user_category', type: 'key', columns: ['userId', 'category'] },
    ],
  },
  {
    id: 'verifications',
    name: 'Verifications',
    description: 'Verification submissions (user identity, donor, organization) and reviewer decisions.',
    permissions: [],
    columns: [
      req(e('subjectType', VERIFICATION_SUBJECTS)),
      req(s('userId', 36)),
      s('organizationId', 36),
      req(s('displayName', 80)),
      e('status', VERIFICATION, { xdefault: 'pending' }),
      e('documentType', DOCUMENT_TYPES),
      s('documentFileIds', 36, { array: true }),
      s('note', 300),
      s('reviewerNote', 300),
      s('reviewedBy', 36),
      d('reviewedAt'),
      s('payload', 2000),
    ],
    indexes: [
      { key: 'idx_status', type: 'key', columns: ['status', 'subjectType'] },
      { key: 'idx_user', type: 'key', columns: ['userId'] },
    ],
  },
  {
    id: 'audit_logs',
    name: 'Audit logs',
    description: 'Important system actions. Admin read only; written by the function.',
    permissions: [],
    columns: [
      req(s('actorId', 36)),
      s('actorRole', 20),
      req(s('action', 60)),
      req(s('entityType', 40)),
      req(s('entityId', 36)),
      req(s('summary', 300)),
      s('metadata', 1000),
    ],
    indexes: [
      { key: 'idx_entity', type: 'key', columns: ['entityType', 'entityId'] },
      { key: 'idx_action', type: 'key', columns: ['action'] },
      { key: 'idx_actor', type: 'key', columns: ['actorId'] },
    ],
  },
  {
    id: 'support_tickets',
    name: 'Support tickets',
    description: 'Lightweight support requests.',
    permissions: [],
    columns: [
      req(s('userId', 36)),
      req(e('category', SUPPORT_CATEGORIES)),
      req(s('subject', 100)),
      req(s('message', 1000)),
      e('status', SUPPORT_STATUSES, { xdefault: 'open' }),
      s('reply', 1000),
      s('repliedBy', 36),
    ],
    indexes: [
      { key: 'idx_user', type: 'key', columns: ['userId'] },
      { key: 'idx_status', type: 'key', columns: ['status'] },
    ],
  },
  {
    id: 'system_settings',
    name: 'System settings',
    description: 'Platform configuration (single row, ID "global"). Readable by signed-in users; admin writes via the function.',
    permissions: ['read("users")'],
    columns: [
      i('defaultRadiusKm', { min: 1, max: 100, xdefault: 30 }),
      i('requestExpiryHours', { min: 1, max: 720, xdefault: 72 }),
      i('maxDonorsContacted', { min: 1, max: 50, xdefault: 5 }),
      b('requireVerifiedDonors', { xdefault: false }),
      b('maintenanceMode', { xdefault: false }),
      s('updatedBy', 36),
    ],
    indexes: [],
  },
];

export const BUCKETS = [
  {
    id: 'files',
    name: 'DonorLink private files',
    fileSecurity: true,
    maximumFileSize: 5 * 1024 * 1024,
    allowedFileExtensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    encryption: true,
    permissions: ['create("users")'],
  },
];

export const FUNCTION = {
  id: 'donorlink-api',
  name: 'DonorLink API',
  runtime: 'node-22',
  entrypoint: 'src/main.js',
  commands: 'npm install',
  timeout: 30,
  schedule: '*/15 * * * *', // maintenance: expire stale requests
  execute: ['users'],
  scopes: [
    'users.read',
    'users.write',
    'databases.read',
    'databases.write',
    'tables.read',
    'tables.write',
    'columns.read',
    'indexes.read',
    'rows.read',
    'rows.write',
    'buckets.read',
    'files.read',
  ],
};

/**
 * A small directory of real Sri Lankan public hospitals so that requesters can
 * pick a hospital on day one. They are seeded as UNCLAIMED / UNVERIFIED
 * directory entries: DonorLink never claims these hospitals take part in the
 * platform until an authorized member registers and an admin verifies them.
 * Coordinates are approximate.
 */
export const DIRECTORY_HOSPITALS = [
  { id: 'dirnhsl', name: 'National Hospital of Sri Lanka', district: 'Colombo', city: 'Colombo 10', lat: 6.92, lng: 79.87 },
  { id: 'dirlrh', name: 'Lady Ridgeway Hospital for Children', district: 'Colombo', city: 'Colombo 08', lat: 6.91, lng: 79.88 },
  { id: 'dircswh', name: 'De Soysa Hospital for Women', district: 'Colombo', city: 'Colombo 08', lat: 6.92, lng: 79.88 },
  { id: 'dirragama', name: 'Colombo North Teaching Hospital, Ragama', district: 'Gampaha', city: 'Ragama', lat: 7.03, lng: 79.92 },
  { id: 'dirkandy', name: 'Teaching Hospital Kandy', district: 'Kandy', city: 'Kandy', lat: 7.29, lng: 80.64 },
  { id: 'dirkarapitiya', name: 'Teaching Hospital Karapitiya', district: 'Galle', city: 'Galle', lat: 6.07, lng: 80.21 },
  { id: 'dirjaffna', name: 'Teaching Hospital Jaffna', district: 'Jaffna', city: 'Jaffna', lat: 9.66, lng: 80.01 },
  { id: 'diranuradhapura', name: 'Teaching Hospital Anuradhapura', district: 'Anuradhapura', city: 'Anuradhapura', lat: 8.33, lng: 80.41 },
  { id: 'dirkurunegala', name: 'Teaching Hospital Kurunegala', district: 'Kurunegala', city: 'Kurunegala', lat: 7.49, lng: 80.36 },
  { id: 'dirratnapura', name: 'Teaching Hospital Ratnapura', district: 'Ratnapura', city: 'Ratnapura', lat: 6.69, lng: 80.4 },
  { id: 'dirbatticaloa', name: 'Teaching Hospital Batticaloa', district: 'Batticaloa', city: 'Batticaloa', lat: 7.71, lng: 81.7 },
  { id: 'dirbadulla', name: 'Provincial General Hospital Badulla', district: 'Badulla', city: 'Badulla', lat: 6.99, lng: 81.05 },
];
