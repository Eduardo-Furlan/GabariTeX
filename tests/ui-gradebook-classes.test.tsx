import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { GradebookScreen } from '../src/screens/GradebookScreen';
import { ClassesScreen } from '../src/screens/ClassesScreen';
import { GradebookTable } from '../src/components/gradebook/GradebookTable';
import { ClassroomManager } from '../src/components/classrooms/ClassroomManager';
import { ProfileProvider } from '../src/context/ProfileContext';
import { GradingRecord, Classroom, Exam } from '../src/types/exam';

const dummyExam: Exam = {
  id: 'exam-1',
  header: {
    institution: 'Colégio Teste',
    course: 'Matemática',
    teacher: 'Prof. Exemplo',
    date: '2026-10-18',
    examTitle: 'Avaliação Trimestral',
    period: '4º Bimestre',
    instructions: 'Instruções',
    targetScore: 10,
    hasRedaction: false,
    maxRedactionScore: 0,
    extraInstructions: [],
    useWeights: false,
  },
  questions: [
    {
      id: 'q-1',
      number: 1,
      type: 'multiple_choice',
      prompt: 'Quanto é 2 + 2?',
      options: [
        { label: 'A', text: '3' },
        { label: 'B', text: '4' },
      ],
      correctOption: 'B',
      points: 5,
    },
    {
      id: 'q-2',
      number: 2,
      type: 'multiple_choice',
      prompt: 'Quanto é 3 x 3?',
      options: [
        { label: 'A', text: '9' },
        { label: 'B', text: '6' },
      ],
      correctOption: 'A',
      points: 5,
    },
  ],
  versions: {
    A: {
      seed: 1,
      layout: 'standard',
      versionLetter: 'A',
      questions: [
        {
          id: 'q-1',
          number: 1,
          type: 'multiple_choice',
          prompt: 'Quanto é 2 + 2?',
          options: [
            { label: 'A', text: '3' },
            { label: 'B', text: '4' },
          ],
          correctOption: 'B',
          points: 5,
        },
        {
          id: 'q-2',
          number: 2,
          type: 'multiple_choice',
          prompt: 'Quanto é 3 x 3?',
          options: [
            { label: 'A', text: '9' },
            { label: 'B', text: '6' },
          ],
          correctOption: 'A',
          points: 5,
        },
      ],
    },
  },
};

const dummyClass: Classroom = {
  id: 'class-1',
  name: '3º Ano A',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  students: [
    { id: 'st-1', name: 'Alice Santos', registration: '1001' },
    { id: 'st-2', name: 'Bernardo Lima', registration: '1002' },
  ],
};

const dummyRecords: GradingRecord[] = [
  {
    id: 'rec-1',
    examId: 'exam-1',
    classId: 'class-1',
    versionLetter: 'A',
    studentName: 'Alice Santos',
    studentId: '1001',
    timestamp: 1700000000,
    totalScore: 10,
    maxScore: 10,
    percentage: 100,
    answers: [
      {
        questionNumber: 1,
        markedOption: 'B',
        detectedOption: 'B',
        correctOption: 'B',
        isCorrect: true,
        pointsEarned: 5,
        maxPoints: 5,
        status: 'correct',
        needsReview: false,
      },
      {
        questionNumber: 2,
        markedOption: 'A',
        detectedOption: 'A',
        correctOption: 'A',
        isCorrect: true,
        pointsEarned: 5,
        maxPoints: 5,
        status: 'correct',
        needsReview: false,
      },
    ],
  },
];

describe('UI Gradebook & Classes (Phase 8: Folha Óptica)', () => {
  it('GradebookScreen renders screen-enter container and mounts table', () => {
    const html = renderToString(
      <ProfileProvider>
        <GradebookScreen onNavigate={() => {}} onOpenExportImport={() => {}} />
      </ProfileProvider>
    );

    expect(html).toContain('screen-enter');
    expect(html).toContain('Livro de Notas');
  });

  it('ClassesScreen renders screen-enter and mounts ClassroomManager in asScreen mode', () => {
    const html = renderToString(
      <ProfileProvider>
        <ClassesScreen />
      </ProfileProvider>
    );

    expect(html).toContain('screen-enter');
    expect(html).toContain('Gerenciador de Turmas e Alunos');
    expect(html).toContain('Suas Turmas');
  });

  it('GradebookTable renders stats cards, table headers with sort indicators, and row records', () => {
    const html = renderToString(
      <GradebookTable
        records={dummyRecords}
        classes={[dummyClass]}
        activeClassId="class-1"
        exam={dummyExam}
        onDeleteRecord={() => {}}
        onClearAll={() => {}}
      />
    );

    // Header and view switcher
    expect(html).toContain('Livro de Notas');
    expect(html).toContain('Notas');
    expect(html).toContain('Análise por Questão');

    // Stats cards
    expect(html).toContain('Média da Turma');
    expect(html).toContain('Média de Acertos (%)');
    expect(html).toContain('Provas Computadas');

    // Table columns
    expect(html).toContain('Data / Hora');
    expect(html).toContain('Aluno');
    expect(html).toContain('Turma');
    expect(html).toContain('Versão');
    expect(html).toContain('Nota (10)');
    expect(html).toContain('Aproveitamento');

    // Row content
    expect(html).toContain('Alice Santos');
    expect(html).toContain('1001');
    expect(html).toContain('100.0%');
  });

  it('ClassroomManager renders asScreen defensive against undefined students and empty classes', () => {
    const malformedClass = {
      id: 'malformed-1',
      name: 'Turma Sem Alunos',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as unknown as Classroom;

    expect(() => {
      renderToString(
        <ClassroomManager
          isOpen={true}
          asScreen={true}
          onClose={() => {}}
          classes={[malformedClass]}
          activeClassId="malformed-1"
          onSelectActiveClass={() => {}}
          onUpdateClasses={() => {}}
          records={[]}
          onDisassociateRecordsFromClass={() => {}}
        />
      );
    }).not.toThrow();
  });

  it('ClassroomManager renders student list with add/edit rows and action buttons', () => {
    const html = renderToString(
      <ClassroomManager
        isOpen={true}
        asScreen={true}
        onClose={() => {}}
        classes={[dummyClass]}
        activeClassId="class-1"
        onSelectActiveClass={() => {}}
        onUpdateClasses={() => {}}
        records={dummyRecords}
        onDisassociateRecordsFromClass={() => {}}
      />
    );

    expect(html).toContain('3º Ano A');
    expect(html).toContain('Alice Santos');
    expect(html).toContain('Bernardo Lima');
    expect(html).toContain('Adicionar Aluno');
    expect(html).toContain('Importar / Colar');
  });
});
