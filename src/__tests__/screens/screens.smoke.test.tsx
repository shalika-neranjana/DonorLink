import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';
import type { ReactElement } from 'react';

import type { AuthContextValue } from '@/providers/AuthProvider';
import * as fixtures from './helpers/fixtures';

const { request, response } = fixtures;

const mockAuth: Partial<AuthContextValue> = {
  status: 'signedIn',
  user: { $id: 'u1', name: 'Kasun Perera', email: 'kasun@example.com', emailVerification: true, labels: [] } as never,
  profile: fixtures.profile,
  donorProfile: fixtures.donor,
  labels: [],
  isAdmin: false,
  isOrganizationMember: false,
  organizationIds: [],
  emailVerified: true,
  setProfile: jest.fn(),
  setDonorProfile: jest.fn(),
  refreshUser: jest.fn(),
  refreshDonorProfile: jest.fn(),
  signOut: jest.fn(),
};

jest.mock('@/providers/AuthProvider', () => ({
  useAuth: () => mockAuth,
  useCurrentUser: () => mockAuth.user,
}));
jest.mock('@/providers/NotificationsProvider', () => ({
  useNotifications: () => ({ unreadCount: 2, refreshUnread: jest.fn(), revision: 0, open: jest.fn() }),
}));
jest.mock('@/components/ui/DonorLinkToast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() }),
}));
jest.mock('@/components/common/OfflineBanner', () => ({ OfflineBanner: () => null }));

const mockRequests = jest.fn();
const mockInvitations = jest.fn();
const mockMatches = jest.fn();
jest.mock('@/services/requestService', () => ({
  requestService: {
    newClientId: () => 'client1',
    listMyActiveRequests: () => mockRequests(),
    listMyRequests: () => mockRequests(),
    listHospitals: jest.fn().mockResolvedValue([]),
    getRequest: jest.fn().mockResolvedValue(require('./helpers/fixtures').request),
    listResponses: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock('@/services/donorService', () => ({
  donorService: {
    listPendingInvitations: () => mockInvitations(),
    listActiveDonations: jest.fn().mockResolvedValue([]),
    getResponseForRequest: jest.fn().mockResolvedValue(require('./helpers/fixtures').response),
    getDonationForRequest: jest.fn().mockResolvedValue(null),
    accept: jest.fn().mockResolvedValue({}),
    decline: jest.fn().mockResolvedValue({}),
  },
}));
jest.mock('@/services/donationService', () => ({ donationService: { listForRequest: jest.fn().mockResolvedValue([]) } }));
jest.mock('@/services/notificationService', () => ({
  notificationService: {
    list: jest.fn().mockResolvedValue([
      { ...require('./helpers/fixtures').base, $id: 'n1', userId: 'u1', type: 'emergency_request', category: 'emergency', title: 'Critical: O+ blood needed', body: '2 units at NHSL', route: '/donor/incoming/req1', actionLabel: 'Review request', read: false },
    ]),
    unreadCount: jest.fn().mockResolvedValue(1),
  },
}));
jest.mock('@/services/matchingService', () => ({
  matchingService: { getMatches: (...args: unknown[]) => mockMatches(...args), contactDonor: jest.fn() },
}));
jest.mock('@/lib/appwrite/database', () => ({
  Query: { equal: () => '', limit: () => '', orderDesc: () => '' },
  listRows: jest.fn().mockResolvedValue({ rows: [require('./helpers/fixtures').request], total: 1 }),
  findRow: jest.fn(),
  getRow: jest.fn(),
}));

/* eslint-disable import/first */
import HomeScreen from '@/app/(app)/(tabs)/index';
import RequestsScreen from '@/app/(app)/(tabs)/requests';
import NotificationsScreen from '@/app/(app)/(tabs)/notifications';
import ProfileScreen from '@/app/(app)/(tabs)/profile';
import CreateRequestScreen from '@/app/(app)/requests/create';
import IncomingRequestScreen from '@/app/(app)/donor/incoming/[id]';
import MatchingDonorsScreen from '@/app/(app)/requests/matching';
import DonorAvailabilityScreen from '@/app/(app)/donor/availability';
import WelcomeScreen from '@/app/(auth)/welcome';
import LoginScreen from '@/app/(auth)/login';
import { RequestDraftProvider } from '@/features/requester/RequestDraftContext';
const searchParams: Record<string, string> = jest.requireMock('expo-router').__params;

function renderScreen(ui: ReactElement) {
  return render(
    <OverlayProvider>
      <RequestDraftProvider>{ui}</RequestDraftProvider>
    </OverlayProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequests.mockResolvedValue([request]);
  mockInvitations.mockResolvedValue([response]);
  mockMatches.mockResolvedValue({ matches: [], searchedRadiusKm: 25, totalCandidates: 0, disclaimer: 'x' });
  for (const key of Object.keys(searchParams)) delete searchParams[key];
});

describe('screen smoke tests (render without crashing, key content present)', () => {
  it('Home shows the emergency action, availability and active requests', async () => {
    renderScreen(<HomeScreen />);
    expect(screen.getByText('Request blood')).toBeTruthy();
    expect(screen.getByText('AVAILABLE')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Your active requests')).toBeTruthy());
    expect(screen.getAllByText('National Hospital of Sri Lanka').length).toBeGreaterThan(0);
    expect(screen.getByText('Asking for your help')).toBeTruthy();
  });

  it('Requests tab lists requests and offers filters', async () => {
    renderScreen(<RequestsScreen />);
    await waitFor(() => expect(screen.getAllByText('National Hospital of Sri Lanka').length).toBeGreaterThan(0));
    expect(screen.getByText('Filter')).toBeTruthy();
  });

  it('Requests tab shows a helpful empty state', async () => {
    mockRequests.mockResolvedValue([]);
    renderScreen(<RequestsScreen />);
    await waitFor(() => expect(screen.getByText('No active blood requests')).toBeTruthy());
  });

  it('Notifications shows categories and the notification', async () => {
    renderScreen(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText('Critical: O+ blood needed')).toBeTruthy());
    expect(screen.getByText('Emergency')).toBeTruthy();
    expect(screen.getByText('Review request')).toBeTruthy();
  });

  it('Profile shows verification, workspaces and sign out', () => {
    renderScreen(<ProfileScreen />);
    expect(screen.getByText('Kasun Perera')).toBeTruthy();
    expect(screen.getByText('Sign out')).toBeTruthy();
    expect(screen.getByText('Register an organization')).toBeTruthy();
  });

  it('Create request validates required fields before reviewing', async () => {
    renderScreen(<CreateRequestScreen />);
    fireEvent.press(screen.getByText('Review request'));
    await waitFor(() => expect(screen.getByText('Blood group is required.')).toBeTruthy());
    expect(screen.getByText('Urgency is required.')).toBeTruthy();
    expect(screen.getByText('Hospital is required.')).toBeTruthy();
  });

  it('Incoming request offers distinct Accept and Decline actions', async () => {
    searchParams.id = 'req1';
    renderScreen(<IncomingRequestScreen />);
    await waitFor(() => expect(screen.getByText('Accept')).toBeTruthy());
    expect(screen.getByText('Decline')).toBeTruthy();
    expect(screen.getByText('Critical request')).toBeTruthy();
    expect(screen.getByText('Please come to the blood bank.')).toBeTruthy();
  });

  it('Matching donors shows the empty state with a way to widen the search', async () => {
    searchParams.id = 'req1';
    renderScreen(<MatchingDonorsScreen />);
    await waitFor(() => expect(screen.getByText("We couldn't find a suitable available donor nearby")).toBeTruthy());
    expect(screen.getByText('Search within 50 km')).toBeTruthy();
  });

  it('Donor availability screen renders the single settings form', () => {
    renderScreen(<DonorAvailabilityScreen />);
    expect(screen.getByText('Available to donate')).toBeTruthy();
    expect(screen.getByText('Save availability')).toBeTruthy();
    expect(screen.getByText('Emergency request notifications')).toBeTruthy();
  });

  it('Welcome and Login render with their primary actions', () => {
    renderScreen(<WelcomeScreen />);
    expect(screen.getByText('Create account')).toBeTruthy();
    renderScreen(<LoginScreen />);
    expect(screen.getByText('Sign in')).toBeTruthy();
  });

  it('Login blocks empty submission with consistent messages', async () => {
    renderScreen(<LoginScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Sign in'));
    });
    expect(screen.getByText('Email is required.')).toBeTruthy();
    expect(screen.getByText('Password is required.')).toBeTruthy();
  });

  it('Accepting asks for confirmation, calls the API once and shows a clear outcome', async () => {
    const { donorService } = jest.requireMock('@/services/donorService');
    searchParams.id = 'req1';
    renderScreen(<IncomingRequestScreen />);
    await waitFor(() => expect(screen.getByText('Accept')).toBeTruthy());
    fireEvent.press(screen.getByText('Accept'));
    await waitFor(() => expect(screen.getByText('Accept this request?')).toBeTruthy());
    expect(donorService.accept).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByText("Yes, I'll donate"));
    });
    expect(donorService.accept).toHaveBeenCalledTimes(1);
    expect(donorService.accept).toHaveBeenCalledWith('req1');
    await waitFor(() => expect(screen.getByText("You've accepted this request")).toBeTruthy());
  });

  it('Declining sends the chosen reason', async () => {
    const { donorService } = jest.requireMock('@/services/donorService');
    searchParams.id = 'req1';
    renderScreen(<IncomingRequestScreen />);
    await waitFor(() => expect(screen.getByText('Decline')).toBeTruthy());
    fireEvent.press(screen.getByText('Decline'));
    await waitFor(() => expect(screen.getByText('Too far away')).toBeTruthy());
    fireEvent.press(screen.getByText('Too far away'));
    await act(async () => {
      fireEvent.press(screen.getByText('Decline request'));
    });
    expect(donorService.decline).toHaveBeenCalledWith('req1', 'Too far away');
    await waitFor(() => expect(screen.getByText("You've declined this request")).toBeTruthy());
  });
});
