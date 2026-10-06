import type { AppRole } from './statuses';

/**
 * Roles are carried by Appwrite *user labels*. Labels can only be written with
 * a server API key (i.e. by the Function or the console), never by the client,
 * so they are safe to use for authorization and for row permissions.
 *
 *   admin         platform administrator
 *   organization  member of at least one organization
 *   orgm<orgId>   member of a specific organization (alphanumeric only,
 *                 because Appwrite labels must be alphanumeric, <= 36 chars)
 */
export const LABEL_ADMIN = 'admin';
export const LABEL_ORGANIZATION = 'organization';
export const ORG_LABEL_PREFIX = 'orgm';

export function organizationLabel(organizationId: string): string {
  return `${ORG_LABEL_PREFIX}${organizationId}`;
}

export function organizationIdsFromLabels(labels: readonly string[] | undefined): string[] {
  return (labels ?? [])
    .filter((label) => label.startsWith(ORG_LABEL_PREFIX) && label.length > ORG_LABEL_PREFIX.length)
    .map((label) => label.slice(ORG_LABEL_PREFIX.length));
}

export function isAdmin(labels: readonly string[] | undefined): boolean {
  return !!labels?.includes(LABEL_ADMIN);
}

export function isOrganizationMember(labels: readonly string[] | undefined, organizationId?: string): boolean {
  if (!labels) return false;
  if (organizationId) return labels.includes(organizationLabel(organizationId));
  return labels.includes(LABEL_ORGANIZATION) || organizationIdsFromLabels(labels).length > 0;
}

/** Every user is a "user"; admin / organization add capabilities. */
export function rolesFromLabels(labels: readonly string[] | undefined): AppRole[] {
  const roles: AppRole[] = ['user'];
  if (isOrganizationMember(labels)) roles.push('organization');
  if (isAdmin(labels)) roles.push('admin');
  return roles;
}

/** Labels after granting/revoking organization membership. */
export function withOrganizationMembership(
  labels: readonly string[],
  organizationId: string,
  member: boolean,
): string[] {
  const next = new Set(labels);
  const label = organizationLabel(organizationId);
  if (member) next.add(label);
  else next.delete(label);
  const stillMember = [...next].some((l) => l.startsWith(ORG_LABEL_PREFIX));
  if (stillMember) next.add(LABEL_ORGANIZATION);
  else next.delete(LABEL_ORGANIZATION);
  return [...next];
}

export function withAdmin(labels: readonly string[], admin: boolean): string[] {
  const next = new Set(labels);
  if (admin) next.add(LABEL_ADMIN);
  else next.delete(LABEL_ADMIN);
  return [...next];
}

export interface RequestAccessContext {
  userId: string;
  labels: readonly string[] | undefined;
  requesterId: string;
  /** Organization that owns the hospital the request is addressed to, if any. */
  hospitalOrganizationId?: string | null;
}

/** Who may verify / reject a request: admins, or members of the addressed hospital. */
export function canVerifyRequest(ctx: RequestAccessContext): boolean {
  if (isAdmin(ctx.labels)) return true;
  if (ctx.hospitalOrganizationId && isOrganizationMember(ctx.labels, ctx.hospitalOrganizationId)) {
    // Never allow verifying your own request.
    return ctx.userId !== ctx.requesterId;
  }
  return false;
}

/** Who may confirm a donation happened: the requester, hospital staff, or an admin. */
export function canConfirmDonation(ctx: RequestAccessContext): boolean {
  if (ctx.userId === ctx.requesterId) return true;
  if (isAdmin(ctx.labels)) return true;
  return !!ctx.hospitalOrganizationId && isOrganizationMember(ctx.labels, ctx.hospitalOrganizationId);
}

export function canCancelRequestAs(ctx: RequestAccessContext): boolean {
  return ctx.userId === ctx.requesterId || isAdmin(ctx.labels);
}
