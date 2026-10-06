import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';

import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import type { HeaderAction } from '@/components/ui/DonorLinkHeader';
import type { Organization } from '@/types/entities';
import { useOrganization } from './OrganizationContext';

export interface OrgScreenProps {
  title: string;
  subtitle?: string;
  actions?: HeaderAction[];
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  children: (organization: Organization) => ReactNode;
}

/** Handles loading / error / "no organization" once for every workspace screen. */
export function OrgScreen({ title, subtitle, actions, refreshing, onRefresh, footer, children }: OrgScreenProps) {
  const router = useRouter();
  const { organization, loading, error, reload } = useOrganization();
  const header = { title, subtitle: subtitle ?? organization?.name, onBack: false as const, size: 'large' as const, actions };

  if (loading && !organization) {
    return (
      <DonorLinkScreen inTabs header={header}>
        <DonorLinkListSkeleton />
      </DonorLinkScreen>
    );
  }
  if (error && !organization) {
    return (
      <DonorLinkScreen inTabs header={header}>
        <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
      </DonorLinkScreen>
    );
  }
  if (!organization) {
    return (
      <DonorLinkScreen inTabs header={header}>
        <DonorLinkEmptyState icon="business-outline" title="No organization found" description="Your account is marked as an organization member, but we couldn't load the organization." actionLabel="Back to DonorLink" onAction={() => router.replace('/')} />
      </DonorLinkScreen>
    );
  }
  return (
    <DonorLinkScreen inTabs header={header} refreshing={refreshing} onRefresh={onRefresh} footer={footer}>
      {children(organization)}
    </DonorLinkScreen>
  );
}
