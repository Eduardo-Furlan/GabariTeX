import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TagBadge, getTagColorClasses } from '../src/components/bank/TagBadge';
import { QuestionCard } from '../src/components/bank/QuestionCard';
import { QuestionList } from '../src/components/bank/QuestionList';
import { useWindowedList } from '../src/components/bank/useWindowedList';
import { BankGroup, BankQuestion, BankTag } from '../src/types/bank';

describe('QuestionList, QuestionCard, and TagBadge (Plano 15 §6.2, Fase 4)', () => {
  const sampleGroups: BankGroup[] = [
    { id: 'g-mat', parentId: null, name: 'Matemática', order: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    { id: 'g-geo', parentId: 'g-mat', name: 'Geometria', order: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  ];

  const sampleTags: BankTag[] = [
    { id: 't-facil', name: 'Fácil', color: 'green', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    { id: 't-dificil', name: 'Difícil', color: 'red', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  ];

  const sampleQuestions: BankQuestion[] = [
    {
      id: 'q1',
      groupId: 'g-mat',
      type: 'objective',
      prompt: 'Seja $x + 2 = 5$, determine o valor de $x$.',
      points: 2,
      options: [
        { id: 'o1', label: 'A', text: '1', isCorrect: false },
        { id: 'o2', label: 'B', text: '2', isCorrect: false },
        { id: 'o3', label: 'C', text: '3', isCorrect: true },
        { id: 'o4', label: 'D', text: '4', isCorrect: false },
      ],
      tagIds: ['t-facil'],
      createdAt: '2026-01-01T10:00:00Z',
      updatedAt: '2026-01-01T10:00:00Z',
    },
    {
      id: 'q2',
      groupId: 'g-geo',
      type: 'subjective',
      prompt: 'Demonstre o Teorema de Pitágoras.',
      points: 5,
      linesForAnswer: 8,
      tagIds: ['t-dificil'],
      archived: true,
      createdAt: '2026-01-02T10:00:00Z',
      updatedAt: '2026-01-02T10:00:00Z',
    },
  ];

  it('TagBadge renderiza nome, contador e classes corretas', () => {
    const html = renderToString(
      <TagBadge name="Fácil" color="green" count={5} />
    );
    expect(html).toContain('Fácil');
    expect(html).toContain('(5)');

    const classes = getTagColorClasses('green', false);
    expect(classes.badge).toContain('bg-emerald-50');
  });

  it('QuestionCard renderiza informações essenciais em SSR', () => {
    const tagsById = new Map(sampleTags.map((t) => [t.id, t]));
    const html = renderToString(
      <QuestionCard
        question={sampleQuestions[0]}
        tagsById={tagsById}
        usageCount={3}
        selected={true}
      />
    );

    expect(html).toContain('Objetiva (4 alt.)');
    expect(html).toContain('2 pts');
    expect(html).toContain('Usada em 3 provas');
    expect(html).toContain('Fácil');
  });

  it('QuestionList renderiza lista e controles em SSR sem erros', () => {
    const html = renderToString(
      <QuestionList
        questions={sampleQuestions}
        groups={sampleGroups}
        tags={sampleTags}
        usageCounts={new Map([['q1', 3]])}
        selectedGroup={{ kind: 'all' }}
        selectedQuestionIds={new Set(['q1'])}
        onToggleSelectQuestion={() => {}}
        onSelectAllQuestions={() => {}}
        onClearQuestionSelection={() => {}}
        onEditQuestion={() => {}}
        onDuplicateQuestion={() => {}}
        onMoveQuestion={() => {}}
        onArchiveToggleQuestion={() => {}}
        onDeleteQuestion={() => {}}
      />
    );

    expect(html).toContain('Buscar no enunciado da questão...');
    expect(html).toContain('Todas as Questões');
    expect(html).toContain('Etiquetas:');
    expect(html).toContain('Fácil');
  });
});
