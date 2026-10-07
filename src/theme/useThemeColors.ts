import { palettes, type ColorPalette } from './tokens';
import { useResolvedColorScheme } from './ThemePreferenceProvider';

/** Raw hex palette for the scheme the app is currently showing (user preference, else the system's). */
export function useThemeColors(): ColorPalette {
  return useResolvedColorScheme() === 'dark' ? palettes.dark : palettes.light;
}

export function useIsDark(): boolean {
  return useResolvedColorScheme() === 'dark';
}
