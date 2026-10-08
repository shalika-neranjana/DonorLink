const { ApiError, unauthorized, forbidden, notFound } = require('./lib/errors');
const { createContext, getSettings } = require('./lib/context');
const { actions } = require('./handlers');

/**
 * Transport-independent request handler (used by main.js and by the tests).
 *
 * @param {{
 *   store: import('./lib/store').Store, users: any, storage: any,
 *   headers: Record<string,string>, body: any,
 *   now?: () => Date, log?: (m: string) => void
 * }} input
 * @returns {Promise<{ status: number, body: object }>}
 */
async function handle({ store, users, storage, headers, body, now, log = () => {} }) {
  try {
    const trigger = headers['x-appwrite-trigger'] || 'http';
    const userId = headers['x-appwrite-user-id'] || '';

    let action = body && body.action;
    if (trigger === 'schedule' && !action) action = 'maintenance.run';
    if (typeof action !== 'string' || !actions[action]) {
      throw new ApiError('unknown_action', 'That action is not supported.', 400);
    }

    let user = null;
    if (userId) {
      try {
        user = await users.get({ userId });
      } catch {
        throw unauthorized('Your session is no longer valid. Please sign in again.');
      }
      if (user.status === false) throw forbidden('This account has been disabled. Contact support.');
    } else if (trigger !== 'schedule' || action !== 'maintenance.run') {
      // A run without a user is only legitimate as the scheduled maintenance job.
      throw unauthorized();
    }

    const ctx = createContext({ store, users, storage, userId, user, now, log, trigger });

    if (!ctx.isAdmin && trigger !== 'schedule') {
      const settings = await getSettings(ctx);
      if (settings.maintenanceMode) {
        throw new ApiError('maintenance', 'DonorLink is undergoing maintenance. Please try again shortly.', 503);
      }
    }

    const data = await actions[action](ctx, (body && body.payload) || {});
    return { status: 200, body: { ok: true, data } };
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        status: error.status,
        body: { ok: false, error: { code: error.code, message: error.message, fields: error.fields } },
      };
    }
    // Domain invariants (e.g. invalid transition) are user-facing conflicts.
    if (error && error.name === 'InvalidTransitionError') {
      return {
        status: 409,
        body: { ok: false, error: { code: 'invalid_state', message: error.message } },
      };
    }
    // Appwrite SDK errors carry numeric codes; surface 404/409 sensibly, hide the rest.
    if (error && error.code === 404) {
      const e = notFound();
      return { status: 404, body: { ok: false, error: { code: e.code, message: e.message } } };
    }
    log(`Unhandled error: ${error && (error.stack || error.message || error)}`);
    return {
      status: 500,
      body: { ok: false, error: { code: 'internal', message: 'Something went wrong on our side. Please try again.' } },
    };
  }
}

module.exports = { handle };
