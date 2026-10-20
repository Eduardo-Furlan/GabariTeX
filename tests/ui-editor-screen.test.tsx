import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { EditorScreen } from '../src/screens/EditorScreen';
import { QuestionList } from '../src/components/editor/QuestionList';
import { QuestionEditor } from '../src/components/editor/QuestionEditor';
import { ExamHeaderEditor } from '../src/components/editor/ExamHeaderEditor';
import { ProfileProvider } from '../src/context/ProfileContext';
import { Exam, Question } from '../types/exam';

const mockQuestion: Question = {
  id: 'q-test-1',
  type: 'objective',
  prompt: 'Qual é o valor de $\\pi$?',
  points: 2.5,
  options: [
    { id: 'opt-1', label: 'A', text: '$3.14$', isCorrect: true },
    { id: 'opt-2', label: 'B', text: '$2.71$', isCorrect: false },
    { id: 'opt-3', label: 'C', text: '$1.41$', isCorrect: false },
    { id: 'opt-4', label: 'D', text: '$0.00$', isCorrect: false },
  ],
};

const mockExam: Exam = {
  id: 'exam-1',
  name: 'Avaliação Modelo',
  password: 'PASS1234',
  versionCount: 2,
  shuffleQuestions: true,
  shuffleOptions: true,
  twoColumns: false,
  header: {
    institution: 'Universidade Teste',
    course: 'Cálculo',
    examTitle: 'Prova 1',
    professor: 'Dr. Gauss',
    date: '2026-03-01',
    instructions: 'Leia com atenção.',
    targetScore: 10,
  },
  questions: [mockQuestion],
};

describe('UI EditorScreen and Components (Phase 5)', () => {
  it('renders EditorScreen in SSR without crashing', () => {
    const html = renderToString(
      <ProfileProvider>
        <EditorScreen />
      </ProfileProvider>
    );

    expect(html).toBeTruthy();
    expect(html).toContain('screen-enter');
    expect(html).toContain('Cabeçalho');
  });

  it('renders QuestionList with sticky summary toolbar, ProgressBar, and CountUp', () => {
    const html = renderToString(
      <QuestionList
        questions={[mockQuestion]}
        onChange={() => {}}
        onOpenImportModal={() => {}}
      />
    );

    expect(html).toContain('sticky');
    expect(html).toContain('chrome-surface');
    expect(html).toContain('progressbar');
    expect(html).toContain('Total:');
    expect(html).toContain('1/40');
    expect(html).toContain('Objetivas:');
    expect(html).toContain('Nova Objetiva');
    expect(html).toContain('Nova Dissertativa');
  });

  it('renders QuestionEditor with Bubble answer selector, aria-pressed, and action IconButtons', () => {
    const html = renderToString(
      <QuestionEditor
        question={mockQuestion}
        index={0}
        canMoveUp={false}
        canMoveDown={false}
        canDuplicate={true}
        onDuplicate={() => {}}
        onChange={() => {}}
        onDelete={() => {}}
      />
    );

    expect(html).toContain('Questão 1');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-label="Alternativa A (correta)"');
    expect(html).toContain('aria-label="Duplicar questão"');
    expect(html).toContain('aria-label="Excluir questão"');
    expect(html).toContain('Atalhos LaTeX:');
  });

  it('renders "Do banco" badge conditionally based on isFromBank prop', () => {
    const bankQuestion: Question = {
      ...mockQuestion,
      sourceQuestionId: 'bq-origin-1',
    };

    // When isFromBank is true, badge is visible
    const htmlWithBadge = renderToString(
      <QuestionEditor
        question={bankQuestion}
        index={0}
        isFromBank={true}
        onChange={() => {}}
        onDelete={() => {}}
      />
    );
    expect(htmlWithBadge).toContain('Do banco');

    // When isFromBank is explicitly false (e.g. question deleted from bank), badge is NOT visible
    const htmlWithoutBadge = renderToString(
      <QuestionEditor
        question={bankQuestion}
        index={0}
        isFromBank={false}
        onChange={() => {}}
        onDelete={() => {}}
      />
    );
    expect(htmlWithoutBadge).not.toContain('Do banco');
  });

  it('renders QuestionList with bankQuestionIds filtering "Do banco" badge correctly', () => {
    const qFromBank: Question = {
      ...mockQuestion,
      id: 'q-bank-active',
      sourceQuestionId: 'bq-exists',
    };
    const qFromDeletedBank: Question = {
      ...mockQuestion,
      id: 'q-bank-deleted',
      sourceQuestionId: 'bq-deleted',
    };

    const bankQuestionIds = new Set(['bq-exists']);

    const html = renderToString(
      <QuestionList
        questions={[qFromBank, qFromDeletedBank]}
        bankQuestionIds={bankQuestionIds}
        onChange={() => {}}
      />
    );

    // Expect exactly one "Do banco" badge
    const matches = html.match(/Do banco/g);
    expect(matches).toHaveLength(1);
  });

  it('renders ExamHeaderEditor with Surface and header inputs', () => {
    const html = renderToString(
      <ExamHeaderEditor exam={mockExam} onChange={() => {}} />
    );

    expect(html).toContain('Cabeçalho &amp; Configurações da Prova');
    expect(html).toContain('Universidade Teste');
    expect(html).toContain('Cálculo');
    expect(html).toContain('Senha da Prova (QR Code)');
    expect(html).toContain('Qtd. Versões:');
    expect(html).toContain('Escala de Nota:');
  });
});
