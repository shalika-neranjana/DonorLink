import * as SecureStore from 'expo-secure-store';

import { authApi } from '@/lib/appwrite/auth';
import client, { account } from '@/lib/appwrite/client';
import { appwriteConfig } from '@/lib/appwrite/config';
import { clearFallbackSession, installLocalStorageFallback, readFallbackSession } from '@/lib/appwrite/sessionFallback';

const accountApi = account as unknown as Record<string, jest.Mock>;
const PROJECT = 'proj123';
const store = () => (globalThis as unknown as { localStorage: Storage }).localStorage;

describe('localStorage stand-in for the Appwrite SDK (realtime "cookie fallback" error)', () => {
  beforeAll(() => installLocalStorageFallback());
  beforeEach(() => store().clear?.() ?? store().removeItem('cookieFallback'));

  it('gives the SDK a usable localStorage, so reading the fallback no longer throws', () => {
    expect(() => JSON.parse(store().getItem('cookieFallback') ?? '{}')).not.toThrow();
    expect(typeof store().setItem).toBe('function');
  });

  it('is idempotent and never replaces an existing storage', () => {
    const before = store();
    installLocalStorageFallback();
    expect(store()).toBe(before);
  });

  it('reads the session the SDK saved from the fallback header', () => {
    store().setItem('cookieFallback', JSON.stringify({ [`a_session_${PROJECT}`]: 'encoded-session' }));
    expect(readFallbackSession(PROJECT)).toBe('encoded-session');
  });

  it('returns null for missing, other-project or malformed data', () => {
    expect(readFallbackSession(PROJECT)).toBeNull();
    store().setItem('cookieFallback', JSON.stringify({ a_session_other: 'x' }));
    expect(readFallbackSession(PROJECT)).toBeNull();
    store().setItem('cookieFallback', '{not json');
    expect(readFallbackSession(PROJECT)).toBeNull();
  });

  it('clears the stored session', () => {
    store().setItem('cookieFallback', JSON.stringify({ [`a_session_${PROJECT}`]: 'x' }));
    clearFallbackSession();
    expect(readFallbackSession(PROJECT)).toBeNull();
  });
});

describe('sign-in session hand-off', () => {
  const setSession = client.setSession as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    accountApi.get = jest.fn().mockResolvedValue({ $id: 'u1' });
  });

  it('uses the fallback session when Appwrite returns an empty secret, and keeps it in the keychain', async () => {
    accountApi.createEmailPasswordSession = jest.fn().mockImplementation(async () => {
      // What the SDK does when the response carries X-Fallback-Cookies.
      store().setItem('cookieFallback', JSON.stringify({ [`a_session_${appwriteConfig.projectId}`]: 'fallback-secret' }));
      return { secret: '' };
    });
    await authApi.login('a@example.com', 'Passw0rd!');
    expect(setSession).toHaveBeenCalledWith('fallback-secret');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('donorlink.session', 'fallback-secret');
  });

  it('prefers a secret returned directly', async () => {
    accountApi.createEmailPasswordSession = jest.fn().mockResolvedValue({ secret: 'direct-secret' });
    await authApi.login('a@example.com', 'Passw0rd!');
    expect(setSession).toHaveBeenCalledWith('direct-secret');
  });

  it('still signs in (cookie-jar session) when no secret is available anywhere', async () => {
    store().removeItem('cookieFallback');
    accountApi.createEmailPasswordSession = jest.fn().mockResolvedValue({ secret: '' });
    await expect(authApi.login('a@example.com', 'Passw0rd!')).resolves.toMatchObject({ $id: 'u1' });
    expect(setSession).not.toHaveBeenCalled();
  });

  it('forgets the session on logout', async () => {
    store().setItem('cookieFallback', JSON.stringify({ [`a_session_${appwriteConfig.projectId}`]: 'old' }));
    accountApi.deleteSession = jest.fn().mockResolvedValue({});
    await authApi.logout();
    expect(setSession).toHaveBeenCalledWith('');
    expect(readFallbackSession(appwriteConfig.projectId)).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('donorlink.session');
  });
});
