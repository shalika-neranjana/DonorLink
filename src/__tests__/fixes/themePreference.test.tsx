import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Appearance, Text } from 'react-native';

import {
  THEME_STORAGE_KEY,
  ThemePreferenceProvider,
  applyThemePreference,
  parseThemePreference,
  useResolvedColorScheme,
  useThemePreference,
  type ThemePreference,
} from '@/theme/ThemePreferenceProvider';
import { useThemeColors } from '@/theme/useThemeColors';
import { palettes } from '@/theme/tokens';

let system: 'light' | 'dark' = 'light';
let setSchemeSpy: jest.SpyInstance;
let latest: ReturnType<typeof useThemePreference>;

function Probe() {
  const ctx = useThemePreference();
  const scheme = useResolvedColorScheme();
  const colors = useThemeColors();
  useEffect(() => {
    latest = ctx;
  });
  return (
    <Text testID="probe">
      {ctx.preference}|{scheme}|{colors.background}|{String(ctx.ready)}
    </Text>
  );
}

const probeText = () => screen.getByTestId('probe').props.children.join('');

beforeEach(async () => {
  system = 'light';
  await AsyncStorage.clear();
  setSchemeSpy = jest.spyOn(Appearance, 'setColorScheme').mockImplementation((scheme) => {
    // Like the platform: 'unspecified' goes back to the device setting.
    if (scheme === 'dark' || scheme === 'light') system = scheme;
    else system = 'light';
  });
  jest.spyOn(Appearance, 'getColorScheme').mockImplementation(() => system);
});

afterEach(() => jest.restoreAllMocks());

describe('theme preference (Bug 6)', () => {
  it('parses anything unknown as System', () => {
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('system')).toBe('system');
    expect(parseThemePreference(null)).toBe('system');
    expect(parseThemePreference('sepia')).toBe('system');
  });

  it('applies Light and Dark to the platform and System as "unspecified"', () => {
    applyThemePreference('dark');
    expect(setSchemeSpy).toHaveBeenLastCalledWith('dark');
    applyThemePreference('light');
    expect(setSchemeSpy).toHaveBeenLastCalledWith('light');
    applyThemePreference('system');
    expect(setSchemeSpy).toHaveBeenLastCalledWith('unspecified');
  });

  it('starts as System and becomes ready once the saved value is read', async () => {
    render(
      <ThemePreferenceProvider>
        <Probe />
      </ThemePreferenceProvider>,
    );
    await waitFor(() => expect(probeText()).toContain('|true'));
    expect(probeText()).toBe(`system|light|${palettes.light.background}|true`);
  });

  it('switches immediately, drives the hex palette, and persists the choice', async () => {
    render(
      <ThemePreferenceProvider>
        <Probe />
      </ThemePreferenceProvider>,
    );
    await waitFor(() => expect(latest.ready).toBe(true));

    await act(async () => latest.setPreference('dark'));
    expect(probeText()).toBe(`dark|dark|${palettes.dark.background}|true`);
    expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await act(async () => latest.setPreference('light'));
    expect(probeText()).toBe(`light|light|${palettes.light.background}|true`);
    expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('forces the chosen theme even when the device is on the other one', async () => {
    system = 'dark'; // device is dark
    render(
      <ThemePreferenceProvider>
        <Probe />
      </ThemePreferenceProvider>,
    );
    await waitFor(() => expect(latest.ready).toBe(true));
    await act(async () => latest.setPreference('light'));
    expect(probeText()).toContain('light|light');
  });

  it('restores the saved choice after a restart', async () => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(
      <ThemePreferenceProvider>
        <Probe />
      </ThemePreferenceProvider>,
    );
    await waitFor(() => expect(latest.ready).toBe(true));
    expect(probeText()).toBe(`dark|dark|${palettes.dark.background}|true`);
    expect(setSchemeSpy).toHaveBeenCalledWith('dark');
  });

  it('follows real device changes only while set to System', async () => {
    let listener: ((value: { colorScheme: 'light' | 'dark' }) => void) | undefined;
    jest.spyOn(Appearance, 'addChangeListener').mockImplementation((cb) => {
      listener = cb as never;
      return { remove: jest.fn() } as never;
    });
    render(
      <ThemePreferenceProvider>
        <Probe />
      </ThemePreferenceProvider>,
    );
    await waitFor(() => expect(latest.ready).toBe(true));

    act(() => listener?.({ colorScheme: 'dark' }));
    expect(probeText()).toContain('system|dark'); // System follows the device

    await act(async () => latest.setPreference('light'));
    act(() => listener?.({ colorScheme: 'dark' }));
    expect(probeText()).toContain('light|light'); // Light ignores it
  });

  it('only accepts the three documented values', () => {
    const values: ThemePreference[] = ['system', 'light', 'dark'];
    expect(values.map(parseThemePreference)).toEqual(values);
  });
});
