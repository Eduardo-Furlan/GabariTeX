import {
  RuleBlock,
  SourceExpr,
  QuotaLine,
  BankGroup,
  BankTag,
} from '../../../types/bank';
import { pathOf } from '../tree';

export interface PrintOptions {
  lang?: 'pt' | 'en';
}

function needsQuotes(path: string): boolean {
  // If path contains space or characters outside word characters and slash, or is a keyword
  if (/\s/.test(path)) return true;
  if (/["'(),.]/.test(path)) return true;
  return false;
}

function formatGroupPath(groupId: string, groups: readonly BankGroup[]): string {
  const g = groups.find((item) => item.id === groupId);
  if (!g) {
    return `"@GRUPO_EXCLUIDO_${groupId}"`;
  }
  const p = pathOf(groups, groupId);
  return needsQuotes(p) ? `"${p}"` : p;
}

function formatSourceExpr(
  expr: SourceExpr,
  groups: readonly BankGroup[],
  lang: 'pt' | 'en'
): string {
  switch (expr.kind) {
    case 'all':
      return lang === 'pt' ? 'TODAS' : 'ALL';

    case 'group': {
      const pathStr = formatGroupPath(expr.groupId, groups);
      if (!expr.descendants) {
        const onlyKw = lang === 'pt' ? 'SOMENTE' : 'ONLY';
        return `${onlyKw} ${pathStr}`;
      }
      return pathStr;
    }

    case 'or': {
      const opKw = lang === 'pt' ? 'OU' : 'OR';
      const inner = expr.operands
        .map((op) => formatSourceExpr(op, groups, lang))
        .join(` ${opKw} `);
      return `(${inner})`;
    }

    case 'and': {
      const opKw = lang === 'pt' ? 'E' : 'AND';
      const inner = expr.operands
        .map((op) => formatSourceExpr(op, groups, lang))
        .join(` ${opKw} `);
      return `(${inner})`;
    }

    case 'xor': {
      const opKw = lang === 'pt' ? 'XOU' : 'XOR';
      const inner = expr.operands
        .map((op) => formatSourceExpr(op, groups, lang))
        .join(` ${opKw} `);
      return `(${inner})`;
    }

    case 'except': {
      const exceptKw = lang === 'pt' ? 'EXCETO' : 'EXCEPT';
      const baseStr = formatSourceExpr(expr.base, groups, lang);
      const excludedStr = formatSourceExpr(expr.excluded, groups, lang);
      return `(${baseStr} ${exceptKw} ${excludedStr})`;
    }
  }
}

function formatTagName(tagId: string, tags: readonly BankTag[]): string {
  const t = tags.find((item) => item.id === tagId);
  if (!t) {
    return `@ETIQUETA_EXCLUIDA_${tagId}`;
  }
  return t.name;
}

function formatQuotaLine(
  quota: QuotaLine,
  tags: readonly BankTag[],
  lang: 'pt' | 'en'
): string {
  const parts: string[] = [`${quota.count}`];
  const tagKw = lang === 'pt' ? 'etiqueta' : 'tag';
  const typeKw = lang === 'pt' ? 'tipo' : 'type';
  const notKw = lang === 'pt' ? 'NÃO' : 'NOT';
  const andKw = lang === 'pt' ? 'E' : 'AND';
  const pointsKw = lang === 'pt' ? 'PONTOS' : 'POINTS';

  const predicates: string[] = [];

  for (const tid of quota.filter.tagIds) {
    const tName = formatTagName(tid, tags);
    predicates.push(`${tagKw}("${tName}")`);
  }

  for (const tid of quota.filter.notTagIds) {
    const tName = formatTagName(tid, tags);
    predicates.push(`${notKw} ${tagKw}("${tName}")`);
  }

  if (quota.filter.type) {
    const val =
      lang === 'pt'
        ? quota.filter.type === 'objective'
          ? 'objetiva'
          : 'dissertativa'
        : quota.filter.type === 'objective'
        ? 'objective'
        : 'subjective';
    predicates.push(`${typeKw}("${val}")`);
  }

  if (predicates.length > 0) {
    parts.push(predicates.join(` ${andKw} `));
  } else {
    // Bare count: add "questões" / "questions" for readability
    parts.push(lang === 'pt' ? 'questões' : 'questions');
  }

  if (quota.points !== undefined) {
    parts.push(`${pointsKw} ${quota.points}`);
  }

  return parts.join(' ');
}

/**
 * Prints a list of rule blocks in canonical query text.
 */
export function print(
  blocks: readonly RuleBlock[],
  groups: readonly BankGroup[],
  tags: readonly BankTag[],
  options: PrintOptions = {}
): string {
  const lang = options.lang || 'pt';
  const fromKw = lang === 'pt' ? 'DE' : 'FROM';
  const includeKw = lang === 'pt' ? 'INCLUIR' : 'INCLUDE';
  const pointsKw = lang === 'pt' ? 'PONTOS' : 'POINTS';

  const blockStrings: string[] = [];

  for (const block of blocks) {
    let sourceStr = formatSourceExpr(block.source, groups, lang);
    // Strip unnecessary outer parentheses for top-level source
    if (sourceStr.startsWith('(') && sourceStr.endsWith(')')) {
      sourceStr = sourceStr.slice(1, -1);
    }

    let header = `${fromKw} ${sourceStr}`;
    if (block.points !== undefined) {
      header += ` ${pointsKw} ${block.points}`;
    }

    const quotaLines = block.quotas.map((q) => formatQuotaLine(q, tags, lang));
    const quotasStr = quotaLines.join(', ');

    blockStrings.push(`${header}\n  ${includeKw} ${quotasStr}`);
  }

  return blockStrings.join('\n\n');
}
