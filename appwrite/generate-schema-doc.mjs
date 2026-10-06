/**
 * Generates DATABASE_SCHEMA.md from appwrite/schema.mjs so the documentation
 * can never drift from what `npm run appwrite:provision` actually creates.
 *
 * Usage: npm run docs:schema
 */
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUCKETS, DATABASE_ID, DATABASE_NAME, DIRECTORY_HOSPITALS, FUNCTION, TABLES } from './schema.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const typeLabel = (c) => {
  if (c.type === 'string') return `string(${c.size})${c.array ? '[]' : ''}`;
  if (c.type === 'enum') return `enum: ${c.elements.join(' \\| ')}`;
  if (c.type === 'integer' || c.type === 'float') {
    const range = c.min !== undefined || c.max !== undefined ? ` (${c.min ?? ''}..${c.max ?? ''})` : '';
    return `${c.type}${range}`;
  }
  return c.type;
};

const lines = [];
lines.push('# DonorLink database schema');
lines.push('');
lines.push('> Generated from [`appwrite/schema.mjs`](appwrite/schema.mjs) by `npm run docs:schema`. Do not edit by hand.');
lines.push('');
lines.push(`Database: **${DATABASE_NAME}** (ID \`${DATABASE_ID}\`). All tables have **row security enabled**.`);
lines.push('');
lines.push('## How access works');
lines.push('');
lines.push('- Clients **read** rows through Appwrite row-level permissions (owner, requester, contacted donors, organization members via `orgm<id>` labels, admins via the `admin` label).');
lines.push('- Almost all **writes** go through the `donorlink-api` Appwrite Function, which authenticates the caller, validates input again and enforces the status-transition rules. Tables therefore grant no client create/update/delete permission, except `notifications` (owner may mark read / delete).');
lines.push('- Roles are Appwrite **user labels**: `admin`, `organization`, and `orgm<organizationId>`. Labels can only be changed server-side.');
lines.push('');
lines.push('## Tables');
lines.push('');
for (const t of TABLES) {
  lines.push(`### \`${t.id}\``);
  lines.push('');
  lines.push(t.description);
  lines.push('');
  if (t.permissions.length) lines.push(`Table permissions: ${t.permissions.map((p) => `\`${p}\``).join(', ')}`);
  else lines.push('Table permissions: none (row-level only)');
  lines.push('');
  lines.push('| Column | Type | Required | Default |');
  lines.push('| --- | --- | --- | --- |');
  for (const c of t.columns) {
    lines.push(`| \`${c.key}\` | ${typeLabel(c)} | ${c.required ? 'yes' : 'no'} | ${c.xdefault !== undefined ? `\`${c.xdefault}\`` : ''} |`);
  }
  lines.push('');
  if (t.indexes.length) {
    lines.push('Indexes: ' + t.indexes.map((i) => `\`${i.key}\` (${i.type}: ${i.columns.join(', ')})`).join('; '));
    lines.push('');
  }
}
lines.push('## Storage buckets');
lines.push('');
lines.push('| Bucket | Purpose | Max size | Extensions | Notes |');
lines.push('| --- | --- | --- | --- | --- |');
for (const b of BUCKETS) {
  lines.push(`| \`${b.id}\` | ${b.name} | ${b.maximumFileSize / (1024 * 1024)} MB | ${b.allowedFileExtensions.join(', ')} | file security on; users may create, each file readable only by its owner and admins${b.encryption ? '; encrypted' : ''} |`);
}
lines.push('');
lines.push('## Function');
lines.push('');
lines.push(`\`${FUNCTION.id}\` (${FUNCTION.runtime}, entrypoint \`${FUNCTION.entrypoint}\`). Execute permission: signed-in users. Schedule \`${FUNCTION.schedule}\` runs maintenance (expires stale requests). Scopes: ${FUNCTION.scopes.map((s) => `\`${s}\``).join(', ')}.`);
lines.push('');
lines.push('## Seed data');
lines.push('');
lines.push('`system_settings/global` plus a directory of real public hospitals, seeded as **unclaimed, unverified listings** (DonorLink makes no claim that they participate until an authorized member registers and an administrator verifies them). Coordinates are approximate.');
lines.push('');
lines.push(DIRECTORY_HOSPITALS.map((h) => `- ${h.name} (${h.district})`).join('\n'));
lines.push('');

writeFileSync(join(root, 'DATABASE_SCHEMA.md'), lines.join('\n'));
console.log('Wrote DATABASE_SCHEMA.md');
