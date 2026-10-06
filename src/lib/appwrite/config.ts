/**
 * Central Appwrite configuration. Every ID the app uses lives here.
 *
 * NOTE: Expo only inlines `process.env.EXPO_PUBLIC_*` when the full literal
 * name is written out, so each variable is referenced explicitly.
 * Only public identifiers belong here - never an API key.
 */
export const appwriteConfig = {
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '',
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '',
  platform: process.env.EXPO_PUBLIC_APPWRITE_PLATFORM ?? 'com.donorlink.app',
  databaseId: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID ?? 'donorlink',
  functionId: process.env.EXPO_PUBLIC_APPWRITE_FUNCTION_ID ?? 'donorlink-api',
} as const;

/** Table IDs equal the table names created by `npm run appwrite:provision`. */
export const TABLES = {
  profiles: 'profiles',
  donorProfiles: 'donor_profiles',
  bloodRequests: 'blood_requests',
  requestResponses: 'request_responses',
  donations: 'donations',
  organizations: 'organizations',
  organizationMembers: 'organization_members',
  bloodInventory: 'blood_inventory',
  notifications: 'notifications',
  verifications: 'verifications',
  auditLogs: 'audit_logs',
  supportTickets: 'support_tickets',
  systemSettings: 'system_settings',
} as const;
export type TableId = (typeof TABLES)[keyof typeof TABLES];

export const BUCKETS = {
  avatars: 'avatars',
  verificationDocs: 'verification_docs',
} as const;

export function isAppwriteConfigured(): boolean {
  return Boolean(appwriteConfig.endpoint && appwriteConfig.projectId);
}
