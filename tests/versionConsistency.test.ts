import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

describe('Version consistency across project manifests', () => {
  it('has identical version across package.json, package-lock.json, tauri.conf.json, Cargo.toml, and Cargo.lock', () => {
    const scriptPath = resolve(__dirname, '../scripts/check-version.mjs');
    expect(() => {
      execFileSync(process.execPath, [scriptPath], { stdio: 'pipe' });
    }).not.toThrow();
  });
});
