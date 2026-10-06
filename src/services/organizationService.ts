import { ACTIVE_REQUEST_STATUSES, organizationIdsFromLabels, type InventoryInput } from '@/domain';
import { callApi } from '@/lib/appwrite/api';
import { TABLES } from '@/lib/appwrite/config';
import { findRow, listRows, Query } from '@/lib/appwrite/database';
import type {
  BloodRequest,
  Donation,
  InventoryItem,
  Organization,
  OrganizationMember,
  RequestResponse,
} from '@/types/entities';

export const organizationService = {
  getOrganization(organizationId: string): Promise<Organization | null> {
    return findRow<Organization>(TABLES.organizations, organizationId);
  },

  /** Organizations the signed-in user belongs to (derived from server-set labels). */
  async listMine(labels: readonly string[]): Promise<Organization[]> {
    const ids = organizationIdsFromLabels(labels);
    const orgs = await Promise.all(ids.map((id) => organizationService.getOrganization(id)));
    return orgs.filter((org): org is Organization => org !== null);
  },

  async getMembership(organizationId: string, userId: string): Promise<OrganizationMember | null> {
    const result = await listRows<OrganizationMember>(TABLES.organizationMembers, [
      Query.equal('organizationId', [organizationId]),
      Query.equal('userId', [userId]),
      Query.equal('active', [true]),
      Query.limit(1),
    ]);
    return result.rows[0] ?? null;
  },

  async listMembers(organizationId: string): Promise<OrganizationMember[]> {
    const result = await listRows<OrganizationMember>(TABLES.organizationMembers, [
      Query.equal('organizationId', [organizationId]),
      Query.equal('active', [true]),
      Query.orderAsc('displayName'),
      Query.limit(100),
    ]);
    return result.rows;
  },

  addMember(organizationId: string, email: string, role: string) {
    return callApi<{ member: OrganizationMember }>('org.addMember', { organizationId, email, role });
  },

  removeMember(organizationId: string, userId: string) {
    return callApi<{ removed: boolean }>('org.removeMember', { organizationId, userId });
  },

  updateProfile(organizationId: string, input: { phone?: string; address?: string; city?: string }) {
    return callApi<{ organization: Organization }>('org.updateProfile', { organizationId, ...input });
  },

  /** Requests addressed to the organization's hospital. */
  async listRequests(organizationId: string, scope: 'active' | 'all' = 'active'): Promise<BloodRequest[]> {
    const queries = [Query.equal('hospitalId', [organizationId]), Query.orderDesc('$createdAt'), Query.limit(50)];
    if (scope === 'active') queries.push(Query.equal('status', [...ACTIVE_REQUEST_STATUSES]));
    return (await listRows<BloodRequest>(TABLES.bloodRequests, queries)).rows;
  },

  async listResponsesForOrganization(organizationId: string): Promise<RequestResponse[]> {
    const result = await listRows<RequestResponse>(TABLES.requestResponses, [
      Query.equal('hospitalId', [organizationId]),
      Query.orderDesc('$updatedAt'),
      Query.limit(100),
    ]);
    return result.rows;
  },

  async listDonations(organizationId: string): Promise<Donation[]> {
    const result = await listRows<Donation>(TABLES.donations, [
      Query.equal('hospitalId', [organizationId]),
      Query.orderDesc('$createdAt'),
      Query.limit(100),
    ]);
    return result.rows;
  },

  async listInventory(organizationId: string): Promise<InventoryItem[]> {
    const result = await listRows<InventoryItem>(TABLES.bloodInventory, [
      Query.equal('organizationId', [organizationId]),
      Query.limit(100),
    ]);
    return result.rows;
  },

  updateInventory(organizationId: string, item: InventoryInput) {
    return callApi<{ item: InventoryItem }>('org.updateInventory', { organizationId, item });
  },
};
