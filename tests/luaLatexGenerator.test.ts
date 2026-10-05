import { describe, it, expect } from 'vitest';
import { generateLuaLatexExam, generateLuaLatexAnswerKey } from '../src/utils/luaLatexGenerator';
import { ExamVersion, ExamHeader } from '../src/types/exam';

describe('Gerador de Código LuaLaTeX', () => {
  const sampleHeader: ExamHeader = {
    institution: 'Universidade Teste',
    course: 'Lógica e Teoria dos Conjuntos',
    professor: 'Prof. Turing',
    examTitle: 'Avaliação Final',
    date: '05/10/2026',
    instructions: 'Não use calculadora. Axiomas de ZF e ZFC podem ser citados.',
  };

  const sampleVersion: ExamVersion = {
    versionLetter: 'A',
    seed: 42,
    questions: [
      {
        id: 'q1',
        type: 'objective',
        prompt: 'Em teoria de conjuntos em ZF, determine se o axioma da escolha AC é independente.',
        points: 2.5,
        options: [
          { id: 'opt1', label: 'A', text: 'Sim, sob consistência de ZF.', isCorrect: true },
          { id: 'opt2', label: 'B', text: 'Não.', isCorrect: false },
        ],
      },
      {
        id: 'q2',
        type: 'subjective',
        prompt: 'Demonstre a consistência relativa entre ZF e ZFC.',
        points: 5.0,
        linesForAnswer: 10,
      },
    ],
    objectiveAnswerKey: { 1: 'A' },
    encryptedQrPayload: 'MCORR:v1:test',
  };

  it('deve usar fontspec e compilar com LuaLaTeX', () => {
    const tex = generateLuaLatexExam(sampleVersion, sampleHeader);

    expect(tex).toContain('\\usepackage{fontspec}');
    expect(tex).toContain('\\usepackage{amsmath,amssymb}');
  });

  it('NUNCA deve incluir pacotes legados como inputenc ou fontenc', () => {
    const texExam = generateLuaLatexExam(sampleVersion, sampleHeader);
    const texKey = generateLuaLatexAnswerKey(sampleVersion, sampleHeader);

    expect(texExam).not.toContain('inputenc');
    expect(texExam).not.toContain('fontenc');
    expect(texKey).not.toContain('inputenc');
    expect(texKey).not.toContain('fontenc');
  });

  it('deve respeitar a regra de strict math mode (sem $ZF$ ou $ZFC$)', () => {
    const tex = generateLuaLatexExam(sampleVersion, sampleHeader);

    expect(tex).not.toContain('$ZF$');
    expect(tex).not.toContain('$ZFC$');
    expect(tex).not.toContain('$AC$');
    expect(tex).toContain('ZF');
    expect(tex).toContain('ZFC');
  });

  it('não deve conter comentários redundantes ou decorativos', () => {
    const tex = generateLuaLatexExam(sampleVersion, sampleHeader);

    expect(tex).not.toMatch(/% ---/);
    expect(tex).not.toMatch(/% ====/);
  });
});
