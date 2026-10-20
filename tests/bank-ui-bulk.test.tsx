import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { BulkActionsBar } from '../src/components/bank/BulkActionsBar';
import { BankGroup, BankQuestion, BankTag } from '../src/types/bank';

describe('BulkActionsBar (Plano 15 §6.2, Fase 4)', () => {
  const sampleGroups: BankGroup[] = [
    { id: 'g1', parentId: null, name: 'Geral', order: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  ];

  const sampleTags: BankTag[] = [
    { id: 't1', name: 'Importante', color: 'blue', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  ];

  const sampleQuestions: BankQuestion[] = [
    {
      id: 'q1',
      groupId: 'g1',
      type: 'objective',
      prompt: 'Questão 1',
      points: 1,
      tagIds: ['t1'],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'q2',
      groupId: 'g1',
      type: 'objective',
      prompt: 'Questão 2',
      points: 2,
      tagIds: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  it('não renderiza nada quando nenhuma questão está selecionada', () => {
    const html = renderToString(
      <BulkActionsBar
        selectedQuestionIds={new Set()}
        questions={sampleQuestions}
        groups={sampleGroups}
        tags={sampleTags}
        onClearSelection={() => {}}
        onMoveQuestions={async () => true}
        onApplyTags={async () => true}
        onArchiveToggle={async () => true}
        onDeleteQuestions={async () => true}
      />
    );

    expect(html).toBe('');
  });

  it('renderiza contador e botões de ação quando há seleção', () => {
    const html = renderToString(
      <BulkActionsBar
        selectedQuestionIds={new Set(['q1', 'q2'])}
        questions={sampleQuestions}
        groups={sampleGroups}
        tags={sampleTags}
        onClearSelection={() => {}}
        onMoveQuestions={async () => true}
        onApplyTags={async () => true}
        onArchiveToggle={async () => true}
        onDeleteQuestions={async () => true}
      />
    );

    expect(html).toContain('2');
    expect(html).toContain('questões selecionadas');
    expect(html).toContain('Mover');
    expect(html).toContain('Etiquetar');
    expect(html).toContain('Arquivar');
    expect(html).toContain('Excluir');
  });
});
