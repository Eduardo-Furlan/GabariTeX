import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('UI Motion CSS and Motion component usage', () => {
  const motionCssPath = path.resolve(__dirname, '../src/styles/motion.css');
  const motionCss = fs.readFileSync(motionCssPath, 'utf-8');

  it('contains @media print with animation: none !important', () => {
    expect(motionCss).toContain('@media print');
    expect(motionCss).toContain('animation: none !important');
  });

  it('contains prefers-reduced-motion overrides', () => {
    expect(motionCss).toContain('prefers-reduced-motion: reduce');
  });

  it('configures .screen-enter with backwards animation-fill-mode and never forwards or both', () => {
    const screenEnterMatch = motionCss.match(/\.screen-enter\s*\{([^}]+)\}/);
    expect(screenEnterMatch).not.toBeNull();
    const rules = screenEnterMatch![1];
    expect(rules).toContain('backwards');
    expect(rules).not.toContain('forwards');
    expect(rules).not.toContain('both');
  });

  it('ensures no TSX component uses motion.tag directly (must use m.tag)', () => {
    const srcDir = path.resolve(__dirname, '../src');

    function checkDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDir(fullPath);
        } else if (entry.name.endsWith('.tsx')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const forbiddenMatch = content.match(/\bmotion\.(div|span|button|li|ul|section|p|a|h[1-6])\b/);
          expect(
            forbiddenMatch,
            `Forbidden motion.* usage found in ${entry.name}: ${forbiddenMatch?.[0]}. Use m.* instead.`
          ).toBeNull();
        }
      }
    }

    checkDir(srcDir);
  });
});
