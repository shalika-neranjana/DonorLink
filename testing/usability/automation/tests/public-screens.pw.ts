import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

/**
 * Credential-free functional checks of the signed-out screens (Expo WEB preview).
 * Nothing here signs in, registers, or submits data to the backend. Network
 * requests that would create a session are asserted NOT to happen.
 *
 * Context for the usability tasks: these screens are what a participant sees
 * before T1 ("Sign in with the test account you were given").
 */
const SHOTS = path.resolve(__dirname, '../../screenshots/automated-tests');
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });

/** Appwrite calls that create a session or user: must never fire in these tests. */
const isAuthWrite = (url: string, method: string) =>
  method === 'POST' && /\/account(\/sessions|$|\/verifications|\/recovery)/.test(url);

test.describe('signed-out screens (no credentials)', () => {
  let authWrites: string[];
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    authWrites = [];
    consoleErrors = [];
    page.on('request', (r) => {
      if (isAuthWrite(r.url(), r.method())) authWrites.push(`${r.method()} ${r.url()}`);
    });
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
  });

  test('TC-PUB-01 Welcome screen renders for a signed-out visitor', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByText('Find compatible blood donors, fast.')).toBeVisible();
    await expect(page.getByText('Create account', { exact: true })).toBeVisible();
    await expect(page.getByText('I already have an account')).toBeVisible();
    await shot(page, 'TC-PUB-01_welcome');
  });

  test('TC-PUB-02 Login screen is reachable from Welcome and shows both fields', async ({ page }) => {
    await page.goto('/welcome');
    await page.getByText('I already have an account').click();
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByText('Sign in to continue')).toBeVisible();
    await expect(page.getByText('Email', { exact: true })).toBeVisible();
    await expect(page.getByText('Password', { exact: true })).toBeVisible();
    await expect(page.getByText('Sign in', { exact: true }).last()).toBeVisible();
    await shot(page, 'T1_sign-in-screen');
  });

  test('TC-PUB-03 Empty login is blocked client-side with field errors and no network write', async ({ page }) => {
    await page.goto('/login');
    await page.getByText('Sign in', { exact: true }).last().click();
    await expect(page.getByText('Password is required.')).toBeVisible();
    await shot(page, 'TC-PUB-03_login-empty-validation');
    expect(authWrites, 'no session/user request may be sent for an empty form').toEqual([]);
  });

  test('TC-PUB-04 Malformed email is rejected before any request is sent', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('not-an-email');
    await page.locator('input[type="password"]').fill('x');
    await page.getByText('Sign in', { exact: true }).last().click();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await shot(page, 'TC-PUB-04_login-bad-email');
    expect(authWrites).toEqual([]);
    // Do not leave a throwaway value in the field.
    await page.getByPlaceholder('you@example.com').fill('');
  });

  test('TC-PUB-05 Register screen is reachable from Login', async ({ page }) => {
    await page.goto('/login');
    await page.getByText('Create an account').click();
    await expect(page.getByText('Create your account')).toBeVisible();
    await shot(page, 'TC-PUB-05_register-screen');
    expect(authWrites).toEqual([]);
  });

  test('TC-PUB-06 Forgot-password screen is reachable from Login', async ({ page }) => {
    await page.goto('/login');
    await page.getByText('Forgot password?').click();
    await expect(page.getByText('Send reset code')).toBeVisible();
    await shot(page, 'TC-PUB-06_forgot-password');
    expect(authWrites).toEqual([]);
  });

  for (const route of ['/requests/create', '/donor/availability', '/history', '/notifications']) {
    test(`TC-PUB-07 Signed-out deep link ${route} does not expose app content`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(/\/(welcome|login)$/, { timeout: 30_000 });
      await expect(page.getByText('Review request')).toHaveCount(0);
      await expect(page.getByText('Save availability')).toHaveCount(0);
      await shot(page, `TC-PUB-07_guard${route.replace(/\//g, '_')}`);
    });
  }

  test.afterEach(async ({}, testInfo) => {
    // Surface (do not fail on) browser console errors; Appwrite 401s for "no session" are expected.
    if (consoleErrors.length) {
      testInfo.annotations.push({ type: 'console-errors', description: consoleErrors.slice(0, 5).join(' | ') });
    }
  });
});
