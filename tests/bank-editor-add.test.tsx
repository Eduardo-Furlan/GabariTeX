import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { AddFromBankModal } from '../src/components/editor/AddFromBankModal';
import { BankProvider } from '../src/context/BankContext';
import { BankGroup, BankQuestion } from '../src/types/bank';
import { Question } from '../src/types/exam';
import { toExamQuestion } from '../src/utils/bank/questions';

describe('AddFromBankModal (Plano 15 §6.3, Fase 5 Step 1)', () => {
  const sampleGroups: BankGroup[] = [
    { id: 'g1', parentId: null, name: 'Biologia', order: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  ];

  const sampleBankQuestions: BankQuestion[] = [
    {
      id: 'bq-genetica',
      groupId: 'g1',
      type: 'objective',
      prompt: 'Explique a Primeira Lei de Mendel.',
      points: 2.5,
      options: [
        { id: 'o1', label: 'A', text: 'Segregação dos fatores', isCorrect: true },
        { id: 'o2', label: 'B', text: 'Ligação gênica', isCorrect: false },
      ],
      tagIds: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  const currentExamQuestions: Question[] = [
    {
      id: 'eq-1',
      type: 'objective',
      prompt: 'Outra questão',
      points: 1,
      sourceQuestionId: 'bq-genetica',
    },
  ];

  it('toExamQuestion vincula sourceQuestionId ao ID da questão do banco', () => {
    const examQ = toExamQuestion(sampleBankQuestions[0]);
    expect(examQ.sourceQuestionId).toBe('bq-genetica');
    expect(examQ.prompt).toBe('Explique a Primeira Lei de Mendel.');
    expect(examQ.points).toBe(2.5);
    expect(examQ.type).toBe('objective');
    expect(examQ.options?.length).toBe(2);
  });

  it('AddFromBankModal renderiza em SSR sem erros', () => {
    expect(() =>
      renderToString(
        <BankProvider initialData={{ groups: sampleGroups, questions: sampleBankQuestions }}>
          <AddFromBankModal
            isOpen={true}
            onClose={() => {}}
            currentQuestions={currentExamQuestions}
            onImport={() => 0}
          />
        </BankProvider>
      )
    ).not.toThrow();
  });
});
