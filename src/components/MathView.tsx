import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathViewProps {
  content: string;
  className?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const MathView: React.FC<MathViewProps> = ({ content, className = '' }) => {
  const renderedHtml = useMemo(() => {
    if (!content) return '';

    // Regex para capturar $$...$$, \[...\], $...$ e \(...\)
    const regex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^\$\n]+?\$|\\\(.+?\\\))/g;
    const parts = content.split(regex);

    return parts
      .map((part) => {
        if (!part) return '';

        // Display math: $$...$$
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.slice(2, -2);
          try {
            return katex.renderToString(math, { displayMode: true, throwOnError: false, trust: false });
          } catch {
            return `<span class="text-red-500 font-mono">${escapeHtml(part)}</span>`;
          }
        }

        // Display math: \[...\]
        if (part.startsWith('\\[') && part.endsWith('\\]')) {
          const math = part.slice(2, -2);
          try {
            return katex.renderToString(math, { displayMode: true, throwOnError: false, trust: false });
          } catch {
            return `<span class="text-red-500 font-mono">${escapeHtml(part)}</span>`;
          }
        }

        // Inline math: $...$
        if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1);
          try {
            return katex.renderToString(math, { displayMode: false, throwOnError: false, trust: false });
          } catch {
            return `<span class="text-red-500 font-mono">${escapeHtml(part)}</span>`;
          }
        }

        // Inline math: \(...\)
        if (part.startsWith('\\(') && part.endsWith('\\)')) {
          const math = part.slice(2, -2);
          try {
            return katex.renderToString(math, { displayMode: false, throwOnError: false, trust: false });
          } catch {
            return `<span class="text-red-500 font-mono">${escapeHtml(part)}</span>`;
          }
        }

        // Texto plano: preserva quebras de linha
        return escapeHtml(part).replace(/\n/g, '<br/>');
      })
      .join('');
  }, [content]);

  return (
    <div
      className={`math-content inline-block ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};
