const profile = require('./profile');
const request = require('./request');
const response = require('./response');
const donation = require('./donation');
const verification = require('./verification');
const organization = require('./organization');
const admin = require('./admin');
const platform = require('./platform');

/**
 * Action registry. Every action receives (ctx, payload) where ctx.userId is
 * the authenticated caller. Role checks happen inside the handlers using the
 * labels read from Appwrite (never from the payload).
 */
const actions = {
  'profile.save': profile.saveProfile,
  'donor.updateAvailability': profile.updateAvailability,

  'request.create': request.createRequest,
  'request.verify': request.verifyRequest,
  'request.matches': request.requestMatches,
  'request.contactDonor': request.contactDonorAction,
  'request.cancel': request.cancelRequest,
  'request.complete': request.completeRequest,

  'response.accept': response.acceptResponse,
  'response.decline': response.declineResponse,
  'response.withdraw': response.withdrawResponse,

  'donation.confirm': donation.confirmDonation,
  'donation.schedule': donation.scheduleDonation,
  'donation.cancel': donation.cancelDonation,

  'verification.submit': verification.submitVerification,
  'verification.review': verification.reviewVerification,

  'org.updateInventory': organization.updateInventory,
  'org.updateProfile': organization.updateOrganizationProfile,
  'org.addMember': organization.addMember,
  'org.removeMember': organization.removeMember,

  'admin.listUsers': admin.listUsers,
  'admin.getUser': admin.getUser,
  'admin.setAdminRole': admin.setAdminRole,
  'admin.setUserStatus': admin.setUserStatus,
  'admin.analytics': admin.analytics,
  'admin.upsertOrganization': admin.upsertOrganization,
  'admin.updateSettings': admin.updateSettings,

  'support.create': platform.createTicket,
  'support.reply': platform.replyTicket,

  'notifications.markRead': platform.markRead,
  'notifications.markAllRead': platform.markAllRead,
  'maintenance.run': (ctx) => {
    if (!ctx.isAdmin && ctx.trigger !== 'schedule') {
      const { forbidden } = require('../lib/errors');
      throw forbidden('Administrator access required.');
    }
    return platform.runMaintenance(ctx);
  },
};

module.exports = { actions };
