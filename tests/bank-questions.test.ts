import { describe, it, expect } from 'vitest';
import {
  validateBankQuestion,
  questionDuplicateKey,
  toExamQuestion,
  fromExamQuestion,
  filterAndSortQuestions,
} from '../src/utils/bank/questions';
import { BankQuestion, BankGroup } from '../src/types/bank';
import { Question } from '../src/types/exam';

describe('Bank Questions (src/utils/bank/questions.ts)', () => {
  const sampleGroups: BankGroup[] = [
    {
      id: 'grp-root',
      parentId: null,
      name: 'Matemática',
      order: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'grp-sub',
      parentId: 'grp-root',
      name: 'Geometria',
      order: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  const qObj1: BankQuestion = {
    id: 'bq-1',
    groupId: 'grp-sub',
    type: 'objective',
    prompt: 'Qual o valor de $\\pi$?',
    points: 1.5,
    options: [
      { id: 'opt-1', label: 'A', text: '3.14', isCorrect: true },
      { id: 'opt-2', label: 'B', text: '2.71', isCorrect: false },
    ],
    tagIds: ['tag-easy', 'tag-math'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };

  const qSubj1: BankQuestion = {
    id: 'bq-2',
    groupId: 'grp-root',
    type: 'subjective',
    prompt: 'Demonstre o Teorema de Pitágoras.',
    points: 3.0,
    linesForAnswer: 10,
    tagIds: ['tag-hard', 'tag-math'],
    createdAt: '2026-01-03T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z',
  };

  const qArchived: BankQuestion = {
    id: 'bq-3',
    groupId: null,
    type: 'objective',
    prompt: 'Questão legada arquivada',
    points: 1.0,
    options: [
      { id: 'opt-a', label: 'A', text: 'Sim', isCorrect: true },
      { id: 'opt-b', label: 'B', text: 'Não', isCorrect: false },
    ],
    tagIds: ['tag-legacy'],
    archived: true,
    createdAt: '2026-01-04T00:00:00.000Z',
    updatedAt: '2026-01-04T00:00:00.000Z',
  };

  const allQuestions: BankQuestion[] = [qObj1, qSubj1, qArchived];

  describe('validateBankQuestion', () => {
    it('validates a valid objective question', () => {
      const res = validateBankQuestion(qObj1);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('validates a valid subjective question', () => {
      const res = validateBankQuestion(qSubj1);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('rejects empty prompt and non-positive points', () => {
      const res = validateBankQuestion({
        ...qObj1,
        prompt: '   ',
        points: -1,
      });
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('O enunciado da questão não pode ser vazio.');
      expect(res.errors).toContain('A pontuação padrão da questão deve ser um número positivo.');
    });

    it('rejects more than 2 decimal places in points', () => {
      const res = validateBankQuestion({
        ...qObj1,
        points: 1.255,
      });
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('A pontuação deve ter no máximo 2 casas decimais.');
    });

    it('rejects objective questions without exactly 1 correct option or invalid option counts', () => {
      const zeroCorrect = validateBankQuestion({
        ...qObj1,
        options: [
          { id: '1', label: 'A', text: 'a', isCorrect: false },
          { id: '2', label: 'B', text: 'b', isCorrect: false },
        ],
      });
      expect(zeroCorrect.valid).toBe(false);
      expect(zeroCorrect.errors).toContain(
        'Questões objetivas devem ter exatamente uma alternativa correta assinalada.'
      );

      const oneOption = validateBankQuestion({
        ...qObj1,
        options: [{ id: '1', label: 'A', text: 'a', isCorrect: true }],
      });
      expect(oneOption.valid).toBe(false);
      expect(oneOption.errors).toContain('Questões objetivas devem ter entre 2 e 5 alternativas.');
    });

    it('rejects subjective question with fewer than 3 lines', () => {
      const res = validateBankQuestion({
        ...qSubj1,
        linesForAnswer: 2,
      });
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('Questões dissertativas devem ter pelo menos 3 linhas para resposta.');
    });
  });

  describe('questionDuplicateKey', () => {
    it('generates identical key for normalized matching prompt and options', () => {
      const k1 = questionDuplicateKey({
        prompt: 'Qual o valor de x?  ',
        options: [{ text: '2' }, { text: '1' }],
      });
      const k2 = questionDuplicateKey({
        prompt: '  qual o valor de X? ',
        options: [{ text: '1' }, { text: '2' }], // different order, same content
      });
      expect(k1).toBe(k2);
    });

    it('questions that differ only by figure must not be flagged as duplicates', () => {
      const base = {
        prompt: 'Calcule a área da figura abaixo:',
        options: [{ text: '10' }, { text: '20' }],
      };

      const qNoFigure = questionDuplicateKey({ ...base });
      const qFig1 = questionDuplicateKey({
        ...base,
        imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      });
      const qFig2 = questionDuplicateKey({
        ...base,
        imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M9QzwAEjDAGACGGAf5phhQAAAAASUVORK5CYII=',
      });

      // Different figures produce distinct duplicate keys
      expect(qFig1).not.toBe(qFig2);
      expect(qFig1).not.toBe(qNoFigure);
      expect(qFig2).not.toBe(qNoFigure);

      // Same figure produces identical duplicate key
      const qFig1Duplicate = questionDuplicateKey({
        ...base,
        imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      });
      expect(qFig1).toBe(qFig1Duplicate);
    });
  });

  describe('toExamQuestion & fromExamQuestion', () => {
    it('toExamQuestion converts correctly and preserves sourceQuestionId', () => {
      const examQ = toExamQuestion(qObj1);
      expect(examQ.id).toBe(qObj1.id);
      expect(examQ.sourceQuestionId).toBe(qObj1.id);
      expect(examQ.points).toBe(1.5);
      expect(examQ.prompt).toBe(qObj1.prompt);
    });

    it('toExamQuestion supports points override', () => {
      const examQ = toExamQuestion(qObj1, 2.5);
      expect(examQ.points).toBe(2.5);
    });

    it('fromExamQuestion creates bank question with new ID and timestamps', () => {
      const examQ: Question = {
        id: 'q-exam-123',
        type: 'objective',
        prompt: 'Enunciado de teste',
        points: 2.0,
        options: [{ id: 'opt-1', label: 'A', text: 'Sim', isCorrect: true }],
      };
      const bq = fromExamQuestion(examQ, 'grp-sub', ['tag-math']);
      expect(bq.id).not.toBe(examQ.id);
      expect(bq.groupId).toBe('grp-sub');
      expect(bq.tagIds).toEqual(['tag-math']);
      expect(bq.points).toBe(2.0);
    });
  });

  describe('filterAndSortQuestions', () => {
    it('filters out archived questions by default', () => {
      const res = filterAndSortQuestions(allQuestions, sampleGroups, { includeArchived: false });
      expect(res.some((q) => q.id === 'bq-3')).toBe(false);
    });

    it('includes archived questions when requested', () => {
      const res = filterAndSortQuestions(allQuestions, sampleGroups, { includeArchived: true });
      expect(res.some((q) => q.id === 'bq-3')).toBe(true);
    });

    it('filters by group scope with descendants', () => {
      // Root includes bq-2 (direct) and bq-1 (in grp-sub)
      const res = filterAndSortQuestions(allQuestions, sampleGroups, {
        groupId: 'grp-root',
        includeDescendants: true,
      });
      expect(res.map((q) => q.id).sort()).toEqual(['bq-1', 'bq-2']);

      // Without descendants
      const resDirect = filterAndSortQuestions(allQuestions, sampleGroups, {
        groupId: 'grp-root',
        includeDescendants: false,
      });
      expect(resDirect.map((q) => q.id)).toEqual(['bq-2']);
    });

    it('filters by "Sem Grupo" (null)', () => {
      const res = filterAndSortQuestions(allQuestions, sampleGroups, {
        groupId: null,
        includeArchived: true,
      });
      expect(res.map((q) => q.id)).toEqual(['bq-3']);
    });

    it('filters by tags (all vs any)', () => {
      const allMode = filterAndSortQuestions(allQuestions, sampleGroups, {
        tagIds: ['tag-math', 'tag-easy'],
        tagMode: 'all',
      });
      expect(allMode.map((q) => q.id)).toEqual(['bq-1']);

      const anyMode = filterAndSortQuestions(allQuestions, sampleGroups, {
        tagIds: ['tag-easy', 'tag-hard'],
        tagMode: 'any',
      });
      expect(anyMode.map((q) => q.id).sort()).toEqual(['bq-1', 'bq-2']);
    });

    it('filters by type', () => {
      const res = filterAndSortQuestions(allQuestions, sampleGroups, { type: 'subjective' });
      expect(res.map((q) => q.id)).toEqual(['bq-2']);
    });

    it('filters by search keyword', () => {
      const res = filterAndSortQuestions(allQuestions, sampleGroups, { search: 'pitágoras' });
      expect(res.map((q) => q.id)).toEqual(['bq-2']);
    });

    it('sorts by prompt', () => {
      const res = filterAndSortQuestions(allQuestions, sampleGroups, { sort: 'prompt' });
      expect(res[0].prompt).toBe('Demonstre o Teorema de Pitágoras.');
      expect(res[1].prompt).toBe('Qual o valor de $\\pi$?');
    });

    it('sorts by usage count', () => {
      const usage = new Map<string, number>([
        ['bq-1', 5],
        ['bq-2', 1],
      ]);
      const mostUsed = filterAndSortQuestions(allQuestions, sampleGroups, {
        sort: 'most_used',
        usageCounts: usage,
      });
      expect(mostUsed[0].id).toBe('bq-1');
      expect(mostUsed[1].id).toBe('bq-2');

      const leastUsed = filterAndSortQuestions(allQuestions, sampleGroups, {
        sort: 'least_used',
        usageCounts: usage,
      });
      expect(leastUsed[0].id).toBe('bq-2');
      expect(leastUsed[1].id).toBe('bq-1');
    });
  });
});
