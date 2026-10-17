import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const docsDir = path.join(rootDir, 'docs');
const manifestPath = path.join(docsDir, 'screenshots', 'manifest.json');
const checklistPath = path.join(docsDir, 'screenshots', 'CHECKLIST.md');

if (!fs.existsSync(manifestPath)) {
  console.error(`[ERROR] Manifest not found at ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const TARGET_ORDER = ['desktop', 'web', 'phone', 'windows'];

// Group by target
const groups = new Map();
for (const target of TARGET_ORDER) {
  groups.set(target, []);
}

for (const entry of manifest) {
  const t = entry.target || 'other';
  if (!groups.has(t)) {
    groups.set(t, []);
  }
  groups.get(t).push(entry);
}

// Order by page then number/id
for (const [target, list] of groups.entries()) {
  list.sort((a, b) => {
    if (a.page !== b.page) {
      return a.page.localeCompare(b.page);
    }
    return a.id.localeCompare(b.id);
  });
}

let totalCount = manifest.length;
let existingCount = 0;
const countsByTarget = {};

let md = '# Screenshot Checklist\n\n';
md += 'Este arquivo é gerado automaticamente por `npm run docs:screenshots`.\n';
md += 'Cada item indica o arquivo esperado, dados da tela, regras de captura e marcações necessárias.\n\n';

for (const [target, items] of groups.entries()) {
  if (items.length === 0) continue;

  let targetExisting = 0;
  for (const item of items) {
    const pngPath = path.join(docsDir, 'screenshots', `${item.id}.png`);
    if (fs.existsSync(pngPath)) {
      targetExisting++;
      existingCount++;
    }
  }
  countsByTarget[target] = { existing: targetExisting, total: items.length };

  md += `## Alvo: ${target} (${targetExisting}/${items.length})\n\n`;

  for (const item of items) {
    const pngPath = path.join(docsDir, 'screenshots', `${item.id}.png`);
    const exists = fs.existsSync(pngPath);
    const box = exists ? '[x]' : '[ ]';

    md += `### ${box} \`${item.id}.png\`\n\n`;
    md += `- **Página:** \`${item.page}.md\`\n`;
    md += `- **Posicionado após:** "${item.after}"\n`;
    md += `- **Janela:** \`${item.window}\`\n`;
    md += `- **Tela:** ${item.screen}\n`;
    md += `- **Estado:** ${item.state}\n`;
    md += `- **Passos:** ${item.setup}\n`;
    md += `- **Deve mostrar:** ${(item.mustShow || []).join('; ') || 'Nenhum'}\n`;
    md += `- **Não deve mostrar:** ${(item.mustNotShow || []).join('; ') || 'Nenhum'}\n`;
    md += `- **Corte:** ${item.crop}\n`;
    if (item.callouts && item.callouts.length > 0) {
      md += `- **Marcações (callouts):**\n`;
      for (const c of item.callouts) {
        md += `  ${c.n}. **[${c.target}]** → legenda: *"${c.label}"*\n`;
      }
    } else {
      md += `- **Marcações:** Nenhuma\n`;
    }
    md += `- **Texto alternativo (alt):** "${item.alt}"\n`;
    if (item.caption) {
      md += `- **Legenda (caption):** "${item.caption}"\n`;
    }
    md += '\n';
  }
}

fs.writeFileSync(checklistPath, md, 'utf8');

const targetSummary = Object.entries(countsByTarget)
  .map(([t, c]) => `${t}: ${c.existing}/${c.total}`)
  .join(', ');

console.log(`CHECKLIST.md gerado com sucesso: ${existingCount}/${totalCount} capturados (${targetSummary || 'sem capturas'}).`);
