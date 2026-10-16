import { describe, it, expect } from 'vitest';
import { computeExamFingerprint, fnv1a32 } from '../src/utils/fingerprint';
import { initialSampleExam } from '../src/utils/sampleExam';
import { generateExamVersions } from '../src/utils/randomizer';
import { decryptAnswerKey } from '../src/utils/crypto';
import { Exam } from '../src/types/exam';

describe('Impressão Digital da Estrutura da Prova (computeExamFingerprint)', () => {
  it('deve produzir um hash FNV-1a de 32 bits de exatamente 8 caracteres hexadecimais', () => {
    const fp = computeExamFingerprint(initialSampleExam);
    expect(fp).toMatch(/^[0-9a-f]{8}$/);
    expect(fnv1a32('GabariTeX')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('deve ser determinístico para o mesmo exame', () => {
    const fp1 = computeExamFingerprint(initialSampleExam);
    const fp2 = computeExamFingerprint({ ...initialSampleExam });
    expect(fp1).toBe(fp2);
  });

  it('deve ser estável ao alterar enunciado, valor de pontos ou anulação', () => {
    const baseFp = computeExamFingerprint(initialSampleExam);

    const editedExam: Exam = {
      ...initialSampleExam,
      questions: initialSampleExam.questions.map((q, idx) => {
        if (idx === 0) {
          return {
            ...q,
            prompt: 'Enunciado completamente reformulado com novas fórmulas $x^2 + y^2 = r^2$',
            points: 5.0, // alterou pontos
            annulled: 'give_points', // alterou anulação
            options: q.options?.map((opt, oIdx) => ({
              ...opt,
              text: `Texto da alternativa modificado ${oIdx}`,
              isCorrect: oIdx === 1, // alterou gabarito
            })),
          };
        }
        return q;
      }),
    };

    expect(computeExamFingerprint(editedExam)).toBe(baseFp);
  });

  it('deve mudar ao adicionar ou remover uma questão', () => {
    const baseFp = computeExamFingerprint(initialSampleExam);

    const withAddedQuestion: Exam = {
      ...initialSampleExam,
      questions: [
        ...initialSampleExam.questions,
        {
          id: 'q-new-unique',
          type: 'objective',
          prompt: 'Nova questão',
          points: 1,
          options: [
            { id: 'opt-new-1', label: 'A', text: '1', isCorrect: true },
            { id: 'opt-new-2', label: 'B', text: '2', isCorrect: false },
          ],
        },
      ],
    };

    const withRemovedQuestion: Exam = {
      ...initialSampleExam,
      questions: initialSampleExam.questions.slice(0, -1),
    };

    expect(computeExamFingerprint(withAddedQuestion)).not.toBe(baseFp);
    expect(computeExamFingerprint(withRemovedQuestion)).not.toBe(baseFp);
  });

  it('deve mudar ao reordenar as questões no editor', () => {
    const baseFp = computeExamFingerprint(initialSampleExam);

    const reversed: Exam = {
      ...initialSampleExam,
      questions: [...initialSampleExam.questions].reverse(),
    };

    expect(computeExamFingerprint(reversed)).not.toBe(baseFp);
  });

  it('deve mudar ao adicionar, remover ou reordenar alternativas de uma questão', () => {
    const baseFp = computeExamFingerprint(initialSampleExam);

    const addedOption: Exam = {
      ...initialSampleExam,
      questions: initialSampleExam.questions.map((q, idx) => {
        if (idx === 0 && q.options) {
          return {
            ...q,
            options: [
              ...q.options,
              { id: 'opt-extra', label: 'E' as const, text: 'Opção E', isCorrect: false },
            ],
          };
        }
        return q;
      }),
    };

    const reorderedOptions: Exam = {
      ...initialSampleExam,
      questions: initialSampleExam.questions.map((q, idx) => {
        if (idx === 0 && q.options) {
          return {
            ...q,
            options: [...q.options].reverse(),
          };
        }
        return q;
      }),
    };

    expect(computeExamFingerprint(addedOption)).not.toBe(baseFp);
    expect(computeExamFingerprint(reorderedOptions)).not.toBe(baseFp);
  });

  it('deve mudar ao alterar versionCount ou opções de embaralhamento', () => {
    const baseFp = computeExamFingerprint(initialSampleExam);

    expect(
      computeExamFingerprint({ ...initialSampleExam, versionCount: initialSampleExam.versionCount + 1 })
    ).not.toBe(baseFp);

    expect(
      computeExamFingerprint({ ...initialSampleExam, shuffleQuestions: !initialSampleExam.shuffleQuestions })
    ).not.toBe(baseFp);

    expect(
      computeExamFingerprint({ ...initialSampleExam, shuffleOptions: !initialSampleExam.shuffleOptions })
    ).not.toBe(baseFp);
  });

  it('o QR Code cifrado deve preservar o examFingerprint após descriptografia', async () => {
    const versions = await generateExamVersions(initialSampleExam);
    const expectedFp = computeExamFingerprint(initialSampleExam);

    for (const v of versions) {
      const payload = await decryptAnswerKey(v.encryptedQrPayload, initialSampleExam.password);
      expect(payload.examFingerprint).toBe(expectedFp);
    }
  });
});

