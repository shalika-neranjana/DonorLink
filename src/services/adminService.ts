import type { OrganizationType, SupportStatus, VerificationStatus } from '@/domain';
import { callApi } from '@/lib/appwrite/api';
import { TABLES } from '@/lib/appwrite/config';
import { listRows, Query } from '@/lib/appwrite/database';
import type {
  AdminUser,
  AnalyticsSummary,
  AuditLog,
  BloodRequest,
  InventoryItem,
  Organization,
  SupportTicket,
  SystemSettings,
  Verification,
} from '@/types/entities';

export interface AdminUserDetail {
  user: AdminUser;
  profile: {
    displayName: string;
    bloodGroup: string | null;
    district: string | null;
    isDonor: boolean;
    verificationStatus: VerificationStatus;
    onboardingComplete: boolean;
  } | null;
  donor: { availability: string; donationCount: number; verificationStatus: VerificationStatus } | null;
  counts: { requests: number; donations: number };
  verifications: Verification[];
}

export const adminService = {
  listUsers(options: { search?: string; cursor?: string; limit?: number } = {}) {
    return callApi<{ users: AdminUser[]; total: number }>('admin.listUsers', options);
  },
  getUser(userId: string) {
    return callApi<AdminUserDetail>('admin.getUser', { userId });
  },
  setAdminRole(userId: string, admin: boolean) {
    return callApi<{ userId: string; admin: boolean }>('admin.setAdminRole', { userId, admin });
  },
  setUserStatus(userId: string, enabled: boolean) {
    return callApi<{ userId: string; enabled: boolean }>('admin.setUserStatus', { userId, enabled });
  },
  analytics() {
    return callApi<AnalyticsSummary>('admin.analytics');
  },
  upsertOrganization(input: {
    organizationId?: string;
    name: string;
    type: OrganizationType;
    district: string;
    city?: string;
    address?: string;
    phone?: string;
    verificationStatus?: VerificationStatus;
  }) {
    return callApi<{ organization: Organization }>('admin.upsertOrganization', input);
  },
  updateSettings(input: Partial<Omit<SystemSettings, keyof import('@/types/entities').RowBase>>) {
    return callApi<{ settings: SystemSettings }>('admin.updateSettings', input);
  },
  replyToTicket(ticketId: string, reply: string, status: SupportStatus = 'resolved') {
    return callApi<{ ticket: SupportTicket }>('support.reply', { ticketId, reply, status });
  },
  runMaintenance() {
    return callApi<{ expired: number; checked: number }>('maintenance.run');
  },

  async listRequests(status?: string): Promise<BloodRequest[]> {
    const queries = [Query.orderDesc('$createdAt'), Query.limit(50)];
    if (status && status !== 'all') queries.push(Query.equal('status', [status]));
    return (await listRows<BloodRequest>(TABLES.bloodRequests, queries)).rows;
  },
  async listOrganizations(): Promise<Organization[]> {
    return (await listRows<Organization>(TABLES.organizations, [Query.orderAsc('name'), Query.limit(100)])).rows;
  },
  async listInventory(): Promise<InventoryItem[]> {
    return (await listRows<InventoryItem>(TABLES.bloodInventory, [Query.orderDesc('$updatedAt'), Query.limit(100)])).rows;
  },
  async listAuditLogs(options: { action?: string; limit?: number } = {}): Promise<AuditLog[]> {
    const queries = [Query.orderDesc('$createdAt'), Query.limit(options.limit ?? 50)];
    if (options.action) queries.push(Query.equal('action', [options.action]));
    return (await listRows<AuditLog>(TABLES.auditLogs, queries)).rows;
  },
  async listTickets(status: SupportStatus | 'all' = 'open'): Promise<SupportTicket[]> {
    const queries = [Query.orderDesc('$createdAt'), Query.limit(50)];
    if (status !== 'all') queries.push(Query.equal('status', [status]));
    return (await listRows<SupportTicket>(TABLES.supportTickets, queries)).rows;
  },
  async getSettings(): Promise<SystemSettings | null> {
    const result = await listRows<SystemSettings>(TABLES.systemSettings, [Query.limit(1)]);
    return result.rows[0] ?? null;
  },
};
