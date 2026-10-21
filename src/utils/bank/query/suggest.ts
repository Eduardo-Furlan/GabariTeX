import { BankGroup, BankTag } from '../../../types/bank';
import { pathOf } from '../tree';
import { foldAccents } from './lexer';
import { needsQuotes } from './printer';

/**
 * Computes Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];
  for (let i = 0; i <= bn; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1).toLowerCase() === a.charAt(j - 1).toLowerCase()) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[bn][an];
}

/**
 * Finds closest match among candidate list within maxDistance (default 2).
 */
export function findClosestMatch(
  query: string,
  candidates: readonly string[],
  maxDistance = 2
): string | null {
  let closest: string | null = null;
  let minDistance = maxDistance + 1;

  for (const candidate of candidates) {
    const dist = levenshteinDistance(query, candidate);
    if (dist < minDistance) {
      minDistance = dist;
      closest = candidate;
    }
  }

  return minDistance <= maxDistance ? closest : null;
}

export interface SuggestionItem {
  label: string;
  /** Text that replaces the word being typed (may include quotes/parentheses). */
  insertText: string;
  kind: 'keyword' | 'group' | 'tag' | 'type';
  detail?: string;
  /** Append a trailing space after insertion (unless one is already there). */
  appendSpace?: boolean;
}

export interface CompletionResult {
  /** Start (inclusive) of the range that accepting a suggestion replaces. */
  from: number;
  /** End (exclusive) of the range that accepting a suggestion replaces. */
  to: number;
  items: SuggestionItem[];
}

export interface CompletionOptions {
  /** Offer suggestions even when nothing has been typed yet (Ctrl+Space). */
  force?: boolean;
  limit?: number;
}

const WORD_CHAR = /[\p{L}\p{N}_/-]/u;
const FUNCTION_KEYWORDS = new Set(['etiqueta', 'tag', 'tipo', 'type']);

function escapeString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Index of the opening quote of the string literal the caret is inside, or -1. */
function openStringStart(input: string, caret: number): number {
  let start = -1;
  for (let i = 0; i < caret; i++) {
    const c = input[i];
    if (c === '\n') {
      start = -1;
    } else if (start >= 0) {
      if (c === '\\') i++;
      else if (c === '"') start = -1;
    } else if (c === '"') {
      start = i;
    }
  }
  return start;
}

/** Detects `etiqueta(` / `tag(` / `tipo(` / `type(` right before the typed word. */
function detectArgKind(before: string): 'tag' | 'type' | null {
  const m = /(etiqueta|tag|tipo|type)\s*\(\s*$/i.exec(before);
  if (!m) return null;
  const fn = m[1].toLowerCase();
  return fn === 'etiqueta' || fn === 'tag' ? 'tag' : 'type';
}

/** Lower is better; null = no match. Accent- and case-insensitive. */
function scoreMatch(label: string, token: string): number | null {
  const l = foldAccents(label);
  const t = foldAccents(token);
  if (!t) return 0;
  if (l.startsWith(t)) return 0;

  if (t.includes('/')) {
    // Segment-wise prefix match: "mat/geo" matches "Matemática/Geometria/Plana"
    const labelSegs = l.split('/');
    const parts = t.split('/');
    for (let i = 0; i + parts.length <= labelSegs.length; i++) {
      if (parts.every((part, k) => labelSegs[i + k].startsWith(part))) return i === 0 ? 0 : 1;
    }
  }

  const idx = l.indexOf(t);
  if (idx === -1) return null;
  const prev = l[idx - 1];
  if (prev === '/' || prev === ' ' || prev === '(' || prev === '"') return 1;
  return 2;
}

const KIND_RANK: Record<SuggestionItem['kind'], number> = {
  keyword: 0,
  tag: 1,
  type: 1,
  group: 2,
};

function rank(items: SuggestionItem[], token: string): SuggestionItem[] {
  const scored: Array<{ item: SuggestionItem; score: number; kind: number }> = [];
  for (const item of items) {
    const score = scoreMatch(item.label, token);
    if (score === null) continue;
    const isFn = item.kind === 'keyword' && FUNCTION_KEYWORDS.has(item.label.toLowerCase());
    scored.push({ item, score, kind: isFn ? 5 : KIND_RANK[item.kind] });
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.kind - b.kind ||
      a.item.label.length - b.item.label.length ||
      a.item.label.localeCompare(b.item.label, 'pt-BR')
  );
  return scored.map((s) => s.item);
}

function typeValues(lang: 'pt' | 'en'): Array<{ value: string; detail: string }> {
  return lang === 'pt'
    ? [
        { value: 'objetiva', detail: 'Questões objetivas (múltipla escolha)' },
        { value: 'dissertativa', detail: 'Questões dissertativas' },
      ]
    : [
        { value: 'objective', detail: 'Objective questions' },
        { value: 'subjective', detail: 'Subjective questions' },
      ];
}

function keywordItems(lang: 'pt' | 'en'): SuggestionItem[] {
  const pt = [
    { label: 'DE', detail: 'Inicia um bloco de regras' },
    { label: 'INCLUIR', detail: 'Lista de cotas de questões' },
    { label: 'OU', detail: 'União de origens' },
    { label: 'E', detail: 'Interseção / Cobertura de origens' },
    { label: 'XOU', detail: 'Origem exclusiva (exatamente uma)' },
    { label: 'EXCETO', detail: 'Subtrai uma origem de outra' },
    { label: 'SOMENTE', detail: 'Apenas questões diretas do grupo (sem subgrupos)' },
    { label: 'TODAS', detail: 'Banco inteiro' },
    { label: 'PONTOS', detail: 'Sobrescreve a pontuação da cota ou bloco' },
    { label: 'NÃO', detail: 'Nega uma etiqueta' },
    { label: 'etiqueta', detail: 'Filtro por etiqueta' },
    { label: 'tipo', detail: 'Filtro por tipo de questão' },
  ];
  const en = [
    { label: 'FROM', detail: 'Starts a rule block' },
    { label: 'INCLUDE', detail: 'List of question quotas' },
    { label: 'OR', detail: 'Union of sources' },
    { label: 'AND', detail: 'Coverage / Intersection' },
    { label: 'XOR', detail: 'Exclusive source' },
    { label: 'EXCEPT', detail: 'Subtracts a source' },
    { label: 'ONLY', detail: 'Direct group questions only' },
    { label: 'ALL', detail: 'Entire question bank' },
    { label: 'POINTS', detail: 'Overrides points' },
    { label: 'NOT', detail: 'Negates a tag' },
    { label: 'tag', detail: 'Filter by tag' },
    { label: 'type', detail: 'Filter by question type' },
  ];
  return (lang === 'pt' ? pt : en).map((kw) => {
    const isFn = FUNCTION_KEYWORDS.has(kw.label.toLowerCase());
    return {
      label: kw.label,
      // Function-like keywords open their string argument so tag/type completion follows.
      insertText: isFn ? `${kw.label}("` : kw.label,
      kind: 'keyword' as const,
      detail: kw.detail,
      appendSpace: !isFn,
    };
  });
}

/**
 * Real autocomplete: finds the word being typed at `offset` and returns the range to
 * replace plus ranked suggestions. Accent/case-insensitive, understands group paths
 * (`Mat/Geo`), quoted strings and the arguments of `etiqueta(...)` / `tipo(...)`.
 */
export function getCompletions(
  input: string,
  offset: number,
  groups: readonly BankGroup[],
  tags: readonly BankTag[],
  lang: 'pt' | 'en' = 'pt',
  options: CompletionOptions = {}
): CompletionResult {
  const caret = Math.min(Math.max(0, offset), input.length);
  const limit = options.limit ?? 12;
  const none: CompletionResult = { from: caret, to: caret, items: [] };

  const strStart = openStringStart(input, caret);
  const inString = strStart >= 0;

  let from: number;
  let to = caret;
  let token: string;
  let argKind: 'tag' | 'type' | null;

  if (inString) {
    from = strStart;
    token = input.slice(strStart + 1, caret);
    argKind = detectArgKind(input.slice(0, strStart));
    if (input[caret] === '"') to = caret + 1; // consume an existing closing quote
  } else {
    let i = caret;
    while (i > 0 && WORD_CHAR.test(input[i - 1])) i--;
    from = i;
    token = input.slice(i, caret);
    argKind = detectArgKind(input.slice(0, from));
  }

  const finish = (items: SuggestionItem[]): CompletionResult => {
    const current = input.slice(from, to);
    const seen = new Set<string>();
    const out: SuggestionItem[] = [];
    for (const item of items) {
      if (item.insertText === current) continue; // already fully typed
      const key = `${item.kind}:${item.insertText}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= limit) break;
    }
    return { from, to, items: out };
  };

  // Inside etiqueta( ... ) or tipo( ... ): complete the argument only.
  if (argKind) {
    const closer = input[to] === ')' ? '' : ')';
    const pool: SuggestionItem[] =
      argKind === 'tag'
        ? tags.map((t) => ({
            label: t.name,
            insertText: `"${escapeString(t.name)}"${closer}`,
            kind: 'tag' as const,
            detail: 'Etiqueta',
          }))
        : typeValues(lang).map((v) => ({
            label: v.value,
            insertText: `"${v.value}"${closer}`,
            kind: 'type' as const,
            detail: v.detail,
          }));
    return finish(rank(pool, token));
  }

  // Inside a plain string literal: only group paths make sense.
  if (inString) {
    const pool: SuggestionItem[] = groups.map((g) => {
      const fullPath = pathOf(groups, g.id);
      return {
        label: fullPath,
        insertText: `"${escapeString(fullPath)}"`,
        kind: 'group' as const,
        detail: `Grupo: ${g.name}`,
        appendSpace: true,
      };
    });
    return finish(rank(pool, token));
  }

  // Free text. Nothing typed (or only digits, i.e. a quota count): stay quiet unless forced.
  if (/^\p{N}+$/u.test(token)) return none;
  if (!token && !options.force) return none;

  const pool: SuggestionItem[] = [...keywordItems(lang)];

  for (const g of groups) {
    const fullPath = pathOf(groups, g.id);
    pool.push({
      label: fullPath,
      insertText: needsQuotes(fullPath) ? `"${escapeString(fullPath)}"` : fullPath,
      kind: 'group',
      detail: `Grupo: ${g.name}`,
      appendSpace: true,
    });
  }

  const fn = lang === 'pt' ? 'etiqueta' : 'tag';
  for (const t of tags) {
    const call = `${fn}("${escapeString(t.name)}")`;
    pool.push({ label: call, insertText: call, kind: 'tag', detail: `Etiqueta: ${t.name}`, appendSpace: true });
  }

  const typeFn = lang === 'pt' ? 'tipo' : 'type';
  for (const v of typeValues(lang)) {
    const call = `${typeFn}("${v.value}")`;
    pool.push({ label: call, insertText: call, kind: 'type', detail: v.detail, appendSpace: true });
  }

  return finish(rank(pool, token));
}

/**
 * Applies a suggestion to `text`, replacing [from, to). Returns the new text and the
 * caret position right after the inserted text.
 */
export function applyCompletion(
  text: string,
  from: number,
  to: number,
  item: SuggestionItem
): { text: string; caret: number } {
  let insert = item.insertText;
  if (item.appendSpace) {
    const next = text[to];
    if (next === undefined || !/[\s),]/.test(next)) insert += ' ';
  }
  return {
    text: text.slice(0, from) + insert + text.slice(to),
    caret: from + insert.length,
  };
}

/**
 * Generates autocomplete suggestions at a given text offset.
 * Kept for API compatibility; prefer getCompletions, which also reports the replace range.
 */
export function getSuggestions(
  input: string,
  offset: number,
  groups: readonly BankGroup[],
  tags: readonly BankTag[],
  lang: 'pt' | 'en' = 'pt'
): SuggestionItem[] {
  return getCompletions(input, offset, groups, tags, lang, { force: true, limit: Number.MAX_SAFE_INTEGER }).items;
}
