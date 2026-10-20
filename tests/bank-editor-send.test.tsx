import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SendToBankModal } from '../src/components/editor/SendToBankModal';
import { QuestionEditor } from '../src/components/editor/QuestionEditor';
import { BankProvider } from '../src/context/BankContext';
import { BankGroup, BankQuestion } from '../src/types/bank';
import { Question } from '../src/types/exam';
import {
  fromExamQuestion,
  questionDuplicateKey,
} from '../src/utils/bank/questions';

describe('SendToBankModal & Bank Markers (Plano 15 §6.3, Fase 5 Step 2 & 3)', () => {
  const sampleGroups: BankGroup[] = [
    { id: 'g-quim', parentId: null, name: 'Química', order: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  ];

  const sampleBankQuestions: BankQuestion[] = [
    {
      id: 'bq-termo',
      groupId: 'g-quim',
      type: 'objective',
      prompt: 'Qual a fórmula da entalpia?',
      points: 2,
      options: [
        { id: 'o1', label: 'A', text: 'H = U + pV', isCorrect: true },
        { id: 'o2', label: 'B', text: 'H = U - pV', isCorrect: false },
      ],
      tagIds: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  const examQuestions: Question[] = [
    {
      id: 'eq-termo',
      type: 'objective',
      prompt: 'Qual a fórmula da entalpia?',
      points: 3,
      annulled: 'give_points',
      options: [
        { id: 'opt-1', label: 'A', text: 'H = U + pV', isCorrect: true },
        { id: 'opt-2', label: 'B', text: 'H = U - pV', isCorrect: false },
      ],
    },
    {
      id: 'eq-nova',
      type: 'subjective',
      prompt: 'Explique o princípio de Le Chatelier.',
      points: 4,
      linesForAnswer: 6,
    },
  ];

  it('fromExamQuestion converte questão de prova e omite annulled', () => {
    const bq = fromExamQuestion(examQuestions[0], 'g-quim', ['t1']);
    expect(bq.prompt).toBe('Qual a fórmula da entalpia?');
    expect(bq.groupId).toBe('g-quim');
    expect(bq.tagIds).toEqual(['t1']);
    expect(bq.points).toBe(3);
    // Annulled não deve existir no banco
    expect((bq as any).annulled).toBeUndefined();
  });

  it('questionDuplicateKey detecta duplicata com enunciado e opções normalizadas', () => {
    const bankKey = questionDuplicateKey(sampleBankQuestions[0]);
    const examKey = questionDuplicateKey(examQuestions[0]);
    expect(bankKey).toBe(examKey);

    const nonDuplicateKey = questionDuplicateKey(examQuestions[1]);
    expect(nonDuplicateKey).not.toBe(bankKey);
  });

  it('QuestionEditor renderiza badge "Do banco" quando sourceQuestionId está presente', () => {
    const bankLinkedQuestion: Question = {
      id: 'q-linked',
      type: 'objective',
      prompt: 'Questão vinda do banco',
      points: 1,
      sourceQuestionId: 'bq-termo',
    };

    const html = renderToString(
      <QuestionEditor
        question={bankLinkedQuestion}
        index={0}
        onChange={() => {}}
        onDelete={() => {}}
      />
    );

    expect(html).toContain('Do banco');
  });

  it('SendToBankModal renderiza em SSR sem erros', () => {
    expect(() =>
      renderToString(
        <BankProvider initialData={{ groups: sampleGroups, questions: sampleBankQuestions }}>
          <SendToBankModal
            isOpen={true}
            onClose={() => {}}
            examQuestions={examQuestions}
            onQuestionsUpdated={() => {}}
          />
        </BankProvider>
      )
    ).not.toThrow();
  });
});
