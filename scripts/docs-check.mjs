import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const docsDir = path.join(rootDir, 'docs');
const manifestPath = path.join(docsDir, 'screenshots', 'manifest.json');
const srcDir = path.join(rootDir, 'src');

const REQUIRED_KEYS = [
  'id',
  'page',
  'after',
  'target',
  'window',
  'screen',
  'state',
  'setup',
  'mustShow',
  'mustNotShow',
  'crop',
  'callouts',
  'alt',
  'caption',
];

let hasErrors = false;

// 1. Load manifest
if (!fs.existsSync(manifestPath)) {
  console.error(`[ERROR] Manifest not found at ${manifestPath}`);
  process.exit(1);
}

let manifest = [];
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (err) {
  console.error(`[ERROR] Failed to parse manifest.json:`, err);
  process.exit(1);
}

const manifestMap = new Map();

for (let i = 0; i < manifest.length; i++) {
  const entry = manifest[i];
  const missingKeys = REQUIRED_KEYS.filter((key) => !(key in entry));
  if (missingKeys.length > 0) {
    console.error(`[ERROR] Manifest entry #${i} (id: "${entry.id}") missing keys: ${missingKeys.join(', ')}`);
    hasErrors = true;
  }

  if (entry.id) {
    if (manifestMap.has(entry.id)) {
      console.error(`[ERROR] Duplicate manifest id: "${entry.id}"`);
      hasErrors = true;
    }
    manifestMap.set(entry.id, entry);
  }

  if (Array.isArray(entry.callouts)) {
    for (let c = 0; c < entry.callouts.length; c++) {
      const callout = entry.callouts[c];
      const expectedN = c + 1;
      if (callout.n !== expectedN) {
        console.error(
          `[ERROR] Entry "${entry.id}" callout at index ${c} has n=${callout.n}, expected ${expectedN}`
        );
        hasErrors = true;
      }
      if (!callout.target || typeof callout.label !== 'string') {
        console.error(`[ERROR] Entry "${entry.id}" callout #${callout.n} missing target or label`);
        hasErrors = true;
      }
    }
  } else {
    console.error(`[ERROR] Entry "${entry.id}" callouts must be an array`);
    hasErrors = true;
  }
}

// 2. Scan docs/**/*.md (excluding docs/screenshots/**)
function findMarkdownFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const dirent of list) {
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      if (dirent.name === 'screenshots' || dirent.name === '.vitepress') {
        continue;
      }
      results = results.concat(findMarkdownFiles(fullPath));
    } else if (dirent.isFile() && dirent.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

const mdFiles = findMarkdownFiles(docsDir);

const usedScreenshotIds = new Map();
const boldLabels = [];

const screenshotRegex = /<Screenshot\s+[^>]*id=["']([^"']+)["'][^>]*\/?>/g;
const boldRegex = /\*\*([^*]+?)\*\*/g;

for (const file of mdFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineNum = lineIdx + 1;

    // Screenshot tags
    let match;
    screenshotRegex.lastIndex = 0;
    while ((match = screenshotRegex.exec(line)) !== null) {
      const id = match[1];
      if (!usedScreenshotIds.has(id)) {
        usedScreenshotIds.set(id, []);
      }
      usedScreenshotIds.get(id).push({ file, lineNum });
    }

    // Bold strings
    boldRegex.lastIndex = 0;
    while ((match = boldRegex.exec(line)) !== null) {
      const label = match[1].trim();
      if (label) {
        boldLabels.push({ label, file, lineNum });
      }
    }
  }
}

// Check screenshot ID usage: each used must exist in manifest, and each manifest entry must be used exactly once
for (const [id, occurrences] of usedScreenshotIds.entries()) {
  if (!manifestMap.has(id)) {
    console.error(`[ERROR] Screenshot id "${id}" used at ${occurrences.map((o) => `${path.relative(rootDir, o.file)}:${o.lineNum}`).join(', ')} is not defined in manifest.json`);
    hasErrors = true;
  }
}

for (const id of manifestMap.keys()) {
  const usages = usedScreenshotIds.get(id);
  if (!usages || usages.length === 0) {
    console.error(`[ERROR] Manifest screenshot id "${id}" is not used in any markdown page.`);
    hasErrors = true;
  } else if (usages.length > 1) {
    console.error(`[ERROR] Manifest screenshot id "${id}" is used multiple times (${usages.length}): ${usages.map((o) => `${path.relative(rootDir, o.file)}:${o.lineNum}`).join(', ')}`);
    hasErrors = true;
  }
}

// 3. Check bold labels against src/
function readAllSourceFiles(dir) {
  let combined = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const dirent of list) {
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      combined = combined.concat(readAllSourceFiles(fullPath));
    } else if (dirent.isFile()) {
      try {
        combined.push({
          file: fullPath,
          content: fs.readFileSync(fullPath, 'utf8'),
        });
      } catch (err) {
        // ignore non-text files if any
      }
    }
  }
  return combined;
}

const remoteDir = path.join(rootDir, 'src-tauri', 'remote');
const srcFiles = [
  ...(fs.existsSync(srcDir) ? readAllSourceFiles(srcDir) : []),
  ...(fs.existsSync(remoteDir) ? readAllSourceFiles(remoteDir) : []),
];

let boldWarnings = 0;
for (const { label, file, lineNum } of boldLabels) {
  const found = srcFiles.some((sf) => sf.content.includes(label));
  if (!found) {
    console.warn(`[WARN] Bold label "**${label}**" at ${path.relative(rootDir, file)}:${lineNum} not found in src/`);
    boldWarnings++;
  }
}

// 4. Check existing vs missing PNGs
let existingPngs = 0;
let missingPngs = 0;

for (const id of manifestMap.keys()) {
  const pngPath = path.join(docsDir, 'screenshots', `${id}.png`);
  if (fs.existsSync(pngPath)) {
    existingPngs++;
  } else {
    missingPngs++;
  }
}

console.log(`\n--- docs:check summary ---`);
console.log(`Screenshots in manifest: ${manifestMap.size}`);
console.log(`PNG files: ${existingPngs} present, ${missingPngs} pending`);
console.log(`Bold label warnings: ${boldWarnings}`);

if (hasErrors) {
  console.error(`\n[FAIL] docs:check found errors.`);
  process.exit(1);
} else {
  console.log(`\n[PASS] docs:check completed successfully.`);
  process.exit(0);
}
