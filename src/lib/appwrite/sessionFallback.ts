/**
 * Session hand-off for the Appwrite SDK on React Native.
 *
 * Appwrite does not return the session secret to client apps
 * (`Session.secret` is "only included if the request was made with an API
 * key"), and the SDK's fallback for that case writes the session into
 * `window.localStorage` ("cookieFallback"), which React Native does not have.
 * Without it the realtime socket could never learn the session: it logged
 * "Failed to parse cookie fallback: Cannot read property 'getItem' of
 * undefined" on every connect and stayed unauthenticated.
 *
 * Providing a minimal in-memory `localStorage` lets the SDK's own fallback
 * work. `readFallbackSession` then reads the session value back out so it can
 * be kept in the device keychain and re-applied with `client.setSession`.
 */
const FALLBACK_KEY = 'cookieFallback';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, String(value)),
    removeItem: (key) => void values.delete(key),
  };
}

function storage(): StorageLike | undefined {
  return (globalThis as { localStorage?: StorageLike }).localStorage;
}

/** Idempotent. A real `localStorage` (the web preview) is left alone. */
export function installLocalStorageFallback(): void {
  if (storage()) return;
  Object.defineProperty(globalThis, 'localStorage', { value: createMemoryStorage(), configurable: true, writable: true });
}

/** The `a_session_<project>` value the SDK saved from the last session response, if any. */
export function readFallbackSession(projectId: string): string | null {
  try {
    const raw = storage()?.getItem(FALLBACK_KEY);
    if (!raw) return null;
    const cookies = JSON.parse(raw) as Record<string, unknown>;
    const value = cookies[`a_session_${projectId}`];
    return typeof value === 'string' && value ? value : null;
  } catch {
    return null;
  }
}

export function clearFallbackSession(): void {
  try {
    storage()?.removeItem(FALLBACK_KEY);
  } catch {
    // nothing stored
  }
}
