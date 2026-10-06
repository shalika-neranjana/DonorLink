import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { isAdmin, isOrganizationMember, organizationIdsFromLabels } from '@/domain';
import { authApi, type AuthUser } from '@/lib/appwrite/auth';
import { isAppwriteConfigured } from '@/lib/appwrite/config';
import { AppError, toAppError } from '@/lib/appwrite/errors';
import { clearImageCache } from '@/lib/appwrite/files';
import { setSessionExpiredHandler } from '@/hooks/useResource';
import { profileService } from '@/services/profileService';
import type { DonorProfile, Profile } from '@/types/entities';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'error';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  profile: Profile | null;
  donorProfile: DonorProfile | null;
  /** Set when restoring the session / loading the profile failed (offline, server down). */
  bootError: AppError | null;
  labels: string[];
  isAdmin: boolean;
  isOrganizationMember: boolean;
  organizationIds: string[];
  emailVerified: boolean;
  /** User chose "verify later" this session. */
  emailPromptDismissed: boolean;
  needsOnboarding: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { name: string; email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  refreshProfile: () => Promise<Profile | null>;
  refreshDonorProfile: () => Promise<DonorProfile | null>;
  setProfile: (profile: Profile) => void;
  setDonorProfile: (donor: DonorProfile | null) => void;
  dismissEmailPrompt: () => void;
  retryBoot: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const CONFIGURED = isAppwriteConfigured();
const MISCONFIGURED_ERROR = new AppError('misconfigured', 'DonorLink is not configured. Check the EXPO_PUBLIC_APPWRITE_* values in .env.');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(CONFIGURED ? 'loading' : 'error');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [donorProfile, setDonorProfile] = useState<DonorProfile | null>(null);
  const [bootError, setBootError] = useState<AppError | null>(CONFIGURED ? null : MISCONFIGURED_ERROR);
  const [emailPromptDismissed, setEmailPromptDismissed] = useState(false);

  const loadAccount = useCallback(async (nextUser: AuthUser) => {
    const [loadedProfile, loadedDonor] = await Promise.all([
      profileService.getProfile(nextUser.$id),
      profileService.getDonorProfile(nextUser.$id),
    ]);
    setUser(nextUser);
    setProfileState(loadedProfile);
    setDonorProfile(loadedDonor);
    setBootError(null);
    setStatus('signedIn');
  }, []);

  const boot = useCallback(
    (): Promise<void> =>
      authApi
        .restoreSession()
        .then(async (restored) => {
          if (!restored) {
            setUser(null);
            setStatus('signedOut');
            return;
          }
          await loadAccount(restored);
        })
        .catch((error) => {
          setBootError(toAppError(error));
          setStatus('error');
        }),
    [loadAccount],
  );

  const retryBoot = useCallback(async () => {
    setStatus('loading');
    await boot();
  }, [boot]);

  useEffect(() => {
    if (CONFIGURED) void boot();
  }, [boot]);

  const resetLocal = useCallback(() => {
    setUser(null);
    setProfileState(null);
    setDonorProfile(null);
    setEmailPromptDismissed(false);
    clearImageCache();
    setStatus('signedOut');
  }, []);

  const signOut = useCallback(async () => {
    await authApi.logout();
    resetLocal();
  }, [resetLocal]);

  // Any request that fails with an expired session ends the session cleanly.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      void authApi.logout().finally(resetLocal);
    });
    return () => setSessionExpiredHandler(null);
  }, [resetLocal]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const signedIn = await authApi.login(email, password);
      try {
        await loadAccount(signedIn);
      } catch (error) {
        await authApi.logout();
        throw toAppError(error);
      }
    },
    [loadAccount],
  );

  const signUp = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const created = await authApi.register(input);
      await loadAccount(created);
    },
    [loadAccount],
  );

  const refreshUser = useCallback(async () => {
    try {
      const next = await authApi.restoreSession();
      if (next) setUser(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return null;
    const next = await profileService.getProfile(user.$id);
    setProfileState(next);
    return next;
  }, [user]);

  const refreshDonorProfile = useCallback(async () => {
    if (!user) return null;
    const next = await profileService.getDonorProfile(user.$id);
    setDonorProfile(next);
    return next;
  }, [user]);

  const labels = useMemo(() => user?.labels ?? [], [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      profile,
      donorProfile,
      bootError,
      labels,
      isAdmin: isAdmin(labels),
      isOrganizationMember: isOrganizationMember(labels),
      organizationIds: organizationIdsFromLabels(labels),
      emailVerified: !!user?.emailVerification,
      emailPromptDismissed,
      needsOnboarding: status === 'signedIn' && !profile?.onboardingComplete,
      signIn,
      signUp,
      signOut,
      refreshUser,
      refreshProfile,
      refreshDonorProfile,
      setProfile: setProfileState,
      setDonorProfile,
      dismissEmailPrompt: () => setEmailPromptDismissed(true),
      retryBoot,
    }),
    [status, user, profile, donorProfile, bootError, labels, emailPromptDismissed, signIn, signUp, signOut, refreshUser, refreshProfile, refreshDonorProfile, retryBoot],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}

/** For screens that only render when signed in. */
export function useCurrentUser(): AuthUser {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser used while signed out.');
  return user;
}
