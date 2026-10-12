import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';

/**
 * Cross-account functional walkthrough that mirrors usability tasks T1-T6
 * (Expo WEB preview, live backend). It is a FUNCTIONAL check, not a usability
 * session: it knows the screens and the right buttons, so it cannot say anything
 * about how easy the flow is for a person.
 *
 * STATUS: written against the app's source (labels, accessibility names) but NOT
 * executed by the author of this package, because it signs in to a live
 * Appwrite Cloud project with QA accounts and that credential entry must be done
 * by the project owner. Expect to tune selectors on the first real run.
 *
 * Credentials are read from the environment ONLY (never commit them):
 *   QA_REQUESTER_EMAIL / QA_REQUESTER_PASSWORD
 *   QA_DONOR_EMAIL     / QA_DONOR_PASSWORD
 *   QA_REVIEWER_EMAIL  / QA_REVIEWER_PASSWORD
 * Optional: QA_KEEP_REQUEST=1 leaves the synthetic request in place (default is to
 * cancel it through the UI at the end; nothing is ever deleted).
 *
 * Preconditions (see ../../test-data/synthetic-data.md): donor profile is O+-
 * compatible (blood group O+ or O-), within radius of the request's district, alerts
 * on, onboarding complete; reviewer account can verify requests.
 */
const creds = (role: 'REQUESTER' | 'DONOR' | 'REVIEWER') => ({
  email: process.env[`QA_${role}_EMAIL`],
  password: process.env[`QA_${role}_PASSWORD`],
});
const have = (['REQUESTER', 'DONOR', 'REVIEWER'] as const).every((r) => creds(r).email && creds(r).password);

const SHOTS = path.resolve(__dirname, '../../screenshots/automated-tests');
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });

const TEST_HOSPITAL = 'ZZ USABILITY TEST HOSPITAL';
const TEST_NOTE = 'USABILITY TEST - synthetic request, please ignore.';

async function signIn(page: Page, who: 'REQUESTER' | 'DONOR' | 'REVIEWER') {
  const { email, password } = creds(who);
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(email!);
  await page.locator('input[type="password"]').fill(password!);
  await page.getByText('Sign in', { exact: true }).last().click();
  // Home is reached when the emergency card is visible (T1 success state).
  await expect(page.getByText('Need blood urgently?')).toBeVisible({ timeout: 45_000 });
}

async function newSession(browser: Browser, who: 'REQUESTER' | 'DONOR' | 'REVIEWER') {
  const context: BrowserContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await signIn(page, who);
  return { context, page };
}

test.describe.configure({ mode: 'serial' });
test.skip(!have, 'QA_* credentials not set: cross-account E2E skipped (see file header).');

test.describe('TC-E2E-U: requester -> reviewer -> donor (maps to T1-T6)', () => {
  let requester: Awaited<ReturnType<typeof newSession>>;
  let donor: Awaited<ReturnType<typeof newSession>>;
  let reviewer: Awaited<ReturnType<typeof newSession>>;
  let requestId = '';

  test.beforeAll(async ({ browser }) => {
    requester = await newSession(browser, 'REQUESTER');
    donor = await newSession(browser, 'DONOR');
    reviewer = await newSession(browser, 'REVIEWER');
  });

  test.afterAll(async () => {
    // Clean up only the record this run created, via the same UI a user has.
    if (requestId && !process.env.QA_KEEP_REQUEST && requester) {
      try {
        await requester.page.goto(`/requests/${requestId}`);
        await requester.page.getByText('Cancel this request').click({ timeout: 10_000 });
        await requester.page.getByText('Yes, cancel request').click();
      } catch {
        console.warn(`Could not cancel synthetic request ${requestId}; cancel it manually.`);
      }
    }
    await Promise.all([requester?.context.close(), donor?.context.close(), reviewer?.context.close()]);
  });

  test('TC-E2E-U01 [T1] requester signs in and reaches Home', async () => {
    await expect(requester.page.getByText('Need blood urgently?')).toBeVisible();
    await shot(requester.page, 'T1_home-after-sign-in');
  });

  test('TC-E2E-U02 [T2] requester creates a 2-unit O+ request for a Colombo hospital', async () => {
    const p = requester.page;
    await p.getByText('Request blood', { exact: true }).first().click();
    await expect(p.getByText('Takes about a minute')).toBeVisible();

    await p.getByRole('radio', { name: 'Blood group O positive' }).click();

    // Set units to exactly 2 using the stepper's own controls.
    const stepper = p.locator('[aria-label="Units required"]').first();
    for (let i = 0; i < 25; i++) {
      const now = Number(await stepper.getAttribute('aria-valuenow'));
      if (now === 2) break;
      await p.getByRole('button', { name: now < 2 ? 'Increase Units required' : 'Decrease Units required' }).click();
    }
    await expect(stepper).toHaveAttribute('aria-valuenow', '2');

    await p.getByRole('radio', { name: /^Critical\./ }).click();

    await p.getByRole('button', { name: /^Hospital:/ }).click();
    await p.getByText('Other hospital (not listed)').click();
    await p.getByLabel('Hospital name').fill(TEST_HOSPITAL);
    await p.getByRole('button', { name: /^District:/ }).click();
    await p.getByText('Colombo', { exact: true }).first().click();

    await p.getByText("Add ward, notes or who it's for").click();
    await p.getByText('Family member', { exact: true }).click();
    await p.getByLabel('Notes for donors').fill(TEST_NOTE);
    await shot(p, 'T2_request-form-filled');

    await p.getByText('Review request', { exact: true }).last().click();
    await expect(p.getByText('Check the details before sending')).toBeVisible();
    await shot(p, 'T2_request-review');
    await p.getByText('Submit request', { exact: true }).click();

    await p.waitForURL(/\/requests\/matching\?id=/, { timeout: 30_000 });
    requestId = new URL(p.url()).searchParams.get('id') ?? '';
    expect(requestId).not.toBe('');
    await expect(p.getByText('Request submitted').first()).toBeVisible();
    await expect(p.getByText('Awaiting verification').first()).toBeVisible();
    await shot(p, 'T2_request-submitted');
  });

  test('TC-E2E-U03 [T3] requester sees "Awaiting verification" and 0 of 2 accepted', async () => {
    const p = requester.page;
    await p.goto(`/requests/${requestId}`);
    await expect(p.getByText('Awaiting verification').first()).toBeVisible();
    await expect(p.getByText(/0 of 2 donors accepted/).first()).toBeVisible();
    await shot(p, 'T3_request-status-pending');
  });

  test('TC-E2E-U04 reviewer verifies the request through the existing UI', async () => {
    const p = reviewer.page;
    await p.goto(`/requests/${requestId}`);
    await expect(p.getByText('This request is waiting for verification')).toBeVisible({ timeout: 30_000 });
    await shot(p, 'TC-E2E-U04_reviewer-before-verify');
    await p.getByText('Verify', { exact: true }).click();
    await expect(p.getByText('Request verified')).toBeVisible();
    await shot(p, 'TC-E2E-U04_reviewer-verified');
  });

  test('TC-E2E-U05 [T4] donor sets availability (quick option; web has no time picker)', async () => {
    const p = donor.page;
    await p.goto('/donor/availability');
    await expect(p.getByText('Donor availability').first()).toBeVisible();
    const toggle = p.getByRole('switch', { name: 'Available to donate' });
    if ((await toggle.getAttribute('aria-checked')) !== 'true') await toggle.click();
    // LIMITATION: DonorLinkDateTimeField hides "Pick date & time" on web, so "until 6 pm"
    // cannot be set here. T4 with an exact time requires the native Android build.
    await p.getByText('8 hours', { exact: true }).click();
    await shot(p, 'T4_availability-before-save');
    await p.getByText('Save availability', { exact: true }).click();
    await expect(p.getByText('Availability saved')).toBeVisible();
    await shot(p, 'T4_availability-saved');
  });

  test('TC-E2E-U06 [T5] donor finds the alert and accepts', async () => {
    const p = donor.page;
    await p.goto('/');
    // Matching/notification fan-out is asynchronous: allow time and reload once.
    try {
      await expect(p.getByText('Asking for your help')).toBeVisible({ timeout: 30_000 });
    } catch {
      await p.reload();
      await expect(p.getByText('Asking for your help')).toBeVisible({ timeout: 30_000 });
    }
    await shot(p, 'T5_donor-home-invitation');
    await p.goto(`/donor/incoming/${requestId}`);
    await expect(p.getByText('Emergency request').first()).toBeVisible();
    await shot(p, 'T5_incoming-request');
    await p.getByRole('button', { name: 'Accept this request and donate' }).click();
    await shot(p, 'T5_accept-confirmation');
    await p.getByText("Yes, I'll donate").click();
    await expect(p.getByText("You've accepted this request")).toBeVisible();
    await shot(p, 'T5_request-accepted');
  });

  test('TC-E2E-U07 requester sees the response count update (1 of 2 accepted)', async () => {
    const p = requester.page;
    await p.goto(`/requests/${requestId}`);
    await expect(p.getByText(/1 of 2 donors accepted/).first()).toBeVisible({ timeout: 30_000 });
    await shot(p, 'TC-E2E-U07_requester-sees-acceptance');
  });

  test('TC-E2E-U08 [T6] donor opens History (Requests and Donations)', async () => {
    const p = donor.page;
    await p.goto('/history');
    await expect(p.getByText('History', { exact: true }).first()).toBeVisible();
    await shot(p, 'T6_history-requests');
    await p.getByText('Donations', { exact: true }).click();
    await shot(p, 'T6_history-donations');
  });
});
