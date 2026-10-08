/**
 * QA audit (2026-10-09), Phase 5/12: screens from the user's point of view -
 * validation, duplicate taps, error recovery and notification navigation.
 * Services are mocked; nothing here proves live Appwrite behaviour.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';
import { Pressable, Text } from 'react-native';
import type { ReactElement } from 'react';

import * as fixtures from '../screens/helpers/fixtures';

const mockSignUp = jest.fn();
const mockAuth = {
  status: 'signedIn',
  user: { $id: 'u1', name: 'Kasun Perera', email: 'kasun@example.com', emailVerification: true, labels: [] },
  profile: fixtures.profile,
  donorProfile: fixtures.donor,
  signUp: (...args: unknown[]) => mockSignUp(...args),
};
jest.mock('@/providers/AuthProvider', () => ({ useAuth: () => mockAuth, useCurrentUser: () => mockAuth.user }));

const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() };
jest.mock('@/components/ui/DonorLinkToast', () => ({ useToast: () => mockToast }));
jest.mock('@/components/common/OfflineBanner', () => ({ OfflineBanner: () => null }));

const mockAccept = jest.fn();
const mockGetRequest = jest.fn();
const mockGetResponse = jest.fn();
jest.mock('@/services/donorService', () => ({
  donorService: {
    accept: (...a: unknown[]) => mockAccept(...a),
    decline: jest.fn(),
    getResponseForRequest: (...a: unknown[]) => mockGetResponse(...a),
  },
}));
jest.mock('@/services/requestService', () => ({
  requestService: { getRequest: (...a: unknown[]) => mockGetRequest(...a), newClientId: () => 'c1' },
}));
const mockMarkAsRead = jest.fn();
jest.mock('@/services/notificationService', () => ({
  notificationService: { unreadCount: jest.fn().mockResolvedValue(3), markAsRead: (...a: unknown[]) => mockMarkAsRead(...a) },
}));

/* eslint-disable import/first */
import { AppError } from '@/lib/appwrite/errors';
import RegisterScreen from '@/app/(auth)/register';
import IncomingRequestScreen from '@/app/(app)/donor/incoming/[id]';
import { NotificationsProvider, useNotifications } from '@/providers/NotificationsProvider';
import type { AppNotification } from '@/types/entities';

const expoRouter = jest.requireMock('expo-router');
const router = expoRouter.__router as Record<string, jest.Mock>;
const params = expoRouter.__params as Record<string, string>;

const wrap = (ui: ReactElement) => render(<OverlayProvider>{ui}</OverlayProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(params)) delete params[k];
  mockGetRequest.mockResolvedValue(fixtures.request);
  mockGetResponse.mockResolvedValue(fixtures.response);
  mockMarkAsRead.mockResolvedValue({});
});

describe('TC-AUTH register', () => {
  async function fill(values: Record<string, string>) {
    for (const [label, value] of Object.entries(values)) {
      fireEvent.changeText(screen.getByLabelText(new RegExp(`^${label}`)), value);
    }
  }

  it('TC-AUTH-001 shows every missing field with consistent wording and does not call the server', async () => {
    wrap(<RegisterScreen />);
    await act(async () => fireEvent.press(screen.getByText('Create account')));
    expect(screen.getByText('Full name is required.')).toBeTruthy();
    expect(screen.getByText('Email is required.')).toBeTruthy();
    expect(screen.getByText('Password is required.')).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('TC-AUTH-002 rejects weak and mismatched passwords', async () => {
    wrap(<RegisterScreen />);
    await fill({ 'Full name': 'Kasun Perera', Email: 'kasun@example.com', Password: 'password', 'Confirm password': 'password' });
    await act(async () => fireEvent.press(screen.getByText('Create account')));
    expect(screen.getByText('Include at least one letter and one number.')).toBeTruthy();
    await fill({ Password: 'password1', 'Confirm password': 'password2' });
    await act(async () => fireEvent.press(screen.getByText('Create account')));
    expect(screen.getByText('Passwords do not match.')).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('TC-AUTH-003 a double tap creates one account; a server error is shown and the form stays usable', async () => {
    let reject: (e: unknown) => void = () => undefined;
    mockSignUp.mockReturnValueOnce(new Promise((_, r) => (reject = r)));
    wrap(<RegisterScreen />);
    await fill({ 'Full name': 'Kasun Perera', Email: 'kasun@example.com', Password: 'password1', 'Confirm password': 'password1' });
    fireEvent.press(screen.getByText('Create account'));
    fireEvent.press(screen.getByText('Create account'));
    expect(mockSignUp).toHaveBeenCalledTimes(1);
    await act(async () => reject(new AppError('user_already_exists', 'An account with this email already exists. Try signing in instead.')));
    expect(screen.getByText("Couldn't create your account")).toBeTruthy();
    expect(screen.getByText(/already exists/)).toBeTruthy();
    mockSignUp.mockResolvedValueOnce(undefined);
    await act(async () => fireEvent.press(screen.getByText('Create account')));
    expect(mockSignUp).toHaveBeenCalledTimes(2);
  });
});

describe('TC-DONOR incoming request: failures', () => {
  it('TC-DONOR-010 an accept that fails (e.g. enough donors) explains why and refreshes the request', async () => {
    params.id = 'req1';
    mockAccept.mockRejectedValue(new AppError('enough_donors', 'Enough donors have already accepted. Thank you for being ready to help.'));
    wrap(<IncomingRequestScreen />);
    fireEvent.press(await screen.findByText('Accept'));
    await act(async () => fireEvent.press(await screen.findByText("Yes, I'll donate")));
    expect(mockAccept).toHaveBeenCalledTimes(1);
    expect(mockToast.error).toHaveBeenCalledWith("We couldn't accept this request", expect.stringMatching(/Enough donors/));
    // Reloaded after the failure, and no false "thank you" screen.
    await waitFor(() => expect(mockGetRequest).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("You've accepted this request")).toBeNull();
  });

  it('TC-DONOR-011 a closed request cannot be answered', async () => {
    params.id = 'req1';
    mockGetRequest.mockResolvedValue({ ...fixtures.request, status: 'cancelled' });
    wrap(<IncomingRequestScreen />);
    await waitFor(() => expect(screen.getByText('This request is cancelled')).toBeTruthy());
    expect(screen.queryByText('Accept')).toBeNull();
    expect(screen.queryByText('Decline')).toBeNull();
  });

  it('TC-DONOR-012 a request that was never sent to this donor shows a clear empty state', async () => {
    params.id = 'someone-elses';
    mockGetResponse.mockResolvedValue(null);
    wrap(<IncomingRequestScreen />);
    await waitFor(() => expect(screen.getByText("This request isn't available")).toBeTruthy());
  });

  it('TC-NET-010 a network failure while loading offers a retry', async () => {
    params.id = 'req1';
    mockGetRequest.mockRejectedValueOnce(new AppError('network', "We couldn't reach DonorLink. Check your connection and try again.", { retryable: true }));
    wrap(<IncomingRequestScreen />);
    await waitFor(() => expect(screen.getByText(/couldn't reach DonorLink/)).toBeTruthy());
    await act(async () => fireEvent.press(screen.getByText('Try again')));
    await waitFor(() => expect(screen.getByText('Accept')).toBeTruthy());
  });
});

describe('TC-NOTIF opening a notification', () => {
  const unread: AppNotification = {
    ...fixtures.base,
    $id: 'n1',
    userId: 'u1',
    type: 'emergency_request',
    category: 'emergency',
    title: 'Critical: O+ blood needed',
    body: '2 units at NHSL',
    route: '/donor/incoming/req1',
    actionLabel: 'Review request',
    read: false,
  } as AppNotification;

  function Probe({ n }: { n: AppNotification }) {
    const { open, unreadCount } = useNotifications();
    return (
      <>
        <Text testID="count">{String(unreadCount)}</Text>
        <Pressable testID="open" onPress={() => void open(n)} />
      </>
    );
  }

  it('TC-NOTIF-001 marks an unread alert read and opens its deep link', async () => {
    render(
      <NotificationsProvider>
        <Probe n={unread} />
      </NotificationsProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('count').props.children).toBe('3'));
    await act(async () => fireEvent.press(screen.getByTestId('open')));
    expect(mockMarkAsRead).toHaveBeenCalledWith('n1');
    expect(router.push).toHaveBeenCalledWith('/donor/incoming/req1');
    await waitFor(() => expect(screen.getByTestId('count').props.children).toBe('2'));
  });

  it('TC-NOTIF-002 opening an already-read alert does not call the server again', async () => {
    render(
      <NotificationsProvider>
        <Probe n={{ ...unread, read: true }} />
      </NotificationsProvider>,
    );
    await act(async () => fireEvent.press(screen.getByTestId('open')));
    expect(mockMarkAsRead).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/donor/incoming/req1');
  });

  it('TC-NOTIF-003 navigation still works when marking read fails (offline)', async () => {
    mockMarkAsRead.mockRejectedValue(new AppError('network', 'offline', { retryable: true }));
    render(
      <NotificationsProvider>
        <Probe n={unread} />
      </NotificationsProvider>,
    );
    await act(async () => fireEvent.press(screen.getByTestId('open')));
    expect(router.push).toHaveBeenCalledWith('/donor/incoming/req1');
  });
});
