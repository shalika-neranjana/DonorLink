/**
 * QA audit (2026-10-09): client behaviour that the server cannot protect -
 * shared-device privacy, duplicate taps, and recovery after errors.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';
import { Pressable, Text } from 'react-native';

const mockAuth: { user: { $id: string } | null; status: string } = { user: { $id: 'userA' }, status: 'signedIn' };
jest.mock('@/providers/AuthProvider', () => ({ useAuth: () => mockAuth }));

const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() };
jest.mock('@/components/ui/DonorLinkToast', () => ({ useToast: () => mockToast }));
jest.mock('@/components/common/OfflineBanner', () => ({ OfflineBanner: () => null }));

const mockCreate = jest.fn();
let mockClientIds = 0;
jest.mock('@/services/requestService', () => ({
  requestService: {
    newClientId: () => `client${++mockClientIds}`,
    createEmergencyRequest: (...args: unknown[]) => mockCreate(...args),
  },
}));

/* eslint-disable import/first */
import { AppError } from '@/lib/appwrite/errors';
import ReviewRequestScreen from '@/app/(app)/requests/review';
import { RequestDraftProvider, useRequestDraft, type RequestDraft } from '@/features/requester/RequestDraftContext';
const router = jest.requireMock('expo-router').__router as Record<string, jest.Mock>;

const FILLED: RequestDraft = {
  bloodGroup: 'O-',
  units: 2,
  urgency: 'critical',
  hospitalId: null,
  hospitalName: 'Private Clinic',
  district: 'Colombo',
  wardUnit: 'ICU bed 4',
  requiredBy: null,
  relationship: 'Family member',
  notes: 'Patient in surgery',
};

function DraftProbe() {
  const { draft, setDraft, clientId } = useRequestDraft();
  return (
    <>
      <Text testID="draft">{`${draft.hospitalName}|${draft.notes}|${clientId}`}</Text>
      <Pressable testID="fill" onPress={() => setDraft(FILLED)} />
    </>
  );
}

function Prefill({ children }: { children: React.ReactNode }) {
  const { setDraft, draft } = useRequestDraft();
  if (draft.hospitalName === '') setDraft(FILLED);
  return <>{children}</>;
}

function renderReview() {
  return render(
    <OverlayProvider>
      <RequestDraftProvider>
        <Prefill>
          <ReviewRequestScreen />
        </Prefill>
      </RequestDraftProvider>
    </OverlayProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.user = { $id: 'userA' };
  mockAuth.status = 'signedIn';
});

describe('TC-PATIENT shared-device privacy (DL-QA-009)', () => {
  it('TC-PATIENT-010 an unsent request draft is not shown to the next account on the device', () => {
    const view = render(
      <RequestDraftProvider>
        <DraftProbe />
      </RequestDraftProvider>,
    );
    fireEvent.press(screen.getByTestId('fill'));
    expect(screen.getByTestId('draft').props.children).toContain('Patient in surgery');
    const firstClientId = String(screen.getByTestId('draft').props.children).split('|')[2];

    // User A signs out and user B signs in on the same device.
    mockAuth.user = null;
    mockAuth.status = 'signedOut';
    view.rerender(
      <RequestDraftProvider>
        <DraftProbe />
      </RequestDraftProvider>,
    );
    mockAuth.user = { $id: 'userB' };
    mockAuth.status = 'signedIn';
    view.rerender(
      <RequestDraftProvider>
        <DraftProbe />
      </RequestDraftProvider>,
    );

    const text = String(screen.getByTestId('draft').props.children);
    expect(text).not.toContain('Patient in surgery');
    expect(text).not.toContain('Private Clinic');
    // A new submission id too, so B can never collide with A's idempotency key.
    expect(text.split('|')[2]).not.toBe(firstClientId);
  });
});

describe('TC-PATIENT review and submit', () => {
  it('TC-PATIENT-011 a double tap on Submit sends one request', async () => {
    let resolve: (v: unknown) => void = () => undefined;
    mockCreate.mockReturnValue(new Promise((r) => (resolve = r)));
    renderReview();
    const submit = await screen.findByText('Submit request');
    fireEvent.press(submit);
    fireEvent.press(submit);
    fireEvent.press(submit);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ request: { $id: 'r1', status: 'pending_verification' }, duplicate: false }));
    expect(router.replace).toHaveBeenCalledWith('/requests/matching?id=r1&fresh=1');
  });

  it('TC-PATIENT-012 a retry after a failure reuses the same client id (no duplicate request)', async () => {
    mockCreate.mockRejectedValueOnce(new AppError('timeout', "That's taking longer than expected.", { retryable: true }));
    mockCreate.mockResolvedValueOnce({ request: { $id: 'r1', status: 'pending_verification' }, duplicate: true });
    renderReview();
    fireEvent.press(await screen.findByText('Submit request'));
    await waitFor(() => expect(screen.getByText('Request not sent')).toBeTruthy());
    expect(screen.getByText(/taking longer than expected/)).toBeTruthy();
    // The button is usable again.
    fireEvent.press(screen.getByText('Submit request'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(2));
    expect(mockCreate.mock.calls[0][1]).toBe(mockCreate.mock.calls[1][1]);
  });

  it('TC-PATIENT-013 a near-duplicate is explained with a way to the existing request', async () => {
    mockCreate.mockRejectedValue(new AppError('duplicate_request', 'You already submitted a similar request a moment ago.'));
    renderReview();
    fireEvent.press(await screen.findByText('Submit request'));
    await waitFor(() => expect(screen.getByText('Open my requests')).toBeTruthy());
    fireEvent.press(screen.getByText('Open my requests'));
    expect(router.replace).toHaveBeenCalledWith('/requests');
  });
});
