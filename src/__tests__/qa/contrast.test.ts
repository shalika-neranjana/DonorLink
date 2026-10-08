/**
 * QA audit (2026-10-09), Phase 17: WCAG 2.1 contrast for text/background pairs
 * the screens use that src/__tests__/consistency.test.ts does not already cover.
 * Body text needs 4.5:1. Disabled controls are exempt from WCAG 1.4.3 but are
 * still checked at 3:1 so a disabled label stays legible.
 */
import { darkColors, lightColors, type ColorToken } from '@/theme/tokens';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const TEXT_PAIRS: [ColorToken, ColorToken][] = [
  ['fgSecondary', 'background'],
  ['fgMuted', 'background'],
  ['fgMuted', 'subtle'],
  ['fgSecondary', 'subtle'],
  ['fgMuted', 'elevated'],
  ['error', 'surface'],
  ['error', 'background'],
  ['success', 'surface'],
  ['warning', 'surface'],
  ['emergency', 'surface'],
  ['primary', 'surface'],
  ['primary', 'background'],
  ['info', 'surface'],
  ['secondaryForeground', 'secondary'],
];

describe('TC-A11Y colour contrast', () => {
  it.each(TEXT_PAIRS)('TC-A11Y-001 %s text on %s is at least 4.5:1 in light and dark', (fg, bg) => {
    expect(contrast(lightColors[fg], lightColors[bg])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkColors[fg], darkColors[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it('TC-A11Y-002 disabled labels stay legible (3:1)', () => {
    expect(contrast(lightColors.disabledForeground, lightColors.disabled)).toBeGreaterThanOrEqual(3);
    expect(contrast(darkColors.disabledForeground, darkColors.disabled)).toBeGreaterThanOrEqual(3);
  });
});
