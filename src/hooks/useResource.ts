import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

import { AppError, toAppError } from '@/lib/appwrite/errors';
import { subscribeToRows, type RowEvent } from '@/lib/appwrite/realtime';
import type { TableId } from '@/lib/appwrite/config';

export interface ResourceState<T> {
  data: T | undefined;
  error: AppError | null;
  /** True only for the first load (nothing to show yet). */
  loading: boolean;
  /** True while a background/pull-to-refresh reload is running. */
  refreshing: boolean;
  reload: () => Promise<void>;
  /** Replace data locally (optimistic updates / realtime merges). */
  setData: (updater: (current: T | undefined) => T | undefined) => void;
}

type SessionExpiredHandler = () => void;
let sessionExpiredHandler: SessionExpiredHandler | null = null;

/** Registered by AuthProvider so any failed request can end an expired session. */
export function setSessionExpiredHandler(handler: SessionExpiredHandler | null) {
  sessionExpiredHandler = handler;
}

export interface UseResourceOptions {
  /** Skip fetching (e.g. until an id is known). */
  enabled?: boolean;
  /** Reload silently whenever the screen regains focus. */
  reloadOnFocus?: boolean;
}

interface Snapshot<T> {
  /** Which dependency set produced this snapshot. */
  key: string;
  data: T | undefined;
  error: AppError | null;
  settled: boolean;
}

/**
 * Minimal server-state hook (deliberately not a library): loads when its
 * dependencies change, keeps the previous data visible during refreshes and
 * after a failed refresh (stale data plus an error), ignores out-of-order
 * responses, and ends the session if Appwrite reports it as expired.
 *
 * State is keyed by the dependency set, so changing an id never shows the
 * previous id's data and no state is set synchronously inside an effect.
 */
export function useResource<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList,
  { enabled = true, reloadOnFocus = false }: UseResourceOptions = {},
): ResourceState<T> {
  const key = `${enabled ? 1 : 0}|${deps.map((d) => String(d)).join('|')}`;
  const [snapshot, setSnapshot] = useState<Snapshot<T>>({ key: '', data: undefined, error: null, settled: false });
  const [refreshing, setRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  const keyRef = useRef(key);
  const requestId = useRef(0);

  useEffect(() => {
    fetcherRef.current = fetcher;
    keyRef.current = key;
  });

  /** Fetches and stores the result; never sets state before the first await. */
  const fetchInto = useCallback(async (forKey: string) => {
    const id = ++requestId.current;
    try {
      const result = await fetcherRef.current();
      if (id !== requestId.current) return;
      setSnapshot({ key: forKey, data: result, error: null, settled: true });
    } catch (e) {
      if (id !== requestId.current) return;
      const appError = toAppError(e);
      setSnapshot((prev) => ({ key: forKey, data: prev.key === forKey ? prev.data : undefined, error: appError, settled: true }));
      if (appError.sessionExpired) sessionExpiredHandler?.();
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void fetchInto(key);
    const counter = requestId;
    return () => {
      counter.current++;
    };
  }, [enabled, key, fetchInto]);

  const firstFocus = useRef(true);
  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchInto(keyRef.current);
    } finally {
      setRefreshing(false);
    }
  }, [fetchInto]);

  useFocusEffect(
    useCallback(() => {
      if (!reloadOnFocus || !enabled) return;
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void reload();
    }, [reloadOnFocus, enabled, reload]),
  );

  const setData = useCallback((updater: (current: T | undefined) => T | undefined) => {
    setSnapshot((prev) => ({ ...prev, data: updater(prev.data) }));
  }, []);

  const current = snapshot.key === key ? snapshot : null;
  return {
    data: current?.data,
    error: current?.error ?? null,
    loading: enabled && !current?.settled,
    refreshing,
    reload,
    setData,
  };
}

/**
 * Re-runs `onChange` when a row in `tableId` changes (optionally one row).
 * Always unsubscribes on unmount; a single subscription per call site.
 */
export function useRealtimeRows<T>(
  tableId: TableId,
  rowId: string | undefined,
  onEvent: (event: RowEvent<T>) => void,
  enabled = true,
) {
  const handlerRef = useRef(onEvent);
  useEffect(() => {
    handlerRef.current = onEvent;
  });
  useEffect(() => {
    if (!enabled) return;
    return subscribeToRows<T>(tableId, rowId, (event) => handlerRef.current(event));
  }, [tableId, rowId, enabled]);
}
