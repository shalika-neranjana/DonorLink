/** @jest-environment node */
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  APP_ROLES,
  AVAILABILITY_STATES,
  BLOOD_COMPONENTS,
  BLOOD_GROUPS,
  DONATION_STATUSES,
  MATCH_QUALITIES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_TYPES,
  ORGANIZATION_MEMBER_ROLES,
  ORGANIZATION_TYPES,
  REQUEST_STATUSES,
  RESPONSE_STATUSES,
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  URGENCY_LEVELS,
  VERIFICATION_DOCUMENT_TYPES,
  VERIFICATION_STATUSES,
  VERIFICATION_SUBJECTS,
} from '@/domain';
import { TABLES } from '@/lib/appwrite/config';
import { darkColors, lightColors } from '@/theme/tokens';

const root = path.resolve(__dirname, '..', '..');

function loadSchema() {
  const source = fs.readFileSync(path.join(root, 'appwrite', 'schema.mjs'), 'utf8').replace(/export const (\w+) =/g, 'const $1 = exports.$1 =');
  const exports: Record<string, any> = {};
  new Function('exports', source)(exports);
  return exports;
}

describe('Appwrite schema matches the app domain (no drift)', () => {
  const schema = loadSchema();

  it.each([
    ['BLOOD_GROUPS', BLOOD_GROUPS],
    ['REQUEST_STATUSES', REQUEST_STATUSES],
    ['URGENCY', URGENCY_LEVELS],
    ['VERIFICATION', VERIFICATION_STATUSES],
    ['AVAILABILITY', AVAILABILITY_STATES],
    ['RESPONSE_STATUSES', RESPONSE_STATUSES],
    ['DONATION_STATUSES', DONATION_STATUSES],
    ['MATCH_QUALITY', MATCH_QUALITIES],
    ['ORG_TYPES', ORGANIZATION_TYPES],
    ['ORG_ROLES', ORGANIZATION_MEMBER_ROLES],
    ['BLOOD_COMPONENTS', BLOOD_COMPONENTS],
    ['NOTIFICATION_CATEGORIES', NOTIFICATION_CATEGORIES],
    ['NOTIFICATION_TYPES', NOTIFICATION_TYPES],
    ['VERIFICATION_SUBJECTS', VERIFICATION_SUBJECTS],
    ['DOCUMENT_TYPES', VERIFICATION_DOCUMENT_TYPES],
    ['SUPPORT_CATEGORIES', SUPPORT_CATEGORIES],
    ['SUPPORT_STATUSES', SUPPORT_STATUSES],
  ])('%s enum is identical in schema.mjs and src/domain', (name, domainValues) => {
    expect([...schema[name]]).toEqual([...domainValues]);
  });

  it('uses the table IDs the client config expects', () => {
    const ids = schema.TABLES.map((t: { id: string }) => t.id).sort();
    expect(ids).toEqual(Object.values(TABLES).sort());
  });

  it('never gives a required column a default and always indexes real columns', () => {
    for (const table of schema.TABLES) {
      const keys = new Set(table.columns.map((c: { key: string }) => c.key));
      for (const column of table.columns) {
        if (column.required) expect(column.xdefault).toBeUndefined();
      }
      for (const index of table.indexes) {
        for (const column of index.columns) expect(keys.has(column)).toBe(true);
      }
    }
  });

  it('keeps every app role defined', () => {
    expect(APP_ROLES).toEqual(['user', 'organization', 'admin']);
  });
});

describe('client API calls map to real function actions', () => {
  const { actions } = require('../../appwrite/functions/api/src/handlers');

  it('every callApi action used in src/services exists in the function', () => {
    const dir = path.join(root, 'src', 'services');
    const used = new Set<string>();
    for (const file of fs.readdirSync(dir)) {
      const text = fs.readFileSync(path.join(dir, file), 'utf8');
      for (const match of text.matchAll(/callApi(?:<[^>]*(?:<[^>]*>[^>]*)*>)?\(\s*'([\w.]+)'/g)) used.add(match[1]);
    }
    expect(used.size).toBeGreaterThan(20);
    for (const action of used) expect(Object.keys(actions)).toContain(action);
  });
});

describe('design tokens', () => {
  const css = fs.readFileSync(path.join(root, 'src', 'global.css'), 'utf8');
  const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

  function parseBlock(block: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const m of block.matchAll(/--dl-([a-z-]+):\s*(#[0-9a-fA-F]{6});/g)) out[camel(m[1])] = m[2].toLowerCase();
    return out;
  }

  it('keeps light colours in global.css and tokens.ts identical', () => {
    const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: dark)'));
    expect(parseBlock(lightBlock)).toEqual(lightColors);
  });

  it('keeps dark colours in global.css and tokens.ts identical', () => {
    const darkBlock = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'), css.indexOf('@theme inline'));
    expect(parseBlock(darkBlock)).toEqual(darkColors);
  });

  function luminance(hex: string): number {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it.each([
    ['fg', 'background'],
    ['fg', 'surface'],
    ['fgSecondary', 'surface'],
    ['fgMuted', 'surface'],
    ['primaryForeground', 'primary'],
    ['emergencyForeground', 'emergency'],
    ['primary', 'primarySoft'],
    ['emergency', 'emergencySoft'],
    ['success', 'successSoft'],
    ['warning', 'warningSoft'],
    ['error', 'errorSoft'],
    ['info', 'infoSoft'],
  ] as const)('meets WCAG AA contrast (4.5:1) for %s on %s in light and dark', (fg, bg) => {
    expect(contrast(lightColors[fg], lightColors[bg])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkColors[fg], darkColors[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps white text on the success button readable (light) and dark text readable (dark)', () => {
    expect(contrast('#ffffff', lightColors.success)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkColors.primaryForeground, darkColors.success)).toBeGreaterThanOrEqual(4.5);
  });
});
