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

describe('Accent Contrast Check', () => {
  const tokensPath = path.resolve(__dirname, '../src/styles/tokens.css');
  const tokensContent = fs.readFileSync(tokensPath, 'utf-8');

  const indexCssPath = path.resolve(__dirname, '../src/index.css');
  const indexCss = fs.readFileSync(indexCssPath, 'utf-8');

  // Extract accent channels
  const accents: Record<string, [number, number, number]> = {};
  const accentMatches = tokensContent.matchAll(/--accent-([0-9]+)\s*:\s*([0-9\s]+);/g);
  for (const match of accentMatches) {
    accents[match[1]] = parseRgb(match[2]);
  }

  // Extract dark c-white from index.css
  const darkBlockMatch = indexCss.match(/html\.dark\s*\{([^}]+)\}/);
  if (!darkBlockMatch) {
    throw new Error('html.dark block not found in src/index.css');
  }
  const darkVars: Record<string, [number, number, number]> = {};
  for (const line of darkBlockMatch[1].split('\n')) {
    const m = line.match(/--([a-zA-Z0-9_\-]+)\s*:\s*([0-9\s]+);/);
    if (m) darkVars[m[1]] = parseRgb(m[2]);
  }

  const white: [number, number, number] = [255, 255, 255];
  const darkCardSurface = darkVars['c-white']; // 15 23 42

  it('meets contrast floor for white on accent-600 (>= 6.5)', () => {
    expect(accents['600']).toBeDefined();
    const ratio = contrastRatio(white, accents['600']);
    expect(ratio).toBeGreaterThanOrEqual(6.5);
  });

  it('meets contrast floor for white on accent-700 (>= 8.0)', () => {
    expect(accents['700']).toBeDefined();
    const ratio = contrastRatio(white, accents['700']);
    expect(ratio).toBeGreaterThanOrEqual(8.0);
  });

  it('meets contrast floor for accent-700 on accent-50 (>= 7.5)', () => {
    expect(accents['50']).toBeDefined();
    expect(accents['700']).toBeDefined();
    const ratio = contrastRatio(accents['700'], accents['50']);
    expect(ratio).toBeGreaterThanOrEqual(7.5);
  });

  it('meets contrast floor for accent-300 on dark card surface (>= 7.0)', () => {
    expect(accents['300']).toBeDefined();
    expect(darkCardSurface).toBeDefined();
    const ratio = contrastRatio(accents['300'], darkCardSurface);
    expect(ratio).toBeGreaterThanOrEqual(7.0);
  });

  it('meets contrast floor for accent-400 on dark card surface (>= 5.0)', () => {
    expect(accents['400']).toBeDefined();
    expect(darkCardSurface).toBeDefined();
    const ratio = contrastRatio(accents['400'], darkCardSurface);
    expect(ratio).toBeGreaterThanOrEqual(5.0);
  });
});
