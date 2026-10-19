import { describe, it, expect } from 'vitest';
import tailwindConfig from '../tailwind.config.js';

describe('UI Design Tokens in Tailwind Config', () => {
  const themeExtend = tailwindConfig.theme?.extend;

  it('declares ui and display font families and preserves sans, mono and serif', () => {
    expect(themeExtend?.fontFamily).toBeDefined();
    expect(themeExtend?.fontFamily?.ui).toBeDefined();
    expect(themeExtend?.fontFamily?.display).toBeDefined();
    expect(themeExtend?.fontFamily?.sans).toBeUndefined();
    expect(themeExtend?.fontFamily?.mono).toBeUndefined();
    expect(themeExtend?.fontFamily?.serif).toBeUndefined();
  });

  it('defines 2xs and xs box shadows', () => {
    expect(themeExtend?.boxShadow).toBeDefined();
    expect(themeExtend?.boxShadow?.['2xs']).toBeDefined();
    expect(themeExtend?.boxShadow?.xs).toBeDefined();
    expect(themeExtend?.boxShadow?.raised).toBeDefined();
    expect(themeExtend?.boxShadow?.overlay).toBeDefined();
  });

  it('maps indigo colors to accent CSS custom properties', () => {
    expect(themeExtend?.colors?.indigo).toBeDefined();
    const indigo600 = themeExtend?.colors?.indigo?.[600];
    expect(indigo600).toContain('--accent-600');
  });

  it('defines coarse pointer media query', () => {
    expect(themeExtend?.screens?.coarse).toBeDefined();
  });
});
