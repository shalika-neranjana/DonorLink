#!/usr/bin/env node
// Read-only environment check for the usability study. Makes no changes to the app or
// backend, prints no secret values (only whether a variable is SET), and writes
// results/automated/00-environment.json.
//
//   node testing/usability/scripts/check-environment.mjs        (run from the repo root)
//   BASE_URL=http://localhost:8081 node ...                      (override the web preview URL)

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const usability = path.resolve(here, '..');
const repo = path.resolve(usability, '..', '..');
const baseUrl = process.env.BASE_URL ?? 'http://localhost:8081';

const sh = (cmd, cwd = repo) => {
  try {
    return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
};

const report = { checkedAt: new Date().toISOString(), baseUrl, checks: [] };
const add = (name, ok, detail) => {
  report.checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'WARN'}  ${name}${detail ? `  - ${detail}` : ''}`);
};

// App under test
const pkg = JSON.parse(readFileSync(path.join(repo, 'package.json'), 'utf8'));
report.app = {
  branch: sh('git rev-parse --abbrev-ref HEAD'),
  commit: sh('git rev-parse --short HEAD'),
  dirtyTrackedFiles: (sh('git status --porcelain --untracked-files=no') ?? '').split('\n').filter(Boolean).length,
  expo: pkg.dependencies.expo,
  reactNative: pkg.dependencies['react-native'],
};
add('App commit', !!report.app.commit, `${report.app.branch} @ ${report.app.commit}, tracked files modified: ${report.app.dirtyTrackedFiles}`);
add('Expo / React Native', true, `${report.app.expo} / ${report.app.reactNative}`);

// Host
report.host = { os: `${os.type()} ${os.release()}`, node: process.version };
add('Node', Number(process.versions.node.split('.')[0]) >= 20, process.version);

// Backend configuration: key NAMES only
const envPath = path.join(repo, '.env');
const need = ['EXPO_PUBLIC_APPWRITE_ENDPOINT', 'EXPO_PUBLIC_APPWRITE_PROJECT_ID', 'EXPO_PUBLIC_APPWRITE_PLATFORM', 'EXPO_PUBLIC_APPWRITE_DATABASE_ID', 'EXPO_PUBLIC_APPWRITE_FUNCTION_ID'];
if (existsSync(envPath)) {
  const keys = new Set(readFileSync(envPath, 'utf8').split('\n').map((l) => l.split('=')[0].trim()));
  const missing = need.filter((k) => !keys.has(k));
  add('.env Appwrite keys present', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : 'all five set (values not shown)');
} else {
  add('.env present', false, 'copy .env.example to .env');
}
report.apiKeyFileIgnoredByGit = sh('git check-ignore .env.provision.local') !== null;
add('.env.provision.local is git-ignored (and is NOT used by this package)', report.apiKeyFileIgnoredByGit);

// Web preview reachable
try {
  const res = await fetch(baseUrl, { signal: AbortSignal.timeout(8000) });
  add('Web preview reachable', res.ok, `${baseUrl} -> HTTP ${res.status}`);
} catch (e) {
  add('Web preview reachable', false, `${baseUrl} not reachable (start it: npx expo start --web --port 8081)`);
}

// Playwright
const auto = path.join(usability, 'automation');
const pwPkg = path.join(auto, 'node_modules', '@playwright', 'test', 'package.json');
const pwVersion = existsSync(pwPkg) ? JSON.parse(readFileSync(pwPkg, 'utf8')).version : null;
add('Playwright installed (testing/usability/automation)', !!pwVersion, pwVersion ?? 'run: npm install  (in automation/)');
const msPw = path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), '.cache'), 'ms-playwright');
const browsers = existsSync(msPw) ? readdirSync(msPw).filter((d) => d.startsWith('chromium')) : [];
add('Chromium available', browsers.length > 0 || !!process.env.PW_CHROMIUM_PATH, `${browsers.join(', ') || 'none'}${process.env.PW_CHROMIUM_PATH ? ' + PW_CHROMIUM_PATH set' : ''}`);
report.playwright = { version: pwVersion, browsers };

// Android
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
const adb = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const avdDir = path.join(os.homedir(), '.android', 'avd');
const avds = existsSync(avdDir) ? readdirSync(avdDir).filter((f) => f.endsWith('.ini')).map((f) => f.replace('.ini', '')) : [];
add('Android SDK adb found', existsSync(adb), existsSync(adb) ? 'platform-tools present' : 'install Android SDK platform-tools');
add('Android emulator image (AVD)', avds.length > 0, avds.join(', ') || 'none');
let devices = [];
if (existsSync(adb)) {
  devices = (sh(`"${adb}" devices`, usability) ?? '').split('\n').slice(1).filter((l) => /\tdevice$/.test(l)).map((l) => l.split('\t')[0]);
}
add('Android device/emulator connected (needed for the PDF-required Android session)', devices.length > 0, devices.join(', ') || 'none connected');
report.android = { sdkFound: existsSync(sdk), adb: existsSync(adb), avds, devices };

// Credentials: report only whether they are set
const roles = ['REQUESTER', 'DONOR', 'REVIEWER'];
report.qaCredentialsSet = Object.fromEntries(roles.map((r) => [r, !!(process.env[`QA_${r}_EMAIL`] && process.env[`QA_${r}_PASSWORD`])]));
add('QA_* credentials set in environment (cross-account E2E runs only if all three)', roles.every((r) => report.qaCredentialsSet[r]), JSON.stringify(report.qaCredentialsSet));

mkdirSync(path.join(usability, 'results', 'automated'), { recursive: true });
writeFileSync(path.join(usability, 'results', 'automated', '00-environment.json'), JSON.stringify(report, null, 2));
console.log('\nWrote results/automated/00-environment.json');
