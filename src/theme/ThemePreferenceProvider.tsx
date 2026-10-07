import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import { colorScheme as cssColorScheme } from 'react-native-css';

/**
 * User-selectable appearance: follow the device, or force light or dark.
 *
 * One mechanism, three consumers:
 *  - the CSS variables in global.css (`prefers-color-scheme`), driven by the
 *    react-native-css colour-scheme observable;
 *  - the raw hex palette (`useThemeColors`) and navigation/status-bar theme,
 *    driven by `useResolvedColorScheme`;
 *  - the platform itself (`Appearance.setColorScheme`), so native dialogs,
 *    pickers and the keyboard match.
 *
 * The web build is a development preview whose CSS follows the browser's
 * media query, which a page cannot override, so there the app always follows
 * the system.
 */
export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedColorScheme = 'light' | 'dark';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];
export const THEME_STORAGE_KEY = 'donorlink.themePreference';

export function parseThemePreference(raw: unknown): ThemePreference {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

function readNativeScheme(): ResolvedColorScheme {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

/** Pushes the preference into the platform and the CSS-variable engine. */
export function applyThemePreference(preference: ThemePreference): ResolvedColorScheme {
  if (Platform.OS === 'web') return readNativeScheme();
  Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  const scheme = readNativeScheme();
  // React Native does not emit a change event for an app-initiated override,
  // so update the CSS variables directly (never with null: that matches no
  // `prefers-color-scheme` rule at all).
  cssColorScheme.set(scheme);
  return scheme;
}

interface ThemePreferenceContextValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  resolved: ResolvedColorScheme;
  /** False until the saved preference has been read, so the first paint is already correct. */
  ready: boolean;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [nativeScheme, setNativeScheme] = useState<ResolvedColorScheme>(readNativeScheme);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .catch(() => null)
      .then((raw) => {
        if (!active) return;
        const saved = parseThemePreference(raw);
        setPreferenceState(saved);
        setNativeScheme(applyThemePreference(saved));
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Real device changes (and the platform's confirmation of our override).
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setNativeScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => subscription.remove();
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    setNativeScheme(applyThemePreference(next));
    AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {
      // The choice still applies for this session; it just won't be remembered.
    });
  }, []);

  const resolved: ResolvedColorScheme = Platform.OS === 'web' || preference === 'system' ? nativeScheme : preference;
  const value = useMemo(() => ({ preference, setPreference, resolved, ready }), [preference, setPreference, resolved, ready]);
  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference(): ThemePreferenceContextValue {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) throw new Error('useThemePreference must be used inside <ThemePreferenceProvider>.');
  return ctx;
}

/** The scheme the UI is actually showing. Falls back to the system value outside the provider (tests). */
export function useResolvedColorScheme(): ResolvedColorScheme {
  const ctx = useContext(ThemePreferenceContext);
  const system = useColorScheme();
  return ctx ? ctx.resolved : system === 'dark' ? 'dark' : 'light';
}
