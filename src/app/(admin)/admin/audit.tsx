import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { DonorLinkBadge } from '@/components/ui/DonorLinkBadge';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkChip } from '@/components/ui/DonorLinkPickers';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { useResource } from '@/hooks/useResource';
import { formatDateTime } from '@/lib/format';
import { adminService } from '@/services/adminService';

const GROUPS = ['request', 'response', 'donation', 'verification', 'inventory', 'organization', 'user', 'admin', 'settings', 'support'];

/** Append-only record of important actions. Read-only for administrators. */
export default function AdminAuditScreen() {
  const [group, setGroup] = useState<string | null>(null);
  const { data, error, loading, refreshing, reload } = useResource(() => adminService.listAuditLogs({ limit: 100 }), [], { reloadOnFocus: true });
  const rows = useMemo(() => (data ?? []).filter((l) => !group || l.action.startsWith(`${group}.`)), [data, group]);

  return (
    <DonorLinkScreen refreshing={refreshing} onRefresh={() => void reload()} header={{ title: 'Audit log' }}>
      <View className="flex-row flex-wrap gap-2">
        {GROUPS.map((g) => (
          <DonorLinkChip key={g} label={g} selected={group === g} onPress={() => setGroup(group === g ? null : g)} />
        ))}
      </View>
      {loading ? (
        <DonorLinkListSkeleton />
      ) : error && !data ? (
        <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
      ) : rows.length === 0 ? (
        <DonorLinkEmptyState icon="receipt-outline" title="No matching entries" />
      ) : (
        <View className="gap-2">
          {rows.map((l) => (
            <DonorLinkCard key={l.$id} className="gap-1">
              <View className="flex-row items-center justify-between gap-2">
                <DonorLinkBadge label={l.action} tone="neutral" size="sm" />
                <DonorLinkText variant="caption" tone="muted">
                  {formatDateTime(l.$createdAt)}
                </DonorLinkText>
              </View>
              <DonorLinkText variant="bodySmall">{l.summary}</DonorLinkText>
              <DonorLinkText variant="caption" tone="muted">
                {l.actorRole ?? 'user'} · {l.actorId.slice(0, 8)} · {l.entityType} {l.entityId.slice(0, 8)}
              </DonorLinkText>
            </DonorLinkCard>
          ))}
        </View>
      )}
    </DonorLinkScreen>
  );
}
