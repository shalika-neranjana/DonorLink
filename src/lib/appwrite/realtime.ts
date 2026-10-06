import { Channel, type RealtimeSubscription } from 'react-native-appwrite';

import { realtime } from './client';
import { appwriteConfig, type TableId } from './config';

export type RowEventType = 'create' | 'update' | 'delete';

export interface RowEvent<T> {
  type: RowEventType;
  row: T;
}

function eventType(events: string[]): RowEventType {
  const joined = events.join(' ');
  if (/\.delete\b/.test(joined)) return 'delete';
  if (/\.create\b/.test(joined)) return 'create';
  return 'update';
}

/**
 * Subscribes to row events for a table (or one row). Returns a synchronous
 * unsubscribe function that is safe to call from effect cleanup, even if the
 * subscription has not finished connecting yet - so screens never leak
 * listeners or end up with duplicates.
 *
 * Appwrite only delivers events for rows the signed-in user may read.
 */
export function subscribeToRows<T>(
  tableId: TableId,
  rowId: string | undefined,
  onEvent: (event: RowEvent<T>) => void,
): () => void {
  let cancelled = false;
  let subscription: RealtimeSubscription | null = null;

  const channel = Channel.tablesdb(appwriteConfig.databaseId).table(tableId).row(rowId);

  realtime
    .subscribe(channel, (event) => {
      if (cancelled) return;
      onEvent({ type: eventType(event.events), row: event.payload as T });
    })
    .then((sub) => {
      if (cancelled) void sub.unsubscribe().catch(() => undefined);
      else subscription = sub;
    })
    .catch(() => {
      // Realtime is an enhancement; screens also refresh on focus and pull-to-refresh.
    });

  return () => {
    cancelled = true;
    if (subscription) void subscription.unsubscribe().catch(() => undefined);
    subscription = null;
  };
}
