import { ExecutionMethod } from 'react-native-appwrite';

import { AppError, toAppError } from './errors';
import { functions } from './client';
import { appwriteConfig } from './config';

const REQUEST_TIMEOUT_MS = 30_000;

interface ApiSuccess<T> {
  ok: true;
  data: T;
}
interface ApiFailure {
  ok: false;
  error: { code: string; message: string; fields?: Record<string, string> };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AppError('timeout', "That's taking longer than expected. Check your connection and try again.", { retryable: true })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/**
 * Calls the `donorlink-api` Appwrite Function. All privileged writes go
 * through here: the function authenticates the caller, validates the input
 * again and enforces the status-transition rules.
 */
export async function callApi<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  try {
    const execution = await withTimeout(
      functions.createExecution({
        functionId: appwriteConfig.functionId,
        body: JSON.stringify({ action, payload }),
        async: false,
        xpath: '/',
        method: ExecutionMethod.POST,
        headers: { 'content-type': 'application/json' },
      }),
      REQUEST_TIMEOUT_MS,
    );

    let parsed: ApiSuccess<T> | ApiFailure | null = null;
    try {
      parsed = execution.responseBody ? (JSON.parse(execution.responseBody) as ApiSuccess<T> | ApiFailure) : null;
    } catch {
      parsed = null;
    }

    if (parsed && parsed.ok) return parsed.data;
    if (parsed && !parsed.ok) {
      const { code, message, fields } = parsed.error;
      throw new AppError(code, message, {
        fields,
        retryable: execution.responseStatusCode >= 500,
        sessionExpired: code === 'unauthorized',
      });
    }
    // The function crashed or is not deployed.
    if (execution.status === 'failed' || execution.responseStatusCode >= 500 || !execution.responseBody) {
      throw new AppError('server', 'DonorLink is having trouble right now. Please try again in a moment.', {
        retryable: true,
      });
    }
    throw new AppError('bad_response', 'We got an unexpected response. Please try again.', { retryable: true });
  } catch (error) {
    throw toAppError(error);
  }
}
