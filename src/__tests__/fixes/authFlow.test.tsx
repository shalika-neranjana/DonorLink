import { render } from '@testing-library/react-native';

import { account } from '@/lib/appwrite/client';
import { authApi } from '@/lib/appwrite/auth';
import AuthLayout from '@/app/(auth)/_layout';

const mockAuth = {
  status: 'signedIn',
  needsOnboarding: true,
  emailVerified: false,
  emailPromptDismissed: false,
};
let mockSegments: string[] = ['(auth)', 'register'];
const mockRedirect = jest.fn();

jest.mock('@/providers/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => {
    mockRedirect(props.href);
    return null;
  },
  Stack: () => null,
  useSegments: () => mockSegments,
}));

const accountApi = account as unknown as Record<string, jest.Mock>;

beforeEach(() => {
  mockRedirect.mockClear();
  Object.assign(mockAuth, { status: 'signedIn', needsOnboarding: true, emailVerified: false, emailPromptDismissed: false });
  mockSegments = ['(auth)', 'register'];
});

describe('auth layout redirects (Bug 1)', () => {
  it('moves a freshly signed-up user from the register screen to email verification', () => {
    render(<AuthLayout />);
    expect(mockRedirect).toHaveBeenCalledWith('/verify-email');
  });

  it('does the same for an unverified user signing in from the login screen', () => {
    mockSegments = ['(auth)', 'login'];
    render(<AuthLayout />);
    expect(mockRedirect).toHaveBeenCalledWith('/verify-email');
  });

  it('does not redirect while already on the verification screen', () => {
    mockSegments = ['(auth)', 'verify-email'];
    render(<AuthLayout />);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('does not redirect once the email is verified or the prompt was skipped', () => {
    mockAuth.emailVerified = true;
    render(<AuthLayout />);
    mockAuth.emailVerified = false;
    mockAuth.emailPromptDismissed = true;
    render(<AuthLayout />);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('returns a signed-out user to the welcome screen after "Use a different account"', () => {
    Object.assign(mockAuth, { status: 'signedOut' });
    mockSegments = ['(auth)', 'verify-email'];
    render(<AuthLayout />);
    expect(mockRedirect).toHaveBeenCalledWith('/welcome');
  });

  it('leaves signed-out users on the other auth screens alone', () => {
    Object.assign(mockAuth, { status: 'signedOut' });
    mockSegments = ['(auth)', 'login'];
    render(<AuthLayout />);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

describe('email verification code (Bug 2)', () => {
  it('confirms the emailed code with the OTP endpoint, not the link-token endpoint', async () => {
    accountApi.updateEmailVerificationOTP = jest.fn().mockResolvedValue({});
    accountApi.updateEmailVerification = jest.fn().mockResolvedValue({});
    accountApi.get = jest.fn().mockResolvedValue({ $id: 'u1', emailVerification: true });

    const user = await authApi.confirmVerificationCode('u1', ' 012345 ');

    expect(accountApi.updateEmailVerificationOTP).toHaveBeenCalledWith({ userId: 'u1', secret: '012345' });
    expect(accountApi.updateEmailVerification).not.toHaveBeenCalled();
    expect(user.emailVerification).toBe(true);
  });

  it('keeps leading zeros (the code is a string, never a number)', async () => {
    accountApi.updateEmailVerificationOTP = jest.fn().mockResolvedValue({});
    accountApi.get = jest.fn().mockResolvedValue({ $id: 'u1' });
    await authApi.confirmVerificationCode('u1', '000123');
    expect(accountApi.updateEmailVerificationOTP).toHaveBeenCalledWith({ userId: 'u1', secret: '000123' });
  });

  it('sends the code with the matching OTP call', async () => {
    accountApi.createEmailVerificationOTP = jest.fn().mockResolvedValue({});
    await authApi.sendVerificationCode();
    expect(accountApi.createEmailVerificationOTP).toHaveBeenCalled();
  });

  it('reports a wrong or expired code in plain language', async () => {
    const { AppwriteException } = jest.requireActual('react-native-appwrite');
    accountApi.updateEmailVerificationOTP = jest
      .fn()
      .mockRejectedValue(new AppwriteException('Invalid token passed in the request.', 401, 'user_invalid_token'));
    await expect(authApi.confirmVerificationCode('u1', '999999')).rejects.toMatchObject({
      message: 'That code is incorrect or has expired. Request a new one.',
    });
  });
});

describe('sign-up (Bug 1)', () => {
  it('says the account exists when only the follow-up sign-in fails', async () => {
    accountApi.create = jest.fn().mockResolvedValue({});
    accountApi.createEmailPasswordSession = jest.fn().mockRejectedValue(new Error('Network request failed'));
    await expect(authApi.register({ name: 'Test User', email: 'test@example.com', password: 'Passw0rd!' })).rejects.toMatchObject({
      message: expect.stringContaining('Your account was created'),
    });
  });

  it('reports a duplicate email from account creation itself', async () => {
    const { AppwriteException } = jest.requireActual('react-native-appwrite');
    accountApi.create = jest.fn().mockRejectedValue(new AppwriteException('exists', 409, 'user_already_exists'));
    await expect(authApi.register({ name: 'Test User', email: 'test@example.com', password: 'Passw0rd!' })).rejects.toMatchObject({
      message: expect.stringContaining('already exists'),
    });
  });
});
