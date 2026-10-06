import { ID, type Models } from 'react-native-appwrite';

import client, { account } from './client';
import { toAppError } from './errors';
import { secureStorage } from './secureStorage';

const SESSION_KEY = 'donorlink.session';

export type AuthUser = Models.User<Models.Preferences>;

/**
 * Appwrite session handling.
 *
 * The session secret returned at sign-in is stored in the device keychain
 * (expo-secure-store) and re-applied on launch, so users stay signed in
 * without us ever storing a password.
 */
export const authApi = {
  /** Restores a previous session. Returns null when signed out or expired. */
  async restoreSession(): Promise<AuthUser | null> {
    const secret = await secureStorage.get(SESSION_KEY);
    if (secret) client.setSession(secret);
    try {
      return await account.get();
    } catch (error) {
      const appError = toAppError(error);
      if (appError.code === 'network' || appError.retryable) throw appError;
      await secureStorage.remove(SESSION_KEY);
      return null;
    }
  },

  async register(input: { name: string; email: string; password: string }): Promise<AuthUser> {
    try {
      await account.create({
        userId: ID.unique(),
        email: input.email.trim().toLowerCase(),
        password: input.password,
        name: input.name.trim(),
      });
      return await authApi.login(input.email, input.password);
    } catch (error) {
      throw toAppError(error, "We couldn't create your account. Please try again.");
    }
  },

  async login(email: string, password: string): Promise<AuthUser> {
    try {
      const session = await account.createEmailPasswordSession({
        email: email.trim().toLowerCase(),
        password,
      });
      if (session.secret) {
        client.setSession(session.secret);
        await secureStorage.set(SESSION_KEY, session.secret);
      }
      return await account.get();
    } catch (error) {
      throw toAppError(error, "We couldn't sign you in. Please try again.");
    }
  },

  async logout(): Promise<void> {
    try {
      await account.deleteSession({ sessionId: 'current' });
    } catch {
      // The local session is cleared regardless; the server session expires on its own.
    }
    client.setSession('');
    await secureStorage.remove(SESSION_KEY);
  },

  /** Sends a 6-digit code to the signed-in user's email. */
  async sendVerificationCode(): Promise<void> {
    try {
      await account.createEmailVerificationOTP();
    } catch (error) {
      throw toAppError(error, "We couldn't send the code. Please try again.");
    }
  },

  async confirmVerificationCode(userId: string, code: string): Promise<AuthUser> {
    try {
      await account.updateEmailVerification({ userId, secret: code.trim() });
      return await account.get();
    } catch (error) {
      throw toAppError(error, "We couldn't verify that code. Please try again.");
    }
  },

  /** Sends a 6-digit recovery code. Returns the userId needed to confirm it. */
  async sendRecoveryCode(email: string): Promise<string> {
    try {
      const token = await account.createRecoveryOTP({ email: email.trim().toLowerCase() });
      return token.userId;
    } catch (error) {
      throw toAppError(error, "We couldn't send a reset code. Please try again.");
    }
  },

  async resetPassword(userId: string, code: string, password: string): Promise<void> {
    try {
      await account.updateRecoveryOTP({ userId, secret: code.trim(), password });
    } catch (error) {
      throw toAppError(error, "We couldn't reset your password. Please try again.");
    }
  },

  async updatePassword(oldPassword: string, password: string): Promise<void> {
    try {
      await account.updatePassword({ password, oldPassword });
    } catch (error) {
      throw toAppError(error, "We couldn't change your password. Please try again.");
    }
  },

  async updateName(name: string): Promise<AuthUser> {
    try {
      return await account.updateName({ name: name.trim() });
    } catch (error) {
      throw toAppError(error);
    }
  },
};
