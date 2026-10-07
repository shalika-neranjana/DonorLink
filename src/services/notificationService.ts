import type { NotificationCategory } from '@/domain';
import { callApi } from '@/lib/appwrite/api';
import { TABLES } from '@/lib/appwrite/config';
import { listRows, Query } from '@/lib/appwrite/database';
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

  async markAsRead(notificationId: string): Promise<AppNotification> {
    const { notification } = await callApi<{ notification: AppNotification }>('notifications.markRead', { notificationId });
    return notification;
  },

  markAllAsRead() {
    return callApi<{ updated: number }>('notifications.markAllRead');
  },
};
