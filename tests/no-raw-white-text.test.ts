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

describe('no raw text-white regression guard', () => {
  const srcDir = path.resolve(__dirname, '../src');

  it('ensures no tsx file in src/ uses the legacy text-white class', () => {
    const files = getFilesRecursively(srcDir, '.tsx');
    expect(files.length).toBeGreaterThan(0);

    const violations: { file: string; line: number; text: string }[] = [];

    for (const file of files) {
      const relativePath = path.relative(srcDir, file);
      const lines = fs.readFileSync(file, 'utf-8').split('\n');

      lines.forEach((line, index) => {
        if (/\btext-white\b/.test(line)) {
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
      `Found text-white usage (use text-on-accent for colored buttons or semantic colors instead):\n${violations
        .map((v) => `  ${v.file}:${v.line} -> ${v.text}`)
        .join('\n')}`
    ).toEqual([]);
  });
});

