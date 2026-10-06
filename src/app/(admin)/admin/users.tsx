import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { DonorLinkAvatar } from '@/components/ui/DonorLinkAvatar';
import { DonorLinkBadge } from '@/components/ui/DonorLinkBadge';
import { DonorLinkCard } from '@/components/ui/DonorLinkCard';
import { DonorLinkInput } from '@/components/ui/DonorLinkInput';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { DonorLinkText } from '@/components/ui/DonorLinkText';
import { isAdmin, isOrganizationMember } from '@/domain';
import { useResource } from '@/hooks/useResource';
import { adminService } from '@/services/adminService';

export default function AdminUsersScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const { data, error, loading, refreshing, reload } = useResource(() => adminService.listUsers({ search: search || undefined, limit: 50 }), [search], { reloadOnFocus: true });

  return (
    <DonorLinkScreen inTabs refreshing={refreshing} onRefresh={() => void reload()} header={{ title: 'Users', subtitle: data ? `${data.total} accounts` : undefined, onBack: false, size: 'large' }}>
      <DonorLinkInput label="Search" value={query} onChangeText={setQuery} leftIcon="search" placeholder="Name or email" autoCapitalize="none" autoCorrect={false} />
      {loading ? (
        <DonorLinkListSkeleton />
      ) : error && !data ? (
        <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
      ) : (data?.users ?? []).length === 0 ? (
        <DonorLinkEmptyState icon="people-outline" title="No users found" description="Try a different search." />
      ) : (
        <View className="gap-2">
          {data!.users.map((u) => (
            <DonorLinkCard key={u.id} onPress={() => router.push(`/admin/user/${u.id}` as Href)} accessibilityLabel={`${u.name}, ${u.email}`} className="flex-row items-center gap-3">
              <DonorLinkAvatar name={u.name} size="md" />
              <View className="flex-1 gap-1">
                <DonorLinkText variant="bodyStrong" numberOfLines={1}>
                  {u.name || 'Unnamed'}
                </DonorLinkText>
                <DonorLinkText variant="caption" tone="muted" numberOfLines={1}>
                  {u.email}
                </DonorLinkText>
                <View className="flex-row flex-wrap gap-1">
                  {isAdmin(u.labels) ? <DonorLinkBadge label="Admin" tone="primary" size="sm" icon="shield" /> : null}
                  {isOrganizationMember(u.labels) ? <DonorLinkBadge label="Organization" tone="info" size="sm" icon="business" /> : null}
                  {!u.enabled ? <DonorLinkBadge label="Disabled" tone="error" size="sm" icon="ban" /> : null}
                  {!u.emailVerified ? <DonorLinkBadge label="Email not verified" tone="warning" size="sm" /> : null}
                </View>
              </View>
            </DonorLinkCard>
          ))}
        </View>
      )}
    </DonorLinkScreen>
  );
}
