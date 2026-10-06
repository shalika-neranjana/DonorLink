import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { NotificationCard } from '@/components/notifications/NotificationCard';
import { DonorLinkButton } from '@/components/ui/DonorLinkButton';
import { DonorLinkSegmentedControl } from '@/components/ui/DonorLinkPickers';
import { DonorLinkListSkeleton } from '@/components/ui/DonorLinkSkeleton';
import { DonorLinkEmptyState, DonorLinkErrorState } from '@/components/ui/DonorLinkStates';
import { DonorLinkScreen } from '@/components/ui/DonorLinkScreen';
import { useToast } from '@/components/ui/DonorLinkToast';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_CATEGORY_LABELS, type NotificationCategory } from '@/domain';
import { useResource } from '@/hooks/useResource';
import { getErrorMessage } from '@/lib/appwrite/errors';
import { useAuth } from '@/providers/AuthProvider';
import { useNotifications } from '@/providers/NotificationsProvider';
import { notificationService } from '@/services/notificationService';

type Filter = 'all' | NotificationCategory;

const EMPTY_COPY: Record<Filter, string> = {
  all: "You're all caught up.",
  emergency: 'No emergency alerts right now.',
  requests: 'No request updates yet.',
  donations: 'No donation updates yet.',
  account: 'No account notices.',
};

export default function NotificationsScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const { open, revision, refreshUnread, unreadCount } = useNotifications();
  const userId = user?.$id;
  const [filter, setFilter] = useState<Filter>('all');
  const [markingAll, setMarkingAll] = useState(false);

  // Load everything once and filter locally, so switching categories is instant
  // and the unread counts per category stay accurate.
  const { data, error, loading, refreshing, reload } = useResource(() => notificationService.list(userId!, 'all', 100), [userId], {
    enabled: !!userId,
    reloadOnFocus: true,
  });

  useEffect(() => {
    if (revision > 0) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);

  const counts = useMemo(() => {
    const unread: Record<string, number> = {};
    for (const n of data ?? []) if (!n.read) unread[n.category] = (unread[n.category] ?? 0) + 1;
    return unread;
  }, [data]);
  const visible = (data ?? []).filter((n) => filter === 'all' || n.category === filter);

  async function markAll() {
    setMarkingAll(true);
    try {
      await notificationService.markAllAsRead();
      await Promise.all([reload(), refreshUnread()]);
    } catch (e) {
      toast.error("We couldn't update your notifications", getErrorMessage(e));
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <DonorLinkScreen
      inTabs
      refreshing={refreshing}
      onRefresh={() => void reload()}
      header={{ title: 'Alerts', onBack: false, size: 'large' }}
    >
      <DonorLinkSegmentedControl<Filter>
        scrollable
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All', badge: unreadCount || undefined },
          ...NOTIFICATION_CATEGORIES.map((c) => ({ value: c as Filter, label: NOTIFICATION_CATEGORY_LABELS[c], badge: counts[c] || undefined })),
        ]}
      />
      {unreadCount > 0 ? (
        <View className="items-end">
          <DonorLinkButton title="Mark all as read" variant="ghost" size="sm" leftIcon="checkmark-done" loading={markingAll} onPress={() => void markAll()} />
        </View>
      ) : null}

      {loading ? (
        <DonorLinkListSkeleton />
      ) : error && !data ? (
        <DonorLinkErrorState message={error.message} onRetry={() => void reload()} />
      ) : visible.length === 0 ? (
        <DonorLinkEmptyState icon="notifications-off-outline" title={EMPTY_COPY[filter]} description="We'll tell you when something needs your attention." />
      ) : (
        <View className="gap-2">
          {visible.map((n) => (
            <NotificationCard key={n.$id} notification={n} onPress={() => void open(n)} />
          ))}
        </View>
      )}
    </DonorLinkScreen>
  );
}
