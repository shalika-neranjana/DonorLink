import type { NotificationCategory } from '@/domain';
import { callApi } from '@/lib/appwrite/api';
import { TABLES } from '@/lib/appwrite/config';
import { deleteOwnRow, listRows, Query, updateOwnRow } from '@/lib/appwrite/database';
import type { AppNotification } from '@/types/entities';

export const notificationService = {
  async list(userId: string, category?: NotificationCategory | 'all', limit = 50): Promise<AppNotification[]> {
    const queries = [Query.equal('userId', [userId]), Query.orderDesc('$createdAt'), Query.limit(limit)];
    if (category && category !== 'all') queries.push(Query.equal('category', [category]));
    return (await listRows<AppNotification>(TABLES.notifications, queries)).rows;
  },

  async unreadCount(userId: string): Promise<number> {
    const result = await listRows<AppNotification>(TABLES.notifications, [
      Query.equal('userId', [userId]),
      Query.equal('read', [false]),
      Query.limit(1),
    ]);
    return result.total;
  },

  markAsRead(notificationId: string): Promise<AppNotification> {
    return updateOwnRow<AppNotification>(TABLES.notifications, notificationId, {
      read: true,
      readAt: new Date().toISOString(),
    });
  },

  markAllAsRead() {
    return callApi<{ updated: number }>('notifications.markAllRead');
  },

  remove(notificationId: string): Promise<void> {
    return deleteOwnRow(TABLES.notifications, notificationId);
  },
};
