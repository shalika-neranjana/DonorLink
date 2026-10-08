const { ID, Query, Permission, Role } = require('node-appwrite');
const domain = require('../lib/domain');
const { validation, notFound, conflict } = require('../lib/errors');
const { audit, notify, ownerReadPerms, requireAdmin, requireFields, iso } = require('../lib/context');

const DOCS_BUCKET = 'files';

/** Files must exist and have been uploaded (read-permitted) by the caller. */
async function assertOwnFiles(ctx, fileIds, field = 'documentFileIds') {
  for (const fileId of fileIds) {
    let file;
    try {
      file = await ctx.storage.getFile({ bucketId: DOCS_BUCKET, fileId });
    } catch {
      throw validation({ [field]: 'One of the uploaded files could not be found. Please upload it again.' });
    }
    const owned = (file.$permissions || []).includes(Permission.read(Role.user(ctx.userId)));
    if (!owned) throw validation({ [field]: 'You can only use files you uploaded.' });
  }
}

async function submitVerification(ctx, payload) {
  requireFields(payload, ['subjectType']);
  const subjectType = payload.subjectType;
  if (!domain.VERIFICATION_SUBJECTS.includes(subjectType)) {
    throw validation({ subjectType: 'Choose what you want verified.' });
  }

  const docs = domain.validateVerificationSubmission({
    documentType: payload.documentType,
    note: payload.note,
    documentFileIds: payload.documentFileIds,
  });
  if (!docs.ok) throw validation(docs.errors);

  const profile = await ctx.store.get('profiles', ctx.userId);
  if (!profile) throw notFound('Complete your profile before requesting verification.');

  let organizationPayload = null;
  if (subjectType === 'donor') {
    const donor = await ctx.store.get('donor_profiles', ctx.userId);
    if (!donor) throw conflict('no_donor_profile', 'Set up your donor profile before requesting donor verification.');
  }
  if (subjectType === 'organization') {
    const org = domain.validateOrganizationRegistration(payload.organization || {});
    if (!org.ok) throw validation(org.errors);
    organizationPayload = org.value;
    const claimId = payload.organization && payload.organization.claimOrganizationId;
    if (claimId) {
      const listing = await ctx.store.get('organizations', claimId);
      if (!listing) throw validation({ name: 'That directory listing no longer exists.' });
      if (listing.claimed) throw conflict('already_claimed', 'That organization is already registered.');
      organizationPayload.claimOrganizationId = claimId;
    }
  }

  const pending = await ctx.store.first('verifications', [
    Query.equal('userId', [ctx.userId]),
    Query.equal('subjectType', [subjectType]),
    Query.equal('status', ['pending']),
  ]);
  if (pending) throw conflict('already_pending', 'You already have a verification waiting for review.');

  await assertOwnFiles(ctx, docs.value.documentFileIds);

  const row = await ctx.store.create(
    'verifications',
    ID.unique(),
    {
      subjectType,
      userId: ctx.userId,
      displayName: profile.displayName,
      status: 'pending',
      documentType: docs.value.documentType,
      documentFileIds: docs.value.documentFileIds,
      note: docs.value.note ?? null,
      payload: organizationPayload ? JSON.stringify(organizationPayload) : null,
    },
    ownerReadPerms(ctx.userId),
  );

  if (subjectType === 'user') await ctx.store.update('profiles', ctx.userId, { verificationStatus: 'pending' });
  if (subjectType === 'donor') await ctx.store.update('donor_profiles', ctx.userId, { verificationStatus: 'pending' });

  await audit(ctx, 'verification.submitted', 'verification', row.$id, `${subjectType} verification submitted`);
  return { verification: row };
}

async function createOrganizationFromVerification(ctx, verification) {
  const details = JSON.parse(verification.payload || '{}');
  const { claimOrganizationId } = details;
  const data = {
    name: details.name,
    type: details.type,
    district: details.district,
    city: details.city ?? null,
    address: details.address ?? null,
    phone: details.phone ?? null,
    registrationNumber: details.registrationNumber ?? null,
    verificationStatus: 'verified',
    claimed: true,
  };
  if (details.location) {
    data.approxLat = details.location.lat;
    data.approxLng = details.location.lng;
  }

  let org;
  if (claimOrganizationId) {
    const listing = await ctx.store.get('organizations', claimOrganizationId);
    if (!listing || listing.claimed) throw conflict('already_claimed', 'That organization is already registered.');
    // Keep the directory's name/location; take contact details from the registration.
    org = await ctx.store.update('organizations', claimOrganizationId, {
      type: data.type,
      phone: data.phone,
      address: data.address ?? listing.address ?? null,
      registrationNumber: data.registrationNumber,
      verificationStatus: 'verified',
      claimed: true,
    });
  } else {
    org = await ctx.store.create('organizations', ID.unique(), data);
  }

  await ctx.store.create(
    'organization_members',
    ID.unique(),
    { organizationId: org.$id, userId: verification.userId, displayName: verification.displayName, role: 'admin', active: true },
    [
      Permission.read(Role.user(verification.userId)),
      Permission.read(Role.label(domain.LABEL_ADMIN)),
      Permission.read(Role.label(domain.organizationLabel(org.$id))),
    ],
  );

  const user = await ctx.users.get({ userId: verification.userId });
  await ctx.users.updateLabels({
    userId: verification.userId,
    labels: domain.withOrganizationMembership(user.labels || [], org.$id, true),
  });
  return org;
}

async function reviewVerification(ctx, payload) {
  requireAdmin(ctx);
  requireFields(payload, ['verificationId', 'decision']);
  if (!['verified', 'rejected', 'needs_attention'].includes(payload.decision)) {
    throw validation({ decision: 'Choose a valid decision.' });
  }
  const verification = await ctx.store.get('verifications', payload.verificationId);
  if (!verification) throw notFound('Verification not found.');
  if (verification.status === payload.decision) {
    throw conflict('already_reviewed', 'That decision was already recorded.');
  }
  if (payload.decision !== 'verified') {
    const note = typeof payload.note === 'string' ? payload.note.trim() : '';
    if (!note) throw validation({ note: 'Add a short note so the user knows what to fix.' });
  }

  let organization = null;
  if (verification.subjectType === 'organization') {
    if (verification.organizationId) {
      // Already approved once: change that organization's standing instead of
      // creating a second organization and membership.
      organization = await ctx.store.update('organizations', verification.organizationId, {
        verificationStatus: payload.decision,
      });
    } else if (payload.decision === 'verified') {
      organization = await createOrganizationFromVerification(ctx, verification);
    }
  }

  const note = typeof payload.note === 'string' ? payload.note.trim().slice(0, 300) : '';
  const updated = await ctx.store.update('verifications', verification.$id, {
    status: payload.decision,
    reviewerNote: note || null,
    reviewedBy: ctx.userId,
    reviewedAt: iso(ctx.now()),
    organizationId: organization ? organization.$id : verification.organizationId ?? null,
  });

  if (verification.subjectType === 'user') {
    await ctx.store.update('profiles', verification.userId, { verificationStatus: payload.decision });
  } else if (verification.subjectType === 'donor') {
    const donor = await ctx.store.get('donor_profiles', verification.userId);
    if (donor) await ctx.store.update('donor_profiles', verification.userId, { verificationStatus: payload.decision });
  }

  await notify(ctx, verification.userId, 'verification_update', {
    status: domain.VERIFICATION_LABELS[payload.decision],
    verificationSubject: verification.subjectType === 'user' ? 'identity' : verification.subjectType,
  });
  await audit(ctx, 'verification.reviewed', 'verification', verification.$id, `${verification.subjectType} verification ${payload.decision}`, note ? { note } : undefined);
  return { verification: updated, organization };
}

module.exports = { submitVerification, reviewVerification, assertOwnFiles };
