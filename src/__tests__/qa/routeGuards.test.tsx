/**
 * QA audit (2026-10-09), Phase 6: route protection with the REAL root and auth
 * layouts and the real Expo Router (not the global mock). Leaf screens are
 * stubs that print their route, so each test shows where a user actually lands.
 *
 * These guards are UX only. Real authorization is enforced by the Appwrite
 * Function and row permissions (see appwrite/functions/api/__tests__).
 */
import { Text } from 'react-native';

jest.unmock('expo-router');
jest.mock('@/global.css', () => ({}), { virtual: true });
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn().mockResolvedValue(true), hideAsync: jest.fn().mockResolvedValue(true) }));
jest.mock('@expo-google-fonts/inter', () => ({ useFonts: () => [true, null], Inter_400Regular: 1, Inter_500Medium: 1, Inter_600SemiBold: 1, Inter_700Bold: 1 }));
jest.mock('@/providers/AppProviders', () => ({ AppProviders: ({ children }: { children: unknown }) => children }));
jest.mock('@/theme/ThemePreferenceProvider', () => ({ useResolvedColorScheme: () => 'light', useThemePreference: () => ({ ready: true }) }));
jest.mock('@/theme/useThemeColors', () => ({ useThemeColors: () => ({ background: '#fff', surface: '#fff', fg: '#000', border: '#ccc', primary: '#c00' }) }));

type MockAuth = {
  status: 'loading' | 'signedOut' | 'signedIn' | 'error';
  needsOnboarding: boolean;
  emailVerified: boolean;
  emailPromptDismissed: boolean;
  isAdmin: boolean;
  isOrganizationMember: boolean;
  bootError: null;
  retryBoot: () => void;
};
const mockAuth: MockAuth = {
  status: 'signedOut',
  needsOnboarding: false,
  emailVerified: true,
  emailPromptDismissed: false,
  isAdmin: false,
  isOrganizationMember: false,
  bootError: null,
  retryBoot: jest.fn(),
};
jest.mock('@/providers/AuthProvider', () => ({ useAuth: () => mockAuth }));

/* eslint-disable import/first */
import { renderRouter, screen } from 'expo-router/testing-library';
import { Stack } from 'expo-router';

import RootLayout from '@/app/_layout';
import AuthLayout from '@/app/(auth)/_layout';

function leaf(name: string) {
  function Leaf() {
    return <Text>{`screen:${name}`}</Text>;
  }
  return Leaf;
}
const group = () => <Stack screenOptions={{ headerShown: false }} />;

const ROUTES = {
  _layout: RootLayout,
  '(auth)/_layout': AuthLayout,
  '(auth)/welcome': leaf('welcome'),
  '(auth)/login': leaf('login'),
  '(auth)/verify-email': leaf('verify-email'),
  '(onboarding)/_layout': group,
  '(onboarding)/personal-info': leaf('onboarding'),
  '(app)/_layout': group,
  '(app)/index': leaf('home'),
  '(app)/requests/create': leaf('create-request'),
  '(app)/donor/incoming/[id]': leaf('incoming'),
  '(organization)/_layout': group,
  '(organization)/org/dashboard': leaf('org-dashboard'),
  '(admin)/_layout': group,
  '(admin)/admin/dashboard': leaf('admin-dashboard'),
  '+not-found': leaf('not-found'),
};

function as(next: Partial<MockAuth>) {
  Object.assign(mockAuth, {
    status: 'signedIn',
    needsOnboarding: false,
    emailVerified: true,
    emailPromptDismissed: false,
    isAdmin: false,
    isOrganizationMember: false,
    ...next,
  });
}

function landOn(url: string): string {
  renderRouter(ROUTES, { initialUrl: url });
  const shown = screen.queryAllByText(/^screen:/);
  return shown.length ? String(shown[shown.length - 1].props.children) : 'nothing';
}

describe('TC-AUTH route guards: signed-out user', () => {
  beforeEach(() => as({ status: 'signedOut' }));

  it.each(['/', '/requests/create', '/donor/incoming/abc', '/org/dashboard', '/admin/dashboard'])(
    'TC-AUTH-010 %s never shows a private screen',
    (url) => {
      const where = landOn(url);
      expect(where).not.toMatch(/home|create-request|incoming|org-dashboard|admin-dashboard|onboarding/);
    },
  );

  it('TC-AUTH-011 lands on the welcome screen', () => {
    expect(landOn('/')).toBe('screen:welcome');
  });
});

describe('TC-AUTH route guards: signed-in users', () => {
  it('TC-AUTH-012 incomplete onboarding cannot open the app, org or admin areas', () => {
    as({ needsOnboarding: true, emailPromptDismissed: true, isAdmin: true, isOrganizationMember: true });
    for (const url of ['/', '/requests/create', '/org/dashboard', '/admin/dashboard']) {
      expect(landOn(url)).not.toMatch(/home|create-request|org-dashboard|admin-dashboard/);
    }
  });

  it('TC-AUTH-013 an unverified new user is sent to email verification', () => {
    as({ needsOnboarding: true, emailVerified: false });
    expect(landOn('/login')).toBe('screen:verify-email');
  });

  it('TC-AUTH-014 a regular user reaches the app but not org or admin screens', () => {
    as({});
    expect(landOn('/requests/create')).toBe('screen:create-request');
    expect(landOn('/org/dashboard')).not.toBe('screen:org-dashboard');
    expect(landOn('/admin/dashboard')).not.toBe('screen:admin-dashboard');
  });

  it('TC-AUTH-015 an organization member reaches org screens but not admin', () => {
    as({ isOrganizationMember: true });
    expect(landOn('/org/dashboard')).toBe('screen:org-dashboard');
    expect(landOn('/admin/dashboard')).not.toBe('screen:admin-dashboard');
  });

  it('TC-AUTH-016 an admin reaches the admin console', () => {
    as({ isAdmin: true });
    expect(landOn('/admin/dashboard')).toBe('screen:admin-dashboard');
  });

  it('TC-AUTH-017 a signed-in user never sees the auth screens', () => {
    as({});
    expect(landOn('/login')).not.toBe('screen:login');
  });
});
