import { useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useToast } from '@/components/ui/DonorLinkToast';
import { TABLES } from '@/lib/appwrite/config';
import { subscribeToRows } from '@/lib/appwrite/realtime';
import { notificationService } from '@/services/notificationService';
import type { AppNotification } from '@/types/entities';
import { useAuth } from './AuthProvider';

interface NotificationsContextValue {
  unreadCount: number;
  refreshUnread: () => Promise<void>;
  /** Bumped on every live notification so lists can refetch. */
  revision: number;
  /** Marks read (best effort) and navigates to the notification's deep link. */
  open: (notification: AppNotification) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

/**
 * One realtime subscription for the signed-in user's notifications: keeps the
 * unread badge live and shows an in-app alert when something new arrives.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const [revision, setRevision] = useState(0);
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  });

  const userId = user?.$id;

  const refreshUnread = useCallback((): Promise<void> => {
    if (!userId) return Promise.resolve();
    return notificationService
      .unreadCount(userId)
      .then((count) => setUnreadCount(count))
      .catch(() => undefined); // The badge is non-critical.
  }, [userId]);

  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread]);

  useEffect(() => {
    if (!userId) return;
    return subscribeToRows<AppNotification>(TABLES.notifications, undefined, ({ type, row }) => {
      if (row.userId !== userId) return;
      setRevision((n) => n + 1);
      void refreshUnread();
      if (type === 'create') {
        if (row.category === 'emergency') toastRef.current.warning(row.title, row.body);
        else toastRef.current.info(row.title, row.body);
      }
    });
  }, [userId, refreshUnread]);

  const open = useCallback(
    async (notification: AppNotification) => {
      if (!notification.read) {
        void notificationService
          .markAsRead(notification.$id)
          .then(() => {
            setUnreadCount((n) => Math.max(0, n - 1));
            setRevision((n) => n + 1);
          })
          .catch(() => undefined);
      }
      router.push(notification.route as never);
    },
    [router],
  );

  const value = useMemo(() => ({ unreadCount, refreshUnread, revision, open }), [unreadCount, refreshUnread, revision, open]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>.');
  return ctx;
}
