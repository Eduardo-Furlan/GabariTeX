import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function getFilesRecursively(dir: string, extension: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getFilesRecursively(fullPath, extension));
    } else if (entry.name.endsWith(extension)) {
      results.push(fullPath);
    }
  }

  return results;
}

describe('Rule 09 neutrals regression guard', () => {
  const srcDir = path.resolve(__dirname, '../src');

  it('ensures no tsx or ts file in src/ uses dark: with slate or white neutrals', () => {
    const files = [
      ...getFilesRecursively(srcDir, '.tsx'),
      ...getFilesRecursively(srcDir, '.ts'),
    ];
    expect(files.length).toBeGreaterThan(0);

    const violations: { file: string; line: number; text: string }[] = [];

    for (const file of files) {
      const relativePath = path.relative(srcDir, file);
      const lines = fs.readFileSync(file, 'utf-8').split('\n');

      lines.forEach((line, index) => {
        // Matches dark:bg-slate-*, dark:text-slate-*, dark:border-slate-*, dark:hover:bg-slate-*, dark:bg-white, etc.
        if (/\bdark:[a-z:-]*(slate|white)\b/.test(line)) {
          violations.push({
            file: relativePath,
            line: index + 1,
            text: line.trim(),
          });
        }
      });
    }

    expect(
      violations,
      `Found dark: prefix on neutral palette (Rule 09 violation). Neutrals invert automatically via CSS variables:\n${violations
        .map((v) => `  ${v.file}:${v.line} -> ${v.text}`)
        .join('\n')}`
    ).toEqual([]);
  });
});
