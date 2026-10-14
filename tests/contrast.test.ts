import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function parseRgb(str: string): [number, number, number] {
  const parts = str.trim().split(/\s+/).map(Number);
  return [parts[0], parts[1], parts[2]];
}

function sRgbToLin(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * sRgbToLin(r) + 0.7152 * sRgbToLin(g) + 0.0722 * sRgbToLin(b);
}

function contrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const l1 = luminance(rgb1);
  const l2 = luminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('dark mode WCAG contrast check', () => {
  const cssPath = path.resolve(__dirname, '../src/index.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  // Extract variables from html.dark block
  const darkBlockMatch = css.match(/html\.dark\s*\{([^}]+)\}/);
  if (!darkBlockMatch) {
    throw new Error('html.dark block not found in src/index.css');
  }

  const vars: Record<string, [number, number, number]> = {};
  const lines = darkBlockMatch[1].split('\n');
  for (const line of lines) {
    const m = line.match(/--([a-zA-Z0-9_\-]+)\s*:\s*([0-9\s]+);/);
    if (m) {
      vars[m[1]] = parseRgb(m[2]);
    }
  }

  const cardSurface = vars['c-white']; // 15 23 42 (surface in dark mode)
  const pageBg = vars['c-page']; // 2 6 23

  it('checks contrast of text levels over dark card surface', () => {
    expect(cardSurface).toBeDefined();

    // slate-900 (primary heading/accent)
    const ratio900 = contrastRatio(vars['slate-900'], cardSurface);
    expect(ratio900).toBeGreaterThanOrEqual(7);

    // slate-800
    const ratio800 = contrastRatio(vars['slate-800'], cardSurface);
    expect(ratio800).toBeGreaterThanOrEqual(7);

    // slate-700
    const ratio700 = contrastRatio(vars['slate-700'], cardSurface);
    expect(ratio700).toBeGreaterThanOrEqual(6);

    // slate-600
    const ratio600 = contrastRatio(vars['slate-600'], cardSurface);
    expect(ratio600).toBeGreaterThanOrEqual(5);

    // slate-500 (secondary text)
    const ratio500 = contrastRatio(vars['slate-500'], cardSurface);
    expect(ratio500).toBeGreaterThanOrEqual(4.5);

    // slate-400 (muted text)
    const ratio400 = contrastRatio(vars['slate-400'], cardSurface);
    expect(ratio400).toBeGreaterThanOrEqual(3.5);
  });

  it('checks contrast of card surface against dark page background', () => {
    expect(pageBg).toBeDefined();
    const ratioCardOverPage = contrastRatio(cardSurface, pageBg);
    expect(ratioCardOverPage).toBeGreaterThanOrEqual(1.1);
  });

  it('checks border slate-300 contrast over card surface', () => {
    const ratioBorder = contrastRatio(vars['slate-300'], cardSurface);
    expect(ratioBorder).toBeGreaterThanOrEqual(1.8);
  });
});

