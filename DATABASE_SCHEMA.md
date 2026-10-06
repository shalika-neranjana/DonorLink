# DonorLink database schema

> Generated from [`appwrite/schema.mjs`](appwrite/schema.mjs) by `npm run docs:schema`. Do not edit by hand.

Database: **DonorLinkDB** (ID `donorlink`). All tables have **row security enabled**.

## How access works

- Clients **read** rows through Appwrite row-level permissions (owner, requester, contacted donors, organization members via `orgm<id>` labels, admins via the `admin` label).
- Almost all **writes** go through the `donorlink-api` Appwrite Function, which authenticates the caller, validates input again and enforces the status-transition rules. Tables therefore grant no client create/update/delete permission, except `notifications` (owner may mark read / delete).
- Roles are Appwrite **user labels**: `admin`, `organization`, and `orgm<organizationId>`. Labels can only be changed server-side.

## Tables

### `profiles`

One row per user (row ID = Appwrite user ID). Private to the owner and admins.

Table permissions: none (row-level only)

| Column | Type | Required | Default |
| --- | --- | --- | --- |
| `userId` | string(36) | yes |  |
| `displayName` | string(80) | yes |  |
| `phone` | string(20) | no |  |
| `bloodGroup` | enum: A+ \| A- \| B+ \| B- \| AB+ \| AB- \| O+ \| O- | no |  |
| `district` | string(40) | no |  |
| `city` | string(60) | no |  |
| `approxLat` | float (-90..90) | no |  |
| `approxLng` | float (-180..180) | no |  |
| `isDonor` | boolean | no | `false` |
| `locationConsent` | boolean | no | `false` |
| `onboardingComplete` | boolean | no | `false` |
| `verificationStatus` | enum: not_submitted \| pending \| verified \| needs_attention \| rejected | no | `not_submitted` |
| `notificationPrefs` | string(1000) | no |  |
| `privacyPrefs` | string(500) | no |  |
| `avatarFileId` | string(36) | no |  |

Indexes: `idx_user` (unique: userId)

### `donor_profiles`

Donor availability and coarse location (row ID = user ID). Never readable by other users; matching runs server-side.

Table permissions: none (row-level only)

| Column | Type | Required | Default |
| --- | --- | --- | --- |
| `donorId` | string(36) | yes |  |
| `displayName` | string(80) | yes |  |
| `bloodGroup` | enum: A+ \| A- \| B+ \| B- \| AB+ \| AB- \| O+ \| O- | yes |  |
| `availability` | enum: available \| unavailable \| temporarily_unavailable \| unknown | no | `unknown` |
| `availabilityUpdatedAt` | datetime | no |  |
| `availableUntil` | datetime | no |  |
| `radiusKm` | integer (1..100) | no | `15` |
| `emergencyAlerts` | boolean | no | `true` |
| `lastDonationDate` | datetime | no |  |
| `donationCount` | integer (0..) | no | `0` |
| `district` | string(40) | no |  |
| `approxLat` | float (-90..90) | no |  |
| `approxLng` | float (-180..180) | no |  |
| `verificationStatus` | enum: not_submitted \| pending \| verified \| needs_attention \| rejected | no | `not_submitted` |

Indexes: `idx_donor` (unique: donorId); `idx_match` (key: availability, bloodGroup)

### `blood_requests`

Emergency and standard blood requests. Readable by the requester, the addressed hospital organization, contacted donors and admins.

Table permissions: none (row-level only)

| Column | Type | Required | Default |
| --- | --- | --- | --- |
| `requesterId` | string(36) | yes |  |
| `requesterName` | string(80) | yes |  |
| `bloodGroup` | enum: A+ \| A- \| B+ \| B- \| AB+ \| AB- \| O+ \| O- | yes |  |
| `units` | integer (1..20) | yes |  |
| `unitsAccepted` | integer (0..) | no | `0` |
| `unitsCompleted` | integer (0..) | no | `0` |
| `contactedCount` | integer (0..) | no | `0` |
| `urgency` | enum: critical \| urgent \| standard | yes |  |
| `status` | enum: draft \| submitted \| pending_verification \| verified \| matching \| donors_contacted \| partially_fulfilled \| fulfilled \| completed \| cancelled \| expired \| rejected | yes |  |
| `verificationStatus` | enum: not_submitted \| pending \| verified \| needs_attention \| rejected | no | `pending` |
| `hospitalId` | string(36) | no |  |
| `hospitalName` | string(120) | yes |  |
| `district` | string(40) | yes |  |
| `city` | string(60) | no |  |
| `wardUnit` | string(80) | no |  |
| `approxLat` | float (-90..90) | no |  |
| `approxLng` | float (-180..180) | no |  |
| `requiredBy` | datetime | no |  |
| `expiresAt` | datetime | no |  |
| `notes` | string(500) | no |  |
| `relationship` | string(60) | no |  |
| `statusHistory` | string(6000) | no |  |
| `verifiedBy` | string(36) | no |  |
| `verifiedAt` | datetime | no |  |
| `cancelledReason` | string(200) | no |  |

Indexes: `idx_requester` (key: requesterId, status); `idx_status` (key: status); `idx_hospital` (key: hospitalId, status); `idx_expiry` (key: expiresAt)

### `request_responses`

A donor being contacted for a request, and their accept/decline response.

Table permissions: none (row-level only)

| Column | Type | Required | Default |
| --- | --- | --- | --- |
| `requestId` | string(36) | yes |  |
| `donorId` | string(36) | yes |  |
| `donorName` | string(80) | yes |  |
| `donorBloodGroup` | enum: A+ \| A- \| B+ \| B- \| AB+ \| AB- \| O+ \| O- | yes |  |
| `requesterId` | string(36) | yes |  |
| `hospitalId` | string(36) | no |  |
| `status` | enum: pending \| accepted \| declined \| withdrawn \| completed \| expired | yes |  |
| `matchQuality` | enum: excellent \| good \| fair | no |  |
| `distanceKm` | float (0..) | no |  |
| `declineReason` | string(200) | no |  |
| `respondedAt` | datetime | no |  |

Indexes: `idx_request_donor` (unique: requestId, donorId); `idx_donor_status` (key: donorId, status); `idx_request` (key: requestId)

### `donations`

Coordination record created when a donor accepts; becomes the donation history entry.

Table permissions: none (row-level only)

| Column | Type | Required | Default |
| --- | --- | --- | --- |
| `requestId` | string(36) | yes |  |
| `responseId` | string(36) | yes |  |
| `donorId` | string(36) | yes |  |
| `donorName` | string(80) | yes |  |
| `requesterId` | string(36) | yes |  |
| `hospitalId` | string(36) | no |  |
| `hospitalName` | string(120) | yes |  |
| `bloodGroup` | enum: A+ \| A- \| B+ \| B- \| AB+ \| AB- \| O+ \| O- | yes |  |
| `units` | integer (1..) | no | `1` |
| `status` | enum: scheduled \| completed \| cancelled \| no_show | yes |  |
| `scheduledFor` | datetime | no |  |
| `completedAt` | datetime | no |  |
| `confirmedBy` | string(36) | no |  |
| `coordinationNote` | string(300) | no |  |

Indexes: `idx_response` (unique: responseId); `idx_donor` (key: donorId); `idx_requester` (key: requesterId); `idx_request` (key: requestId); `idx_hospital` (key: hospitalId)

### `organizations`

Hospitals, blood banks and donation centres. The directory is readable by every signed-in user; writes go through the function.

Table permissions: `read("users")`

| Column | Type | Required | Default |
| --- | --- | --- | --- |
| `name` | string(120) | yes |  |
| `type` | enum: hospital \| blood_bank \| donation_center | yes |  |
| `district` | string(40) | yes |  |
| `city` | string(60) | no |  |
| `address` | string(200) | no |  |
| `approxLat` | float (-90..90) | no |  |
| `approxLng` | float (-180..180) | no |  |
| `phone` | string(20) | no |  |
| `registrationNumber` | string(60) | no |  |
| `verificationStatus` | enum: not_submitted \| pending \| verified \| needs_attention \| rejected | no | `not_submitted` |
| `claimed` | boolean | no | `false` |

Indexes: `idx_district` (key: district, type); `idx_name` (key: name)

### `organization_members`

Membership of users in organizations.

Table permissions: none (row-level only)

| Column | Type | Required | Default |
| --- | --- | --- | --- |
| `organizationId` | string(36) | yes |  |
| `userId` | string(36) | yes |  |
| `displayName` | string(80) | yes |  |
| `role` | enum: admin \| coordinator \| staff | yes |  |
| `active` | boolean | no | `true` |

Indexes: `idx_org_user` (unique: organizationId, userId); `idx_user` (key: userId)

### `blood_inventory`

Self-reported stock maintained by authorized organization members. Not an authoritative medical inventory.

Table permissions: none (row-level only)

| Column | Type | Required | Default |
| --- | --- | --- | --- |
| `organizationId` | string(36) | yes |  |
| `bloodGroup` | enum: A+ \| A- \| B+ \| B- \| AB+ \| AB- \| O+ \| O- | yes |  |
| `component` | enum: whole_blood \| red_cells \| platelets \| plasma | yes |  |
| `unitsAvailable` | integer (0..) | yes |  |
| `unitsReserved` | integer (0..) | yes |  |
| `lowStockThreshold` | integer (0..) | no | `5` |
| `updatedBy` | string(36) | no |  |

Indexes: `idx_org_group` (unique: organizationId, bloodGroup, component); `idx_org` (key: organizationId)

### `notifications`

In-app notifications. Owner can read, mark read and delete; created by the function.

Table permissions: none (row-level only)

| Column | Type | Required | Default |
| --- | --- | --- | --- |
| `userId` | string(36) | yes |  |
| `type` | enum: emergency_request \| request_submitted \| request_verified \| request_rejected \| request_status_changed \| request_expired \| donor_accepted \| donor_declined \| donation_scheduled \| donation_completed \| donation_cancelled \| verification_update \| organization_update \| support_reply \| reminder | yes |  |
| `category` | enum: emergency \| requests \| donations \| account | yes |  |
| `title` | string(120) | yes |  |
| `body` | string(400) | yes |  |
| `route` | string(200) | yes |  |
| `actionLabel` | string(40) | no |  |
| `requestId` | string(36) | no |  |
| `read` | boolean | no | `false` |
| `readAt` | datetime | no |  |

Indexes: `idx_user_read` (key: userId, read); `idx_user_category` (key: userId, category)

### `verifications`

Verification submissions (user identity, donor, organization) and reviewer decisions.

Table permissions: none (row-level only)

| Column | Type | Required | Default |
| --- | --- | --- | --- |
| `subjectType` | enum: user \| donor \| organization | yes |  |
| `userId` | string(36) | yes |  |
| `organizationId` | string(36) | no |  |
| `displayName` | string(80) | yes |  |
| `status` | enum: not_submitted \| pending \| verified \| needs_attention \| rejected | no | `pending` |
| `documentType` | enum: national_id \| passport \| driving_licence \| donor_card \| organization_registration \| other | no |  |
| `documentFileIds` | string(36)[] | no |  |
| `note` | string(300) | no |  |
| `reviewerNote` | string(300) | no |  |
| `reviewedBy` | string(36) | no |  |
| `reviewedAt` | datetime | no |  |
| `payload` | string(2000) | no |  |

Indexes: `idx_status` (key: status, subjectType); `idx_user` (key: userId)

### `audit_logs`

Important system actions. Admin read only; written by the function.

Table permissions: none (row-level only)

| Column | Type | Required | Default |
| --- | --- | --- | --- |
| `actorId` | string(36) | yes |  |
| `actorRole` | string(20) | no |  |
| `action` | string(60) | yes |  |
| `entityType` | string(40) | yes |  |
| `entityId` | string(36) | yes |  |
| `summary` | string(300) | yes |  |
| `metadata` | string(1000) | no |  |

Indexes: `idx_entity` (key: entityType, entityId); `idx_action` (key: action); `idx_actor` (key: actorId)

### `support_tickets`

Lightweight support requests.

Table permissions: none (row-level only)

| Column | Type | Required | Default |
| --- | --- | --- | --- |
| `userId` | string(36) | yes |  |
| `category` | enum: account \| request \| donation \| verification \| other | yes |  |
| `subject` | string(100) | yes |  |
| `message` | string(1000) | yes |  |
| `status` | enum: open \| in_progress \| resolved | no | `open` |
| `reply` | string(1000) | no |  |
| `repliedBy` | string(36) | no |  |

Indexes: `idx_user` (key: userId); `idx_status` (key: status)

### `system_settings`

Platform configuration (single row, ID "global"). Readable by signed-in users; admin writes via the function.

Table permissions: `read("users")`

| Column | Type | Required | Default |
| --- | --- | --- | --- |
| `defaultRadiusKm` | integer (1..100) | no | `30` |
| `requestExpiryHours` | integer (1..720) | no | `72` |
| `maxDonorsContacted` | integer (1..50) | no | `5` |
| `requireVerifiedDonors` | boolean | no | `false` |
| `maintenanceMode` | boolean | no | `false` |
| `updatedBy` | string(36) | no |  |

## Storage buckets

| Bucket | Purpose | Max size | Extensions | Notes |
| --- | --- | --- | --- | --- |
| `avatars` | Profile photos | 2 MB | jpg, jpeg, png, webp | file security on; users may create, each file readable only by its owner and admins |
| `verification_docs` | Verification documents | 5 MB | jpg, jpeg, png, pdf | file security on; users may create, each file readable only by its owner and admins; encrypted |

## Function

`donorlink-api` (node-22, entrypoint `src/main.js`). Execute permission: signed-in users. Schedule `*/15 * * * *` runs maintenance (expires stale requests). Scopes: `users.read`, `users.write`, `databases.read`, `databases.write`, `tables.read`, `tables.write`, `columns.read`, `indexes.read`, `rows.read`, `rows.write`, `buckets.read`, `files.read`.

## Seed data

`system_settings/global` plus a directory of real public hospitals, seeded as **unclaimed, unverified listings** (DonorLink makes no claim that they participate until an authorized member registers and an administrator verifies them). Coordinates are approximate.

- National Hospital of Sri Lanka (Colombo)
- Lady Ridgeway Hospital for Children (Colombo)
- De Soysa Hospital for Women (Colombo)
- Colombo North Teaching Hospital, Ragama (Gampaha)
- Teaching Hospital Kandy (Kandy)
- Teaching Hospital Karapitiya (Galle)
- Teaching Hospital Jaffna (Jaffna)
- Teaching Hospital Anuradhapura (Anuradhapura)
- Teaching Hospital Kurunegala (Kurunegala)
- Teaching Hospital Ratnapura (Ratnapura)
- Teaching Hospital Batticaloa (Batticaloa)
- Provincial General Hospital Badulla (Badulla)
