import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve('src');
const PREVIEW_DIR = path.resolve('src/components/preview');

export function runAudit() {
  const offenders = [];
  const colorRegex = /\b(bg|border)-(indigo|amber|emerald|rose|red|sky|violet|orange|yellow|green|blue)-(50|100|200)\b/g;
  const scrimRegex = /\b(bg-slate-950\/\d+|bg-black\/\d+)\b/g;
  const nativeSelectRegex = /<select\b/g;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (fullPath === PREVIEW_DIR || entry.name === 'node_modules') continue;
        walk(fullPath);
      } else if (
        (entry.name.endsWith('.tsx') ||
          entry.name.endsWith('.ts') ||
          entry.name.endsWith('.jsx') ||
          entry.name.endsWith('.js')) &&
        !entry.name.includes('.test.')
      ) {
        checkFile(fullPath);
      }
    }
  }

  function checkFile(filePath) {
    const relPath = path.relative(process.cwd(), filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        return;
      }

      // 1. Color check
      let match;
      colorRegex.lastIndex = 0;
      while ((match = colorRegex.exec(line)) !== null) {
        const fullClass = match[0];
        const prefix = match[1]; // 'bg' or 'border'
        const hasDark = prefix === 'bg' ? /\bdark:(?:[a-z0-9-]+:)*bg-/.test(line) : /\bdark:(?:[a-z0-9-]+:)*border-/.test(line);
        if (!hasDark) {
          offenders.push({
            type: 'light-only-color',
            file: relPath,
            line: lineNum,
            detail: fullClass,
            snippet: trimmed,
          });
        }
      }

      // 2. Scrim check
      scrimRegex.lastIndex = 0;
      while ((match = scrimRegex.exec(line)) !== null) {
        const fullClass = match[0];
        // Scrim if it is on an overlay / backdrop / modal
        if (
          line.includes('fixed') ||
          line.includes('absolute') ||
          line.includes('backdrop') ||
          line.includes('inset-0') ||
          line.includes('z-50')
        ) {
          offenders.push({
            type: 'scrim-without-token',
            file: relPath,
            line: lineNum,
            detail: fullClass,
            snippet: trimmed,
          });
        }
      }

      // 3. Native select check (except in Select.tsx)
      if (!relPath.endsWith('Select.tsx')) {
        nativeSelectRegex.lastIndex = 0;
        if (nativeSelectRegex.test(line)) {
          offenders.push({
            type: 'native-select',
            file: relPath,
            line: lineNum,
            detail: '<select>',
            snippet: trimmed,
          });
        }
      }
    });
  }

  walk(SRC_DIR);
  return offenders;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const results = runAudit();
  console.log(`Audit complete: ${results.length} total offenders.`);
  const byType = {};
  const byFile = {};
  for (const o of results) {
    byType[o.type] = (byType[o.type] || 0) + 1;
    byFile[o.file] = (byFile[o.file] || 0) + 1;
  }
  console.log('By type:', byType);
  console.log('By file:', byFile);
}
