import { describe, it, expect } from 'vitest';
import { generateStudentSlipsHtml } from '../src/utils/studentSlips';
import { GradingRecord } from '../src/types/exam';

describe('Geração de Espelhos de Resposta (studentSlips.ts)', () => {
  const sampleRecords: GradingRecord[] = [
    {
      id: 'rec-1',
      timestamp: Date.now(),
      studentName: 'Ana Souza',
      studentId: 'RA1001',
      versionLetter: 'A',
      totalScore: 16,
      maxScore: 20,
      percentage: 80,
      answers: [
        {
          questionNumber: 1,
          markedOption: 'B',
          correctOption: 'B',
          isCorrect: true,
          status: 'correct',
          pointsEarned: 2,
          maxPoints: 2,
          needsReview: false,
        },
        {
          questionNumber: 2,
          markedOption: 'A',
          correctOption: 'C',
          isCorrect: false,
          status: 'wrong',
          pointsEarned: 0,
          maxPoints: 2,
          needsReview: false,
        },
        {
          questionNumber: 3,
          markedOption: 'C',
          correctOption: 'C',
          isCorrect: true,
          status: 'correct',
          pointsEarned: 2,
          maxPoints: 2,
          needsReview: false,
          annulled: true,
        },
      ],
      subjectiveAnswers: [
        {
          questionNumber: 4,
          maxPoints: 5,
          pointsEarned: 4.5,
        },
      ],
    },
  ];

  it('deve gerar HTML formatado com escala convertida padrão 10', () => {
    const html = generateStudentSlipsHtml(sampleRecords, {
      examTitle: 'Física Geral I',
      targetScore: 10,
      classroomName: 'Engenharia Civil',
    });

    expect(html).toContain('Física Geral I');
    expect(html).toContain('Engenharia Civil');
    expect(html).toContain('Ana Souza');
    expect(html).toContain('RA1001');
    expect(html).toContain('Versão: <strong>A</strong>');
    expect(html).toContain('Nota: <strong>8.00</strong> / 10');
    expect(html).toContain('badge-correct');
    expect(html).toContain('badge-wrong');
    expect(html).toContain('badge-annulled');
    expect(html).toContain('D4: <strong>4.5</strong>/5.0');
  });

  it('deve adaptar nota para escala personalizada (ex: 100)', () => {
    const html = generateStudentSlipsHtml(sampleRecords, {
      examTitle: 'Cálculo',
      targetScore: 100,
    });

    expect(html).toContain('Nota: <strong>80.00</strong> / 100');
  });
});

