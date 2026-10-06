import { useColorScheme } from 'react-native';

import { palettes, type ColorPalette } from './tokens';

/** Raw hex palette for the current system colour scheme. */
export function useThemeColors(): ColorPalette {
  const scheme = useColorScheme();
  return scheme === 'dark' ? palettes.dark : palettes.light;
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}
