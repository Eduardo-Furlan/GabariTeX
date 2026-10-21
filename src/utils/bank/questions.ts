import { BankQuestion, BankGroup, QuestionType } from '../../types/bank';
import { Question } from '../../types/exam';
import { generateBankId } from './ids';
import { descendantIds } from './tree';
import { getQuestionFigures, setQuestionFigures, figureKey } from './figures';

export interface QuestionValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a bank question according to domain constraints:
 * - Non-empty prompt
 * - Positive points with at most 2 decimal places
 * - At most 20 tags
 * - Objective: 2..5 options with strictly 1 correct
 * - Subjective: linesForAnswer >= 3
 */
export function validateBankQuestion(q: Partial<BankQuestion>): QuestionValidationResult {
  const errors: string[] = [];

  if (!q.prompt || !q.prompt.trim()) {
    errors.push('O enunciado da questão não pode ser vazio.');
  }

  if (q.points === undefined || typeof q.points !== 'number' || Number.isNaN(q.points) || q.points <= 0) {
    errors.push('A pontuação padrão da questão deve ser um número positivo.');
  } else {
    // Check up to 2 decimal places
    const rounded = Math.round(q.points * 100) / 100;
    if (Math.abs(q.points - rounded) > 1e-6) {
      errors.push('A pontuação deve ter no máximo 2 casas decimais.');
    }
  }

  if (q.tagIds && q.tagIds.length > 20) {
    errors.push('A questão pode ter no máximo 20 etiquetas.');
  }

  if (q.type === 'objective') {
    if (!q.options || q.options.length < 2 || q.options.length > 5) {
      errors.push('Questões objetivas devem ter entre 2 e 5 alternativas.');
    } else {
      const correctCount = q.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        errors.push('Questões objetivas devem ter exatamente uma alternativa correta assinalada.');
      }
    }
  } else if (q.type === 'subjective') {
    if (q.linesForAnswer !== undefined && (typeof q.linesForAnswer !== 'number' || q.linesForAnswer < 3)) {
      errors.push('Questões dissertativas devem ter pelo menos 3 linhas para resposta.');
    }
  } else if (!q.type) {
    errors.push('O tipo da questão deve ser definido (objetiva ou dissertativa).');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Normalized key for duplicate detection (prompt text + sorted option texts + figureKey).
 */
export function questionDuplicateKey(q: {
  prompt: string;
  options?: { text: string }[];
  [key: string]: any;
}): string {
  const normPrompt = q.prompt
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  const optKey = (q.options || [])
    .map((o) =>
      o.text
        .normalize('NFC')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase()
    )
    .sort()
    .join('|');

  const figKey = figureKey(q);

  return `${normPrompt}:::${optKey}:::${figKey}`;
}

/**
 * Converts a BankQuestion to an exam Question.
 * Keeps sourceQuestionId set to the bank question ID. Fresh question and option IDs
 * are handled when importing into an exam.
 */
export function toExamQuestion(bq: BankQuestion, pointsOverride?: number): Question {
  const q: Question = {
    id: bq.id,
    type: bq.type,
    prompt: bq.prompt,
    points: pointsOverride !== undefined ? pointsOverride : bq.points,
    options: bq.options ? bq.options.map((opt) => ({ ...opt })) : undefined,
    linesForAnswer: bq.linesForAnswer,
    sourceQuestionId: bq.id,
  };
  setQuestionFigures(q, getQuestionFigures(bq));
  return q;
}

/**
 * Converts an exam Question to a BankQuestion.
 */
export function fromExamQuestion(
  q: Question,
  groupId: string | null,
  tagIds: string[] = []
): BankQuestion {
  const now = new Date().toISOString();
  const bq: BankQuestion = {
    id: generateBankId(),
    groupId,
    type: q.type,
    prompt: q.prompt,
    points: q.points > 0 ? q.points : 1.0,
    options: q.options ? q.options.map((opt) => ({ ...opt })) : undefined,
    linesForAnswer: q.linesForAnswer,
    tagIds: tagIds.slice(0, 20),
    createdAt: now,
    updatedAt: now,
  };
  setQuestionFigures(bq, getQuestionFigures(q));
  return bq;
}

export type QuestionSortOrder = 'recent' | 'prompt' | 'most_used' | 'least_used';

export interface QuestionFilterOptions {
  /** 'all' (default) or undefined = whole bank; null = 'Sem Grupo'; string = specific groupId */
  groupId?: string | null | 'all';
  /** If groupId is a string, whether to include descendant groups (default true) */
  includeDescendants?: boolean;
  tagIds?: string[];
  tagMode?: 'all' | 'any';
  type?: QuestionType | 'all';
  includeArchived?: boolean;
  search?: string;
  sort?: QuestionSortOrder;
  /** Map of bank question id -> usage count in exams */
  usageCounts?: Map<string, number>;
}

/**
 * Filters and sorts questions for browsing in the bank screen.
 */
export function filterAndSortQuestions(
  questions: readonly BankQuestion[],
  groups: readonly BankGroup[],
  options: QuestionFilterOptions = {}
): BankQuestion[] {
  const {
    groupId = 'all',
    includeDescendants = true,
    tagIds = [],
    tagMode = 'all',
    type = 'all',
    includeArchived = false,
    search = '',
    sort = 'recent',
    usageCounts,
  } = options;

  let allowedGroupIds: Set<string | null> | null = null;
  if (groupId === null) {
    allowedGroupIds = new Set([null]);
  } else if (groupId !== 'all') {
    allowedGroupIds = new Set([groupId]);
    if (includeDescendants) {
      const descendants = descendantIds(groups, groupId);
      for (const d of descendants) {
        allowedGroupIds.add(d);
      }
    }
  }

  const searchTerms = search
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const filtered = questions.filter((q) => {
    // 1. Archived check
    if (!includeArchived && q.archived) {
      return false;
    }

    // 2. Group scope
    if (allowedGroupIds !== null && !allowedGroupIds.has(q.groupId)) {
      return false;
    }

    // 3. Question type
    if (type !== 'all' && q.type !== type) {
      return false;
    }

    // 4. Tags filter
    if (tagIds.length > 0) {
      const qTagSet = new Set(q.tagIds || []);
      if (tagMode === 'all') {
        for (const tId of tagIds) {
          if (!qTagSet.has(tId)) return false;
        }
      } else {
        // tagMode === 'any'
        let hasAny = false;
        for (const tId of tagIds) {
          if (qTagSet.has(tId)) {
            hasAny = true;
            break;
          }
        }
        if (!hasAny) return false;
      }
    }

    // 5. Text search (matches prompt, notes, or solution)
    if (searchTerms.length > 0) {
      const searchable = [q.prompt, q.notes || '', q.solution || '']
        .join(' ')
        .normalize('NFC')
        .toLowerCase();

      for (const term of searchTerms) {
        if (!searchable.includes(term)) return false;
      }
    }

    return true;
  });

  // Sort results
  filtered.sort((a, b) => {
    switch (sort) {
      case 'prompt':
        return a.prompt.localeCompare(b.prompt, 'pt-BR');
      case 'most_used': {
        const uA = usageCounts?.get(a.id) ?? 0;
        const uB = usageCounts?.get(b.id) ?? 0;
        if (uA !== uB) return uB - uA;
        return b.updatedAt.localeCompare(a.updatedAt);
      }
      case 'least_used': {
        const uA = usageCounts?.get(a.id) ?? 0;
        const uB = usageCounts?.get(b.id) ?? 0;
        if (uA !== uB) return uA - uB;
        return b.updatedAt.localeCompare(a.updatedAt);
      }
      case 'recent':
      default:
        return b.updatedAt.localeCompare(a.updatedAt);
    }
  });

  return filtered;
}
