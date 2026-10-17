import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relPath) {
  return JSON.parse(readFileSync(resolve(rootDir, relPath), 'utf8'));
}

const pkg = readJson('package.json');
const pkgLock = readJson('package-lock.json');
const tauriConf = readJson('src-tauri/tauri.conf.json');

const cargoToml = readFileSync(resolve(rootDir, 'src-tauri/Cargo.toml'), 'utf8');
const cargoPackageSection = cargoToml.match(/\[package\][\s\S]*?(?=\n\[|$)/)?.[0] ?? '';
const cargoTomlVersion = cargoPackageSection.match(/^\s*version\s*=\s*"([^"]+)"/m)?.[1];

const cargoLock = readFileSync(resolve(rootDir, 'src-tauri/Cargo.lock'), 'utf8');
const cargoLockVersion = cargoLock.match(
  /\[\[package\]\]\s+name\s*=\s*"gabaritex"\s+version\s*=\s*"([^"]+)"/
)?.[1];

const entries = [
  ['package.json', pkg.version],
  ['package-lock.json (top)', pkgLock.version],
  ['package-lock.json (packages[""])', pkgLock.packages?.['']?.version],
  ['src-tauri/tauri.conf.json', tauriConf.version],
  ['src-tauri/Cargo.toml', cargoTomlVersion],
  ['src-tauri/Cargo.lock (gabaritex)', cargoLockVersion],
];

const tagArg = process.argv[2];
const expectedVersion = pkg.version;

let mismatch = false;
for (const [, val] of entries) {
  if (!val || val !== expectedVersion) {
    mismatch = true;
  }
}

if (tagArg !== undefined && tagArg !== `v${expectedVersion}`) {
  mismatch = true;
}

if (mismatch) {
  console.error('Version mismatch detected:');
  for (const [label, val] of entries) {
    console.error(`  ${label}: ${val}`);
  }
  if (tagArg !== undefined) {
    console.error(`  tag argument: ${tagArg} (expected: v${expectedVersion})`);
  }
  process.exit(1);
}

console.log(`Version check passed: ${expectedVersion}${tagArg ? ` (tag: ${tagArg})` : ''}`);
