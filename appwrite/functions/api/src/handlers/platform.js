const { ID, Query } = require('node-appwrite');
const domain = require('../lib/domain');
const { validation, notFound } = require('../lib/errors');
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

module.exports = { createTicket, replyTicket, markAllRead, runMaintenance };
