import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Dead Class Guard (Phase 11)', () => {
  const srcDir = path.resolve(__dirname, '../src');

  const FORBIDDEN_PATTERNS = [
    { pattern: /\banimate-in\b/, name: 'animate-in' },
    { pattern: /\banimate-out\b/, name: 'animate-out' },
    { pattern: /\bfade-in\b/, name: 'fade-in' },
    { pattern: /\bfade-out\b/, name: 'fade-out' },
    { pattern: /(?<!cursor-)\bzoom-in(-\d+)?\b/, name: 'zoom-in' },
    { pattern: /(?<!cursor-)\bzoom-out(-\d+)?\b/, name: 'zoom-out' },
    { pattern: /\bslide-in-from\b/, name: 'slide-in-from' },
    { pattern: /\bslide-out-to\b/, name: 'slide-out-to' },
    { pattern: /\bh-13\b/, name: 'h-13' },
    { pattern: /\bpy-0\.2\b/, name: 'py-0.2' },
  ];

  function collectTsxFiles(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectTsxFiles(fullPath));
      } else if (entry.name.endsWith('.tsx')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  it('scans all src/**/*.tsx files and asserts zero dead classes', () => {
    const files = collectTsxFiles(srcDir);
    expect(files.length).toBeGreaterThan(0);

    const violations: { file: string; line: number; match: string; rule: string }[] = [];

    for (const file of files) {
      const relativePath = path.relative(path.resolve(__dirname, '..'), file);
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((lineText, idx) => {
        for (const { pattern, name } of FORBIDDEN_PATTERNS) {
          const match = lineText.match(pattern);
          if (match) {
            violations.push({
              file: relativePath,
              line: idx + 1,
              match: match[0],
              rule: name,
            });
          }
        }
      });
    }

    expect(
      violations,
      `Found ${violations.length} dead class violation(s):\n` +
        violations.map((v) => `  ${v.file}:${v.line} -> "${v.match}" (rule: ${v.rule})`).join('\n')
    ).toEqual([]);
  });
});
