import { BankGroup, BankTag } from '../../../types/bank';
import { pathOf } from '../tree';

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
  insertText: string;
  kind: 'keyword' | 'group' | 'tag' | 'type';
  detail?: string;
}

/**
 * Generates autocomplete suggestions at a given text offset.
 */
export function getSuggestions(
  input: string,
  offset: number,
  groups: readonly BankGroup[],
  tags: readonly BankTag[],
  lang: 'pt' | 'en' = 'pt'
): SuggestionItem[] {
  const beforeCursor = input.slice(0, Math.max(0, offset));
  const match = beforeCursor.match(/[\p{L}\p{N}_"-]*$/u);
  const prefix = match ? match[0].toLowerCase() : '';

  const allItems: SuggestionItem[] = [];

  // Keywords
  const ptKeywords = [
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

  const enKeywords = [
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

  const kwList = lang === 'pt' ? ptKeywords : enKeywords;
  for (const kw of kwList) {
    allItems.push({
      label: kw.label,
      insertText: kw.label,
      kind: 'keyword',
      detail: kw.detail,
    });
  }

  // Groups
  for (const g of groups) {
    const fullPath = pathOf(groups, g.id);
    const hasSpaces = fullPath.includes(' ');
    const insertText = hasSpaces ? `"${fullPath}"` : fullPath;
    allItems.push({
      label: fullPath,
      insertText,
      kind: 'group',
      detail: `Grupo: ${g.name}`,
    });
  }

  // Tags
  for (const t of tags) {
    const fn = lang === 'pt' ? 'etiqueta' : 'tag';
    allItems.push({
      label: `${fn}("${t.name}")`,
      insertText: `${fn}("${t.name}")`,
      kind: 'tag',
      detail: `Etiqueta: ${t.name}`,
    });
  }

  // Types
  const types = lang === 'pt'
    ? [
        { label: 'tipo("objetiva")', insertText: 'tipo("objetiva")', detail: 'Questões objetivas (múltipla escolha)' },
        { label: 'tipo("dissertativa")', insertText: 'tipo("dissertativa")', detail: 'Questões dissertativas' },
      ]
    : [
        { label: 'type("objective")', insertText: 'type("objective")', detail: 'Objective questions' },
        { label: 'type("subjective")', insertText: 'type("subjective")', detail: 'Subjective questions' },
      ];

  for (const ty of types) {
    allItems.push({
      label: ty.label,
      insertText: ty.insertText,
      kind: 'type',
      detail: ty.detail,
    });
  }

  if (!prefix) {
    return allItems;
  }

  return allItems.filter(
    (item) =>
      item.label.toLowerCase().includes(prefix) ||
      item.insertText.toLowerCase().includes(prefix)
  );
}
