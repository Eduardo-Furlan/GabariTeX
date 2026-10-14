import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('paper regression guard', () => {
  const previewDir = path.resolve(__dirname, '../src/components/preview');
  const printCssPath = path.resolve(__dirname, '../src/styles/print.css');

  it('ensures no file in src/components/preview contains dark: utility classes', () => {
    const files = fs.readdirSync(previewDir).filter((f) => f.endsWith('.tsx'));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = fs.readFileSync(path.join(previewDir, file), 'utf-8');
      const matches = content.match(/dark:[a-zA-Z0-9_\-\/]+/g);
      expect(
        matches,
        `File ${file} must not contain dark: classes, found: ${matches?.join(', ')}`
      ).toBeNull();
    }
  });

  it('ensures every preview root component contains the paper class', () => {
    const files = fs.readdirSync(previewDir).filter((f) => f.endsWith('.tsx'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(previewDir, file), 'utf-8');
      expect(
        content.includes('paper'),
        `File ${file} must declare class "paper" on root preview element`
      ).toBe(true);
    }
  });

  it('ensures print.css redeclares light variables inside @media print', () => {
    const printCss = fs.readFileSync(printCssPath, 'utf-8');

    expect(printCss).toContain('@media print');
    expect(printCss).toContain('--c-white: 255 255 255;');
    expect(printCss).toContain('--c-page: 255 255 255;');
    expect(printCss).toContain('--slate-900: 15 23 42;');
  });
});

