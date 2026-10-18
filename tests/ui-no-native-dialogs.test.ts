import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function findSourceFiles(dir: string, fileList: string[] = []): string[] {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      findSourceFiles(fullPath, fileList);
    } else if (/\.(ts|tsx)$/.test(item.name)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe('No Native Dialogs Guard (Phase 9)', () => {
  it('no alert() or confirm() in src except documented allow-list', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const files = findSourceFiles(srcDir);
    const violations: { file: string; line: number; text: string }[] = [];

    const alertRegex = /\balert\(/;
    const confirmRegex = /\b(window\.)?confirm\(/;

    for (const file of files) {
      const relPath = path.relative(srcDir, file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((lineText, index) => {
        // Ignore comments
        const trimmed = lineText.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

        // Allow-list 1: ProfileContext.tsx clearCurrentExam (contract preservation per PLAN.md §8)
        if (relPath === 'context/ProfileContext.tsx' && confirmRegex.test(lineText)) {
          return;
        }

        // Allow-list 2: confirmStore.ts unmounted fallback implementation (per PLAN.md Appendix B-2)
        if (relPath === 'components/ui/confirmStore.ts' && confirmRegex.test(lineText)) {
          return;
        }

        if (alertRegex.test(lineText) || confirmRegex.test(lineText)) {
          violations.push({
            file: relPath,
            line: index + 1,
            text: lineText.trim(),
          });
        }
      });
    }

    expect(
      violations,
      `Found disallowed native alert/confirm dialogs:\n${violations
        .map((v) => `${v.file}:${v.line}: ${v.text}`)
        .join('\n')}`
    ).toEqual([]);
  });
});

