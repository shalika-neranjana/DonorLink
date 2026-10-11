const { Query } = require('node-appwrite');
const domain = require('../lib/domain');
const { conflict, validation } = require('../lib/errors');
const { audit, transitionRequest } = require('../lib/context');
const { closeResponses } = require('./request');

const FILES_BUCKET = 'files';

/** Row deletes tolerate rows that are already gone, so a retry after a partial failure completes. */
async function removeRows(ctx, tableId, rows) {
  for (const row of rows) {
    try {
      await ctx.store.remove(tableId, row.$id);
    } catch (error) {
      if (!error || error.code !== 404) throw error;
    }
  }
}

async function removeFile(ctx, fileId) {
  if (!fileId) return;
  try {
    await ctx.storage.deleteFile({ bucketId: FILES_BUCKET, fileId });
  } catch (error) {
    ctx.log(`account.delete: could not remove file ${fileId}: ${error && error.message}`);
  }
}

/**
 * Permanently deletes the caller's account and personal data.
 *
 * Requests and donations that other people took part in are kept as anonymous
 * history (the Appwrite user they point at no longer exists); anything still
 * in flight is cancelled first so nobody is left waiting on a deleted user.
 */
async function deleteAccount(ctx, payload) {
  if (!payload || payload.confirm !== true) {
    throw validation({ confirm: 'Confirm that you want to delete your account.' });
  }
  if (ctx.isAdmin) {
    throw conflict('admin_account', 'Administrator accounts cannot be deleted here. Ask another administrator to remove your access first.');
  }
  const userId = ctx.userId;
  const memberships = await ctx.store.listAll('organization_members', [Query.equal('userId', [userId]), Query.equal('active', [true])]);
  if (memberships.length > 0 || domain.isOrganizationMember(ctx.labels)) {
    throw conflict('organization_member', 'You are a member of an organization. Ask an organization admin to remove you before deleting your account.');
  }

  // Cancel requests the user opened that are still in flight.
  const openRequests = await ctx.store.listAll('blood_requests', [
    Query.equal('requesterId', [userId]),
    Query.equal('status', domain.ACTIVE_REQUEST_STATUSES),
  ]);
  for (const request of openRequests) {
    if (!domain.canCancelRequest(request.status)) continue;
    const updated = await transitionRequest(ctx, request, 'cancelled', 'Requester deleted their account', {
      cancelledReason: 'Requester deleted their account',
    });
    await closeResponses(ctx, updated, { notifyAccepted: true });
  }

  // Step back from anything the user had offered or scheduled as a donor.
  const responses = await ctx.store.listAll('request_responses', [
    Query.equal('donorId', [userId]),
    Query.equal('status', ['pending', 'accepted']),
  ]);
  for (const response of responses) {
    await ctx.store.update('request_responses', response.$id, { status: response.status === 'pending' ? 'expired' : 'withdrawn' });
    const donation = await ctx.store.first('donations', [Query.equal('responseId', [response.$id])]);
    if (donation && donation.status === 'scheduled') {
      await ctx.store.update('donations', donation.$id, { status: 'cancelled' });
    }
  }

  // Personal data: profile, donor profile, notifications, verification submissions and their documents.
  const profile = await ctx.store.get('profiles', userId);
  const verifications = await ctx.store.listAll('verifications', [Query.equal('userId', [userId])]);
  for (const verification of verifications) {
    for (const fileId of verification.documentFileIds || []) await removeFile(ctx, fileId);
  }
  if (profile && profile.avatarFileId) await removeFile(ctx, profile.avatarFileId);
  await removeRows(ctx, 'verifications', verifications);
  await removeRows(ctx, 'notifications', await ctx.store.listAll('notifications', [Query.equal('userId', [userId])], 2000));
  await removeRows(ctx, 'donor_profiles', await ctx.store.listAll('donor_profiles', [Query.equal('donorId', [userId])]));
  await removeRows(ctx, 'profiles', profile ? [profile] : []);

  await audit(ctx, 'account.deleted', 'user', userId, 'Account deleted by user');
  await ctx.users.delete({ userId });
  return { deleted: true };
}

module.exports = { deleteAccount };
