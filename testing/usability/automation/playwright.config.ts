import { defineConfig } from '@playwright/test';

/**
 * Automated FUNCTIONAL checks of the Expo WEB preview. These are NOT usability
 * sessions and do NOT prove native Android behaviour (see ../test-plan.md §8).
 *
 * Start the app yourself first (`npx expo start --web --port 8081` in the repo
 * root), or let `webServer` below start it. Override the URL with BASE_URL.
 */
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8081';
// Optional: reuse an already-installed Chromium instead of downloading the build
// this Playwright version expects (set PW_CHROMIUM_PATH to chrome.exe / chrome).
const CHROMIUM_PATH = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: './tests',
  // *.pw.ts (not *.spec.ts) so the app's Jest run never picks these files up.
  testMatch: '**/*.pw.ts',
  outputDir: './test-output',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: '../results/automated/04-playwright-report.json' }]],
  use: {
    baseURL: BASE_URL,
    // Same viewport as the PDF's live run (Table 11): 390 x 844.
    viewport: { width: 390, height: 844 },
    screenshot: 'only-on-failure',
    trace: 'off',
    actionTimeout: 10_000,
    navigationTimeout: 45_000,
    launchOptions: CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'npx expo start --web --port 8081',
    cwd: '../../..',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
