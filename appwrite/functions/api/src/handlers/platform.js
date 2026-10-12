const { ID, Query } = require('node-appwrite');
const domain = require('../lib/domain');
const { validation, notFound, conflict } = require('../lib/errors');
const { audit, notify, ownerReadPerms, requireAdmin, requireFields, iso } = require('../lib/context');
const { expireRequest } = require('./request');

// --- support ----------------------------------------------------------------

async function createTicket(ctx, payload) {
  const result = domain.validateSupportTicket(payload || {});
  if (!result.ok) throw validation(result.errors);
  const ticket = await ctx.store.create(
    'support_tickets',
    ID.unique(),
    { userId: ctx.userId, ...result.value, status: 'open' },
    ownerReadPerms(ctx.userId),
  );
  await audit(ctx, 'support.created', 'support_ticket', ticket.$id, 'Support request created');
  return { ticket };
}

/** Tickets are only visible to their owner and admins; anyone else gets a plain "not found". */
async function ownedTicket(ctx, ticketId, { allowAdmin = false } = {}) {
  const ticket = await ctx.store.get('support_tickets', ticketId);
  if (!ticket || (ticket.userId !== ctx.userId && !(allowAdmin && ctx.isAdmin))) throw notFound('Ticket not found.');
  return ticket;
}

/** Owners can fix a typo or add detail until support has picked the ticket up. */
async function updateTicket(ctx, payload) {
  requireFields(payload, ['ticketId']);
  const ticket = await ownedTicket(ctx, payload.ticketId);
  if (!domain.canEditTicket(ticket)) {
    throw conflict('ticket_locked', 'Support has already picked this up, so it can no longer be edited.');
  }
  const result = domain.validateSupportTicket(payload);
  if (!result.ok) throw validation(result.errors);
  const updated = await ctx.store.update('support_tickets', ticket.$id, result.value);
  await audit(ctx, 'support.updated', 'support_ticket', ticket.$id, 'Support request edited');
  return { ticket: updated };
}

/** Owners can withdraw their own ticket; admins can remove any (spam, duplicates). */
async function deleteTicket(ctx, payload) {
  requireFields(payload, ['ticketId']);
  const ticket = await ownedTicket(ctx, payload.ticketId, { allowAdmin: true });
  await ctx.store.remove('support_tickets', ticket.$id);
  await audit(ctx, 'support.deleted', 'support_ticket', ticket.$id, ctx.userId === ticket.userId ? 'Support request deleted by owner' : 'Support request deleted by admin');
  return { deleted: true, ticketId: ticket.$id };
}

async function replyTicket(ctx, payload) {
  requireAdmin(ctx);
  requireFields(payload, ['ticketId']);
  const ticket = await ctx.store.get('support_tickets', payload.ticketId);
  if (!ticket) throw notFound('Ticket not found.');
  const reply = typeof payload.reply === 'string' ? payload.reply.trim() : '';
  if (!reply) throw validation({ reply: 'Reply is required.' });
  if (reply.length > 1000) throw validation({ reply: 'Reply must be 1000 characters or fewer.' });
  const status = payload.status || 'resolved';
  if (!domain.SUPPORT_STATUSES.includes(status)) throw validation({ status: 'Choose a valid status.' });
  const updated = await ctx.store.update('support_tickets', ticket.$id, { reply, status, repliedBy: ctx.userId });
  await notify(ctx, ticket.userId, 'support_reply', { ticketId: ticket.$id });
  await audit(ctx, 'support.replied', 'support_ticket', ticket.$id, `Support ticket ${status}`);
  return { ticket: updated };
}

// --- notifications ------------------------------------------------------------

/** Owners can only flip `read` on their own rows; nothing else is client-writable. */
async function markRead(ctx, payload) {
  requireFields(payload, ['notificationId']);
  const row = await ctx.store.get('notifications', payload.notificationId);
  if (!row || row.userId !== ctx.userId) throw notFound('Notification not found.');
  if (row.read) return { notification: row };
  const notification = await ctx.store.update('notifications', row.$id, { read: true, readAt: iso(ctx.now()) });
  return { notification };
}

async function markAllRead(ctx) {
  const unread = await ctx.store.listAll(
    'notifications',
    [Query.equal('userId', [ctx.userId]), Query.equal('read', [false])],
    300,
  );
  const readAt = iso(ctx.now());
  for (const row of unread) await ctx.store.update('notifications', row.$id, { read: true, readAt });
  return { updated: unread.length };
}

// --- maintenance ----------------------------------------------------------------

async function runMaintenance(ctx) {
  const nowIso = iso(ctx.now());
  const stale = await ctx.store.list(
    'blood_requests',
    [
      Query.equal('status', ['submitted', 'pending_verification', 'verified', 'matching', 'donors_contacted', 'partially_fulfilled']),
      Query.lessThan('expiresAt', nowIso),
      Query.orderAsc('expiresAt'),
    ],
    100,
  );
  let expired = 0;
  for (const request of stale) {
    if (await expireRequest(ctx, request)) expired += 1;
  }
  return { expired, checked: stale.length };
}

module.exports = { createTicket, updateTicket, deleteTicket, replyTicket, markRead, markAllRead, runMaintenance };
