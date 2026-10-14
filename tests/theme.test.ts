import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  parseStoredTheme,
  resolveTheme,
  applyTheme,
  THEME_STORAGE_KEY,
} from '../src/theme/theme';

describe('theme logic', () => {
  describe('THEME_STORAGE_KEY', () => {
    it('matches expected key', () => {
      expect(THEME_STORAGE_KEY).toBe('mcorr_theme');
    });
  });

  describe('parseStoredTheme', () => {
    it('returns system for null or empty', () => {
      expect(parseStoredTheme(null)).toBe('system');
      expect(parseStoredTheme('')).toBe('system');
    });

    it('returns system for invalid strings', () => {
      expect(parseStoredTheme('auto')).toBe('system');
      expect(parseStoredTheme('night')).toBe('system');
      expect(parseStoredTheme('DARK')).toBe('system');
    });

    it('parses valid theme strings', () => {
      expect(parseStoredTheme('light')).toBe('light');
      expect(parseStoredTheme('dark')).toBe('dark');
      expect(parseStoredTheme('system')).toBe('system');
    });
  });

  describe('resolveTheme', () => {
    it('resolves system according to OS preference', () => {
      expect(resolveTheme('system', true)).toBe('dark');
      expect(resolveTheme('system', false)).toBe('light');
    });

    it('resolves explicit dark regardless of OS preference', () => {
      expect(resolveTheme('dark', true)).toBe('dark');
      expect(resolveTheme('dark', false)).toBe('dark');
    });

    it('resolves explicit light regardless of OS preference', () => {
      expect(resolveTheme('light', true)).toBe('light');
      expect(resolveTheme('light', false)).toBe('light');
    });
  });

  describe('applyTheme', () => {
    const originalDocument = globalThis.document;
    let classes: Set<string>;
    let styleObj: { colorScheme: string };
    let metaAttrs: Record<string, string>;

    beforeEach(() => {
      classes = new Set<string>();
      styleObj = { colorScheme: '' };
      metaAttrs = {};

      const fakeDocument = {
        documentElement: {
          classList: {
            add: (c: string) => classes.add(c),
            remove: (c: string) => classes.delete(c),
            contains: (c: string) => classes.has(c),
          },
          style: styleObj,
        },
        querySelector: (sel: string) => {
          if (sel === 'meta[name="theme-color"]') {
            return {
              setAttribute: (name: string, val: string) => {
                metaAttrs[name] = val;
              },
            };
          }
          return null;
        },
      };

      // @ts-expect-error Mocking global document for node test environment
      globalThis.document = fakeDocument;
    });

    afterEach(() => {
      globalThis.document = originalDocument;
    });

    it('applies dark theme correctly', () => {
      applyTheme('dark');
      expect(classes.has('dark')).toBe(true);
      expect(styleObj.colorScheme).toBe('dark');
      expect(metaAttrs['content']).toBe('#0f172a');
    });

    it('applies light theme correctly', () => {
      classes.add('dark');
      applyTheme('light');
      expect(classes.has('dark')).toBe(false);
      expect(styleObj.colorScheme).toBe('light');
      expect(metaAttrs['content']).toBe('#ffffff');
    });
  });
});

