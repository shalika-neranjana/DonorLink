/**
 * QA audit (2026-10-09): AuthProvider session lifecycle - restore, sign-out
 * clean-up (DL-QA-009) and expired-session handling. Appwrite is mocked.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

const mockAuthApi = {
  restoreSession: jest.fn(),
  login: jest.fn(),
  logout: jest.fn().mockResolvedValue(undefined),
  register: jest.fn(),
};
jest.mock('@/lib/appwrite/auth', () => ({
  get authApi() {
    return mockAuthApi;
  },
}));
jest.mock('@/lib/appwrite/config', () => ({ isAppwriteConfigured: () => true }));
jest.mock('@/services/profileService', () => ({
  profileService: {
    getProfile: jest.fn().mockResolvedValue({ $id: 'u1', onboardingComplete: true }),
    getDonorProfile: jest.fn().mockResolvedValue(null),
  },
}));

/* eslint-disable import/first */
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { matchCache } from '@/features/requester/matchCache';
import { AppError } from '@/lib/appwrite/errors';

function Probe() {
  const auth = useAuth();
  return (
    <>
      <Text testID="status">{auth.status}</Text>
      <Text testID="onboarding">{String(auth.needsOnboarding)}</Text>
      <Pressable testID="out" onPress={() => void auth.signOut()} />
      <Pressable testID="retry" onPress={() => void auth.retryBoot()} />
    </>
  );
}

const USER = { $id: 'u1', name: 'Kasun', email: 'k@example.com', emailVerification: true, labels: [] };

beforeEach(() => {
  jest.clearAllMocks();
  matchCache.clear();
});

describe('TC-AUTH session lifecycle', () => {
  it('TC-AUTH-030 restores a saved session on launch', async () => {
    mockAuthApi.restoreSession.mockResolvedValue(USER);
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('signedIn'));
    expect(screen.getByTestId('onboarding').props.children).toBe('false');
  });

  it('TC-AUTH-031 sign-out forgets cached donor matches (shared-device privacy, DL-QA-009)', async () => {
    mockAuthApi.restoreSession.mockResolvedValue(USER);
    matchCache.set('req1', [{ donorId: 'd1', displayName: 'Nimali S.' } as never]);
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('signedIn'));
    await act(async () => fireEvent.press(screen.getByTestId('out')));
    expect(mockAuthApi.logout).toHaveBeenCalled();
    expect(screen.getByTestId('status').props.children).toBe('signedOut');
    expect(matchCache.find('req1', 'd1')).toBeUndefined();
  });

  it('TC-NET-020 offline at launch shows a retryable error instead of signing the user out', async () => {
    mockAuthApi.restoreSession.mockRejectedValueOnce(new AppError('network', 'offline', { retryable: true }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('error'));
    mockAuthApi.restoreSession.mockResolvedValue(USER);
    await act(async () => fireEvent.press(screen.getByTestId('retry')));
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('signedIn'));
  });

  it('TC-AUTH-032 no saved session means signed out', async () => {
    mockAuthApi.restoreSession.mockResolvedValue(null);
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('signedOut'));
  });
});
