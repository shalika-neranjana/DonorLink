import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { useResource } from '@/hooks/useResource';
import type { AppError } from '@/lib/appwrite/errors';
import { useAuth } from '@/providers/AuthProvider';
import { organizationService } from '@/services/organizationService';
import type { Organization, OrganizationMember } from '@/types/entities';

const NO_ORGS: Organization[] = [];

interface OrganizationContextValue {
  organizations: Organization[];
  organization: Organization | null;
  membership: OrganizationMember | null;
  isOrgAdmin: boolean;
  loading: boolean;
  error: AppError | null;
  select: (organizationId: string) => void;
  reload: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

/**
 * The organizations the signed-in user belongs to (derived from server-set
 * labels, so it cannot be spoofed) and which one is currently active.
 */
export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, labels, isAdmin } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const orgs = useResource(
    async () => {
      const organizations = await organizationService.listMine(labels);
      return organizations;
    },
    [labels.join(',')],
    { enabled: !!user },
  );
  const organizations = orgs.data ?? NO_ORGS;
  const organization = organizations.find((o) => o.$id === selectedId) ?? organizations[0] ?? null;

  const membershipResource = useResource(
    () => (organization && user ? organizationService.getMembership(organization.$id, user.$id) : Promise.resolve(null)),
    [organization?.$id, user?.$id],
    { enabled: !!organization && !!user },
  );
  const membership = membershipResource.data ?? null;

  const reload = useCallback(async () => {
    await Promise.all([orgs.reload(), membershipResource.reload()]);
  }, [orgs, membershipResource]);

  const value = useMemo<OrganizationContextValue>(
    () => ({
      organizations,
      organization,
      membership,
      isOrgAdmin: isAdmin || membership?.role === 'admin',
      loading: orgs.loading || (!!organization && membershipResource.loading),
      error: orgs.error,
      select: setSelectedId,
      reload,
    }),
    [organizations, organization, membership, isAdmin, orgs.loading, orgs.error, membershipResource.loading, reload],
  );
  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization(): OrganizationContextValue {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error('useOrganization must be used inside the organization layout.');
  return ctx;
}
