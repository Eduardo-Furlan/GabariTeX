import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TagInput } from '../src/components/bank/TagInput';
import { TagManagerModal } from '../src/components/bank/TagManagerModal';
import { QuestionEditorModal } from '../src/components/bank/QuestionEditorModal';
import { BankGroup, BankQuestion, BankTag } from '../src/types/bank';
import { validateBankQuestion } from '../src/utils/bank/questions';

describe('QuestionEditorModal, TagInput, and TagManagerModal (Plano 15 §6.2, Fase 4)', () => {
  const sampleGroups: BankGroup[] = [
    { id: 'g-mat', parentId: null, name: 'Matemática', order: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  ];

  const sampleTags: BankTag[] = [
    { id: 't1', name: 'Álgebra', color: 'blue', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    { id: 't2', name: 'Geometria', color: 'green', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  ];

  const sampleQuestion: BankQuestion = {
    id: 'q1',
    groupId: 'g-mat',
    type: 'objective',
    prompt: 'Qual o valor de $x$?',
    points: 2,
    options: [
      { id: 'o1', label: 'A', text: '1', isCorrect: true },
      { id: 'o2', label: 'B', text: '2', isCorrect: false },
    ],
    tagIds: ['t1'],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  it('TagInput renderiza tags selecionadas em SSR', () => {
    const html = renderToString(
      <TagInput
        selectedTagIds={['t1']}
        tags={sampleTags}
        onChange={() => {}}
      />
    );

    expect(html).toContain('Álgebra');
  });

  it('TagManagerModal renderiza em SSR sem erros', () => {
    expect(() =>
      renderToString(
        <TagManagerModal
          open={true}
          onOpenChange={() => {}}
          tags={sampleTags}
          questionCountByTag={new Map([['t1', 5]])}
          onRenameTag={async () => true}
          onUpdateColor={async () => true}
          onDeleteTag={async () => true}
          onMergeTag={async () => true}
        />
      )
    ).not.toThrow();
  });

  it('QuestionEditorModal renderiza em SSR sem erros para criação e edição', () => {
    expect(() =>
      renderToString(
        <QuestionEditorModal
          open={true}
          onOpenChange={() => {}}
          groups={sampleGroups}
          tags={sampleTags}
          onSave={async () => true}
        />
      )
    ).not.toThrow();

    expect(() =>
      renderToString(
        <QuestionEditorModal
          open={true}
          onOpenChange={() => {}}
          question={sampleQuestion}
          groups={sampleGroups}
          tags={sampleTags}
          onSave={async () => true}
        />
      )
    ).not.toThrow();
  });

  it('validateBankQuestion valida regras de domínio do editor', () => {
    // Vazio não é permitido
    expect(validateBankQuestion({ prompt: '' }).valid).toBe(false);

    // Objetiva precisa de 1 correta
    expect(
      validateBankQuestion({
        prompt: 'Texto',
        points: 1,
        type: 'objective',
        options: [
          { id: 'o1', label: 'A', text: '1', isCorrect: false },
          { id: 'o2', label: 'B', text: '2', isCorrect: false },
        ],
      }).valid
    ).toBe(false);

    // Objetiva válida
    expect(
      validateBankQuestion({
        prompt: 'Texto',
        points: 1,
        type: 'objective',
        options: [
          { id: 'o1', label: 'A', text: '1', isCorrect: true },
          { id: 'o2', label: 'B', text: '2', isCorrect: false },
        ],
      }).valid
    ).toBe(true);
  });
});
