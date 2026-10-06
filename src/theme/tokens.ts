/**
 * Raw colour tokens for the places that cannot use Tailwind class names
 * (vector icons, ActivityIndicator, StatusBar, Reanimated interpolations).
 *
 * The source of truth for class-based styling is src/global.css; the two must
 * match (see src/theme/__tests__/tokens.test.ts).
 */
export const lightColors = {
  background: '#f5f7fa',
  surface: '#ffffff',
  elevated: '#ffffff',
  subtle: '#eef2f6',
  fg: '#0f172a',
  fgSecondary: '#475569',
  fgMuted: '#64748b',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  primary: '#1d5fd1',
  primaryPressed: '#164cab',
  primarySoft: '#e7effc',
  primaryForeground: '#ffffff',
  secondary: '#e8edf3',
  secondaryForeground: '#1e293b',
  emergency: '#d3142d',
  emergencySoft: '#fdecef',
  emergencyForeground: '#ffffff',
  success: '#0b7a4b',
  successSoft: '#e3f6ec',
  warning: '#a15c07',
  warningSoft: '#fef3d9',
  error: '#b42318',
  errorSoft: '#fdeceb',
  info: '#0b6bcb',
  infoSoft: '#e5f0fb',
  disabled: '#cbd5e1',
  disabledForeground: '#64748b',
  overlay: '#0f172a',
} as const;

export type ColorToken = keyof typeof lightColors;
export type ColorPalette = Record<ColorToken, string>;

export const darkColors: ColorPalette = {
  background: '#0b1220',
  surface: '#111a2b',
  elevated: '#17233a',
  subtle: '#1b2940',
  fg: '#f1f5f9',
  fgSecondary: '#b6c2d4',
  fgMuted: '#8fa0b8',
  border: '#24344f',
  borderStrong: '#34476a',
  primary: '#5b9bff',
  primaryPressed: '#7fb0ff',
  primarySoft: '#14284b',
  primaryForeground: '#08142b',
  secondary: '#1f2e47',
  secondaryForeground: '#e2e8f0',
  emergency: '#ff5468',
  emergencySoft: '#3a1119',
  emergencyForeground: '#2a0509',
  success: '#3dd598',
  successSoft: '#0f2d22',
  warning: '#f5b544',
  warningSoft: '#3a2a0b',
  error: '#ff7b72',
  errorSoft: '#3b1512',
  info: '#6cb2ff',
  infoSoft: '#12284a',
  disabled: '#33425c',
  disabledForeground: '#8fa0b8',
  overlay: '#000000',
};

export const palettes: Record<'light' | 'dark', ColorPalette> = {
  light: lightColors,
  dark: darkColors,
};

/** Spacing scale in px; mirrors Tailwind's 4px base so `p-4` === spacing.md. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 22,
  full: 9999,
} as const;

/** Minimum interactive target, per Material / WCAG 2.5.5 guidance. */
export const MIN_TOUCH_TARGET = 48;

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;
