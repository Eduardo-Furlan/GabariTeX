import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import katex from 'katex';
import { MathView } from '../src/components/MathView';

describe('MathView fallback escaping and KaTeX trust', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('escapes HTML in fallback output when katex.renderToString throws', () => {
    vi.spyOn(katex, 'renderToString').mockImplementation(() => {
      throw new Error('Simulated KaTeX failure');
    });

    const html = renderToString(<MathView content="$<img src=x onerror=alert(1)>$" />);
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img');
  });
});
