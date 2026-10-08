/**
 * Provisions the DonorLink backend in your Appwrite project:
 *   database, tables (columns + indexes), storage buckets, seed data and the
 *   `donorlink-api` Function. It is idempotent: re-running only adds what is
 *   missing, and never deletes anything.
 *
 * Requirements
 *   - A server API key created in the Appwrite Console (see docs/setup-appwrite.md)
 *     stored in `.env.provision.local` (git-ignored) as APPWRITE_API_KEY=...
 *   - `.env` containing EXPO_PUBLIC_APPWRITE_ENDPOINT / EXPO_PUBLIC_APPWRITE_PROJECT_ID
 *
 * Usage: npm run appwrite:provision
 *
 * The API key is only used by this script on your machine. It is never bundled
 * into the app and never uploaded to the Function.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Functions, ID, Storage, TablesDB } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';

import {
  BUCKETS,
  DATABASE_ID,
  DATABASE_NAME,
  DIRECTORY_HOSPITALS,
  FUNCTION,
  TABLES,
} from './schema.mjs';
import { packageFunction } from './package-function.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(name) {
  const path = join(root, name);
  if (!existsSync(path)) return {};
  const values = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return values;
}

const env = { ...loadEnvFile('.env'), ...loadEnvFile('.env.provision.local'), ...process.env };
const endpoint = env.APPWRITE_ENDPOINT || env.EXPO_PUBLIC_APPWRITE_ENDPOINT;
const projectId = env.APPWRITE_PROJECT_ID || env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = env.APPWRITE_API_KEY;

if (!endpoint || !projectId || !apiKey) {
  console.error(
    [
      'Missing configuration.',
      '  endpoint :',
      endpoint ? '    ok' : '    EXPO_PUBLIC_APPWRITE_ENDPOINT is not set in .env',
      '  project  :',
      projectId ? '    ok' : '    EXPO_PUBLIC_APPWRITE_PROJECT_ID is not set in .env',
      '  api key  :',
      apiKey ? '    ok' : '    APPWRITE_API_KEY is not set (create .env.provision.local, see docs/setup-appwrite.md)',
    ].join('\n'),
  );
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const tablesDB = new TablesDB(client);
const storage = new Storage(client);
const functions = new Functions(client);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isNotFound = (error) => error?.code === 404;
const isConflict = (error) => error?.code === 409;

async function ensure(label, run) {
  try {
    await run();
    console.log(`  + ${label}`);
    return true;
  } catch (error) {
    if (isConflict(error)) {
      console.log(`  = ${label} (exists)`);
      return false;
    }
    console.error(`  ! ${label} failed: ${error?.message ?? error}`);
    throw error;
  }
}

async function ensureDatabase() {
  console.log('\nDatabase');
  try {
    await tablesDB.get({ databaseId: DATABASE_ID });
    console.log(`  = ${DATABASE_ID} (exists)`);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    await tablesDB.create({ databaseId: DATABASE_ID, name: DATABASE_NAME });
    console.log(`  + ${DATABASE_ID}`);
  }
}

function columnParams(table, column) {
  const base = { databaseId: DATABASE_ID, tableId: table.id, key: column.key, required: !!column.required };
  const canDefault = !column.required && !column.array && column.xdefault !== undefined;
  const withDefault = canDefault ? { xdefault: column.xdefault } : {};
  const array = column.array ? { array: true } : {};
  switch (column.type) {
    case 'string':
      return ['createStringColumn', { ...base, size: column.size, ...withDefault, ...array }];
    case 'integer':
      return [
        'createIntegerColumn',
        { ...base, min: column.min, max: column.max, ...withDefault, ...array },
      ];
    case 'float':
      return ['createFloatColumn', { ...base, min: column.min, max: column.max, ...withDefault, ...array }];
    case 'boolean':
      return ['createBooleanColumn', { ...base, ...withDefault, ...array }];
    case 'datetime':
      return ['createDatetimeColumn', { ...base, ...withDefault, ...array }];
    case 'enum':
      return ['createEnumColumn', { ...base, elements: column.elements, ...withDefault, ...array }];
    default:
      throw new Error(`Unsupported column type ${column.type}`);
  }
}

async function waitForColumns(table) {
  for (let attempt = 0; attempt < 90; attempt++) {
    const { columns } = await tablesDB.listColumns({ databaseId: DATABASE_ID, tableId: table.id });
    const pending = columns.filter((c) => c.status !== 'available');
    if (pending.length === 0) return;
    if (pending.some((c) => c.status === 'failed')) {
      throw new Error(`Column(s) failed on ${table.id}: ${pending.map((c) => c.key).join(', ')}`);
    }
    await sleep(1500);
  }
  throw new Error(`Timed out waiting for columns on ${table.id}`);
}

async function ensureTable(table) {
  console.log(`\nTable ${table.id}`);
  try {
    await tablesDB.getTable({ databaseId: DATABASE_ID, tableId: table.id });
    console.log('  = table (exists)');
  } catch (error) {
    if (!isNotFound(error)) throw error;
    await tablesDB.createTable({
      databaseId: DATABASE_ID,
      tableId: table.id,
      name: table.name,
      permissions: table.permissions,
      rowSecurity: true,
    });
    console.log('  + table');
  }

  const existing = await tablesDB.listColumns({ databaseId: DATABASE_ID, tableId: table.id });
  const have = new Set(existing.columns.map((c) => c.key));
  for (const column of table.columns) {
    if (have.has(column.key)) continue;
    const [method, params] = columnParams(table, column);
    await ensure(`column ${column.key}`, () => tablesDB[method](params));
  }
  await waitForColumns(table);

  const existingIndexes = await tablesDB.listIndexes({ databaseId: DATABASE_ID, tableId: table.id });
  const haveIndexes = new Set(existingIndexes.indexes.map((i) => i.key));
  for (const index of table.indexes) {
    if (haveIndexes.has(index.key)) continue;
    await ensure(`index ${index.key}`, () =>
      tablesDB.createIndex({
        databaseId: DATABASE_ID,
        tableId: table.id,
        key: index.key,
        type: index.type,
        columns: index.columns,
      }),
    );
  }
  // Indexes are built asynchronously; wait so later seeding / queries are safe.
  for (let attempt = 0; attempt < 60; attempt++) {
    const { indexes } = await tablesDB.listIndexes({ databaseId: DATABASE_ID, tableId: table.id });
    if (indexes.every((i) => i.status === 'available')) break;
    if (indexes.some((i) => i.status === 'failed')) throw new Error(`Index failed on ${table.id}`);
    await sleep(1500);
  }
}

async function ensureBuckets() {
  console.log('\nStorage buckets');
  for (const bucket of BUCKETS) {
    try {
      await storage.getBucket({ bucketId: bucket.id });
      console.log(`  = ${bucket.id} (exists)`);
    } catch (error) {
      if (!isNotFound(error)) throw error;
      await storage.createBucket({
        bucketId: bucket.id,
        name: bucket.name,
        permissions: bucket.permissions,
        fileSecurity: bucket.fileSecurity,
        maximumFileSize: bucket.maximumFileSize,
        allowedFileExtensions: bucket.allowedFileExtensions,
        encryption: bucket.encryption ?? true,
      });
      console.log(`  + ${bucket.id}`);
    }
  }
}

async function seed() {
  console.log('\nSeed data');
  await ensure('system_settings/global', () =>
    tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: 'system_settings',
      rowId: 'global',
      data: {
        defaultRadiusKm: 30,
        requestExpiryHours: 72,
        maxDonorsContacted: 5,
        requireVerifiedDonors: false,
        maintenanceMode: false,
      },
    }),
  );
  for (const hospital of DIRECTORY_HOSPITALS) {
    await ensure(`directory listing ${hospital.name}`, () =>
      tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: 'organizations',
        rowId: hospital.id,
        data: {
          name: hospital.name,
          type: 'hospital',
          district: hospital.district,
          city: hospital.city,
          approxLat: hospital.lat,
          approxLng: hospital.lng,
          verificationStatus: 'not_submitted',
          claimed: false,
        },
      }),
    );
  }
}

async function ensureFunction() {
  console.log('\nFunction');
  try {
    await functions.get({ functionId: FUNCTION.id });
    console.log(`  = ${FUNCTION.id} (exists, updating configuration)`);
    await functions.update({
      functionId: FUNCTION.id,
      name: FUNCTION.name,
      runtime: FUNCTION.runtime,
      execute: FUNCTION.execute,
      schedule: FUNCTION.schedule,
      timeout: FUNCTION.timeout,
      entrypoint: FUNCTION.entrypoint,
      commands: FUNCTION.commands,
      scopes: FUNCTION.scopes,
      logging: true,
    });
  } catch (error) {
    if (!isNotFound(error)) throw error;
    await functions.create({
      functionId: FUNCTION.id,
      name: FUNCTION.name,
      runtime: FUNCTION.runtime,
      execute: FUNCTION.execute,
      schedule: FUNCTION.schedule,
      timeout: FUNCTION.timeout,
      entrypoint: FUNCTION.entrypoint,
      commands: FUNCTION.commands,
      scopes: FUNCTION.scopes,
      logging: true,
    });
    console.log(`  + ${FUNCTION.id}`);
  }

  const variables = { DONORLINK_DATABASE_ID: DATABASE_ID };
  const existing = await functions.listVariables({ functionId: FUNCTION.id });
  for (const [key, value] of Object.entries(variables)) {
    const found = existing.variables.find((v) => v.key === key);
    if (found) {
      await functions.updateVariable({ functionId: FUNCTION.id, variableId: found.$id, key, value });
    } else {
      await functions.createVariable({ functionId: FUNCTION.id, variableId: ID.unique(), key, value });
    }
  }

  const { archive, domainFiles } = await packageFunction();
  console.log(`  . packaged function (${domainFiles} shared domain modules)`);
  const deployment = await functions.createDeployment({
    functionId: FUNCTION.id,
    code: InputFile.fromPath(archive, 'api.tar.gz'),
    activate: true,
    entrypoint: FUNCTION.entrypoint,
    commands: FUNCTION.commands,
  });
  console.log(`  . deployment ${deployment.$id} uploaded, building...`);
  for (let attempt = 0; attempt < 120; attempt++) {
    const current = await functions.getDeployment({ functionId: FUNCTION.id, deploymentId: deployment.$id });
    if (current.status === 'ready') {
      console.log('  + deployment ready');
      return;
    }
    if (current.status === 'failed') {
      throw new Error(`Function build failed. Check the build logs in the Appwrite Console (Functions > ${FUNCTION.name}).`);
    }
    await sleep(2500);
  }
  throw new Error('Timed out waiting for the function build.');
}

async function main() {
  console.log(`Provisioning ${projectId} at ${endpoint}`);
  await ensureDatabase();
  for (const table of TABLES) await ensureTable(table);
  await ensureBuckets();
  await seed();
  await ensureFunction();

  console.log(
    [
      '',
      'Done. Make sure your .env contains:',
      `  EXPO_PUBLIC_APPWRITE_DATABASE_ID=${DATABASE_ID}`,
      `  EXPO_PUBLIC_APPWRITE_FUNCTION_ID=${FUNCTION.id}`,
      '',
      'Remaining manual steps are listed in docs/setup-appwrite.md (first admin user, email verification templates).',
    ].join('\n'),
  );
}

main().catch((error) => {
  console.error(`\nProvisioning stopped: ${error?.message ?? error}`);
  process.exit(1);
});
