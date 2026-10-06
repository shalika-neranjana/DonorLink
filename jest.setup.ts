// Shared mocks for component/screen tests. Domain and function tests ignore these.
require('react-native-gesture-handler/jestSetup');
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));
jest.mock('expo-network', () => ({ useNetworkState: () => ({ isConnected: true, isInternetReachable: true }) }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('expo-location', () => ({}));
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.0.0' } }));

// Appwrite: never touch the network or open sockets in unit tests.
jest.mock('@/lib/appwrite/client', () => ({
  __esModule: true,
  default: { setSession: jest.fn() },
  account: {},
  tablesDB: {},
  storage: {},
  functions: {},
  realtime: { subscribe: jest.fn().mockResolvedValue({ unsubscribe: jest.fn() }) },
}));
jest.mock('@/lib/appwrite/realtime', () => ({ subscribeToRows: jest.fn(() => () => undefined) }));

jest.mock('expo-router', () => {
  const React = require('react');
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), dismissAll: jest.fn() };
  const params: Record<string, string> = {};
  return {
    __router: router,
    __params: params,
    useRouter: () => router,
    useLocalSearchParams: () => params,
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(() => callback(), [callback]);
    },
    Link: ({ children }: { children: unknown }) => children,
    Stack: Object.assign(({ children }: { children: unknown }) => children, { Screen: () => null, Protected: ({ children }: { children: unknown }) => children }),
    Tabs: Object.assign(({ children }: { children: unknown }) => children, { Screen: () => null }),
    Redirect: () => null,
    ThemeProvider: ({ children }: { children: unknown }) => children,
    DefaultTheme: { colors: {} },
    DarkTheme: { colors: {} },
  };
});
