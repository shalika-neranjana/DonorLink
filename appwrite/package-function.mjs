/**
 * Builds the deployable Appwrite Function bundle.
 *
 *  1. Transpiles the shared, framework-free domain code in src/domain (TypeScript)
 *     to CommonJS inside appwrite/functions/api/src/domain, so the function and
 *     the app use exactly the same validation, transitions and matching rules.
 *  2. Archives the function folder (without node_modules) into
 *     appwrite/.build/api.tar.gz, ready for `appwrite:provision` to upload.
 *
 * Usage: node appwrite/package-function.mjs
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const tar = require('tar');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const domainSrc = join(root, 'src', 'domain');
const functionDir = join(root, 'appwrite', 'functions', 'api');
const domainOut = join(functionDir, 'src', 'domain');
const buildDir = join(root, 'appwrite', '.build');

export function buildDomain() {
  rmSync(domainOut, { recursive: true, force: true });
  mkdirSync(domainOut, { recursive: true });
  let count = 0;
  for (const file of readdirSync(domainSrc)) {
    if (!file.endsWith('.ts')) continue;
    const source = readFileSync(join(domainSrc, file), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    });
    writeFileSync(join(domainOut, file.replace(/\.ts$/, '.js')), outputText);
    count += 1;
  }
  return count;
}

export async function packageFunction() {
  const count = buildDomain();
  mkdirSync(buildDir, { recursive: true });
  const archive = join(buildDir, 'api.tar.gz');
  rmSync(archive, { force: true });
  await tar.create(
    {
      gzip: true,
      file: archive,
      cwd: functionDir,
      portable: true,
      filter: (path) => !/(^|[\/])(node_modules|__tests__)([\/]|$)/.test(path),
    },
    ['.'],
  );
  return { archive, domainFiles: count };
}

if (process.argv[1]?.endsWith('package-function.mjs')) {
  const { archive, domainFiles } = await packageFunction();
  console.log(`Transpiled ${domainFiles} domain modules.`);
  console.log(`Function bundle written to ${archive}`);
}
