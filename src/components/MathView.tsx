import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathViewProps {
  content: string;
  className?: string;
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
            return katex.renderToString(math, { displayMode: true, throwOnError: false });
          } catch {
            return `<span class="text-red-500 font-mono">${part}</span>`;
          }
        }

        // Display math: \[...\]
        if (part.startsWith('\\[') && part.endsWith('\\]')) {
          const math = part.slice(2, -2);
          try {
            return katex.renderToString(math, { displayMode: true, throwOnError: false });
          } catch {
            return `<span class="text-red-500 font-mono">${part}</span>`;
          }
        }

        // Inline math: $...$
        if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1);
          try {
            return katex.renderToString(math, { displayMode: false, throwOnError: false });
          } catch {
            return `<span class="text-red-500 font-mono">${part}</span>`;
          }
        }

        // Inline math: \(...\)
        if (part.startsWith('\\(') && part.endsWith('\\)')) {
          const math = part.slice(2, -2);
          try {
            return katex.renderToString(math, { displayMode: false, throwOnError: false });
          } catch {
            return `<span class="text-red-500 font-mono">${part}</span>`;
          }
        }

        // Texto plano: preserva quebras de linha
        return part
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br/>');
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
