import { AppwriteException } from 'react-native-appwrite';

/** Normalised error shown to users. Never contains stack traces or raw server text. */
export class AppError extends Error {
  readonly code: string;
  readonly fields?: Record<string, string>;
  /** True when retrying the same action may succeed (network, timeout, 5xx). */
  readonly retryable: boolean;
  /** True when the session is no longer valid and the user must sign in again. */
  readonly sessionExpired: boolean;

  constructor(
    code: string,
    message: string,
    options: { fields?: Record<string, string>; retryable?: boolean; sessionExpired?: boolean } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.fields = options.fields;
    this.retryable = options.retryable ?? false;
    this.sessionExpired = options.sessionExpired ?? false;
  }
}

const OFFLINE_MESSAGE = "We couldn't reach DonorLink. Check your connection and try again.";

const APPWRITE_MESSAGES: Record<string, string> = {
  user_invalid_credentials: 'Incorrect email or password.',
  user_not_found: 'Incorrect email or password.',
  user_already_exists: 'An account with this email already exists. Try signing in instead.',
  user_email_already_exists: 'An account with this email already exists. Try signing in instead.',
  user_blocked: 'This account has been disabled. Contact support for help.',
  user_session_already_exists: 'You are already signed in.',
  user_password_recently_used: 'Choose a password you have not used recently.',
  user_password_personal_data: 'Your password should not contain your name or email.',
  password_recently_used: 'Choose a password you have not used recently.',
  password_personal_data: 'Your password should not contain your name or email.',
  user_invalid_token: 'That code is incorrect or has expired. Request a new one.',
  user_invalid_code: 'That code is incorrect or has expired. Request a new one.',
  general_rate_limit_exceeded: 'Too many attempts. Please wait a minute and try again.',
  user_unauthorized: 'Please sign in again to continue.',
  user_jwt_invalid: 'Please sign in again to continue.',
  storage_file_empty: 'That file is empty.',
  storage_invalid_file_size: 'That file is too large.',
  storage_file_type_unsupported: 'That file type is not supported.',
  storage_invalid_content_range: 'The upload was interrupted. Please try again.',
};

function looksLikeNetworkFailure(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /network request failed|failed to fetch|network error|timeout|timed out|aborted|offline|ECONN|ENOTFOUND|socket/i.test(
    text,
  );
}

/** Converts anything thrown by Appwrite, the Function API or fetch into an AppError. */
export function toAppError(error: unknown, fallback = 'Something went wrong. Please try again.'): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof AppwriteException) {
    const type = error.type ?? '';
    const known = APPWRITE_MESSAGES[type];
    if (error.code === 401 || type === 'user_unauthorized' || type === 'user_jwt_invalid') {
      return new AppError(type || 'unauthorized', known ?? 'Your session has expired. Please sign in again.', {
        sessionExpired: true,
      });
    }
    if (error.code === 0 || looksLikeNetworkFailure(error)) {
      return new AppError('network', OFFLINE_MESSAGE, { retryable: true });
    }
    if (error.code === 429) return new AppError(type || 'rate_limited', known ?? APPWRITE_MESSAGES.general_rate_limit_exceeded, { retryable: true });
    if (error.code === 403) return new AppError(type || 'forbidden', known ?? "You don't have permission to do that.");
    if (error.code === 404) return new AppError(type || 'not_found', known ?? "We couldn't find that. It may have been removed.");
    if (error.code >= 500) {
      return new AppError(type || 'server', "DonorLink is having trouble right now. Please try again in a moment.", {
        retryable: true,
      });
    }
    return new AppError(type || 'appwrite', known ?? fallback);
  }

  if (looksLikeNetworkFailure(error)) return new AppError('network', OFFLINE_MESSAGE, { retryable: true });
  return new AppError('unknown', fallback);
}

export function getErrorMessage(error: unknown, fallback?: string): string {
  return toAppError(error, fallback).message;
}

/** Field errors from a validation failure, or an empty object. */
export function getFieldErrors(error: unknown): Record<string, string> {
  return error instanceof AppError && error.fields ? error.fields : {};
}
