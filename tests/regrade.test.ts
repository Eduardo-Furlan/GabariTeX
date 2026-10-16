import { describe, it, expect } from 'vitest';
import { regradeRecords } from '../src/utils/regrade';
import { buildVersionLayouts } from '../src/utils/randomizer';
import { computeExamFingerprint } from '../src/utils/fingerprint';
import { initialSampleExam } from '../src/utils/sampleExam';
import { Exam, GradingRecord, GradedAnswer } from '../src/types/exam';

describe('Recálculo de Notas (regradeRecords)', () => {
  const fp = computeExamFingerprint(initialSampleExam);
  const layouts = buildVersionLayouts(initialSampleExam);
  const layoutA = layouts[0]; // Versão A

  // Monta um registro simulado para a Versão A
  function createSampleRecord(overrides?: Partial<GradingRecord>): GradingRecord {
    const answers: GradedAnswer[] = [];
    const subjectiveAnswers: SubjectiveAnswer[] = [];

    layoutA.questions.forEach((q, idx) => {
      const qNum = idx + 1;
      if (q.type === 'objective') {
        const correctOpt = layoutA.objectiveAnswerKey[qNum] || 'A';
        // Alterna entre certo e errado para teste
        const isStudentCorrect = qNum % 2 !== 0;
        const markedOption = isStudentCorrect
          ? correctOpt
          : correctOpt === 'A'
          ? 'B'
          : 'A';

        answers.push({
          questionNumber: qNum,
          markedOption,
          correctOption: correctOpt,
          isCorrect: isStudentCorrect,
          status: isStudentCorrect ? 'correct' : 'wrong',
          pointsEarned: isStudentCorrect ? q.points : 0,
          maxPoints: q.points,
          detectedOption: markedOption,
        });
      } else {
        subjectiveAnswers.push({
          questionNumber: qNum,
          maxPoints: q.points,
          pointsEarned: 1.0,
        });
      }
    });

    const totalScore =
      answers.reduce((sum, a) => sum + a.pointsEarned, 0) +
      subjectiveAnswers.reduce((sum, s) => sum + (s.pointsEarned ?? 0), 0);
    const maxScore =
      answers.reduce((sum, a) => sum + a.maxPoints, 0) +
      subjectiveAnswers.reduce((sum, s) => sum + s.maxPoints, 0);

    return {
      id: 'rec-test-1',
      timestamp: Date.now(),
      studentName: 'Aluno Teste',
      studentId: '12345',
      versionLetter: 'A',
      totalScore,
      maxScore,
      percentage: Number(((totalScore / maxScore) * 100).toFixed(2)),
      answers,
      subjectiveAnswers: subjectiveAnswers.length > 0 ? subjectiveAnswers : undefined,
      examId: initialSampleExam.id,
      examFingerprint: fp,
      ...overrides,
    };
  }

  it('deve recalcular quando o gabarito oficial de uma questão é corrigido no exame', () => {
    const originalRecord = createSampleRecord();
    const targetObjQ = layoutA.questions.find((q) => q.type === 'objective')!;
    const targetQNum = layoutA.questions.indexOf(targetObjQ) + 1;
    const targetAns = originalRecord.answers.find((a) => a.questionNumber === targetQNum)!;
    const originalCorrect = targetAns.correctOption;

    const modifiedExam: Exam = {
      ...initialSampleExam,
      questions: initialSampleExam.questions.map((q) => {
        if (q.id === targetObjQ.id && q.options) {
          const currentlyCorrect = q.options.find((o) => o.isCorrect);
          const otherOpt = q.options.find((o) => !o.isCorrect);
          return {
            ...q,
            options: q.options.map((opt) => ({
              ...opt,
              isCorrect: opt.id === otherOpt?.id,
            })),
          };
        }
        return q;
      }),
    };

    const { records: updatedRecords, report } = regradeRecords([originalRecord], modifiedExam);

    expect(report.updated).toBe(1);
    expect(report.unchanged).toBe(0);
    const updatedAns = updatedRecords[0].answers.find((a) => a.questionNumber === targetQNum);
    expect(updatedAns?.correctOption).not.toBe(originalCorrect);
  });

  it('deve conceder pontos a todos ao anular com give_points', () => {
    const originalRecord = createSampleRecord();
    const wrongAns = originalRecord.answers.find((a) => !a.isCorrect)!;
    const targetQNum = wrongAns.questionNumber;
    const targetObjQ = layoutA.questions[targetQNum - 1];

    const modifiedExam: Exam = {
      ...initialSampleExam,
      questions: initialSampleExam.questions.map((q) => {
        if (q.id === targetObjQ.id) {
          return { ...q, annulled: 'give_points' as const };
        }
        return q;
      }),
    };

    const { records: updatedRecords, report } = regradeRecords([originalRecord], modifiedExam);

    expect(report.updated).toBe(1);
    const updatedAns = updatedRecords[0].answers.find((a) => a.questionNumber === targetQNum);
    expect(updatedAns?.annulled).toBe(true);
    expect(updatedAns?.isCorrect).toBe(true);
    expect(updatedAns?.pointsEarned).toBe(updatedAns?.maxPoints);
    expect(updatedRecords[0].totalScore).toBeGreaterThan(originalRecord.totalScore);
    expect(updatedRecords[0].maxScore).toBe(originalRecord.maxScore);
  });

  it('deve desconsiderar a questão do total e do valor máximo com discard', () => {
    const originalRecord = createSampleRecord();
    const targetObjQ = layoutA.questions.find((q) => q.type === 'objective')!;
    const targetQNum = layoutA.questions.indexOf(targetObjQ) + 1;

    const modifiedExam: Exam = {
      ...initialSampleExam,
      questions: initialSampleExam.questions.map((q) => {
        if (q.id === targetObjQ.id) {
          return { ...q, annulled: 'discard' as const };
        }
        return q;
      }),
    };

    const { records: updatedRecords, report } = regradeRecords([originalRecord], modifiedExam);

    expect(report.updated).toBe(1);
    const updatedAns = updatedRecords[0].answers.find((a) => a.questionNumber === targetQNum);
    expect(updatedAns?.annulled).toBe(true);
    expect(updatedAns?.maxPoints).toBe(0);
    expect(updatedAns?.pointsEarned).toBe(0);
    expect(updatedRecords[0].maxScore).toBeLessThan(originalRecord.maxScore);
  });

  it('deve preservar manualOverride e avaliar a alternativa manualmente selecionada', () => {
    const record = createSampleRecord();
    const targetAns = record.answers[0];
    const targetQNum = targetAns.questionNumber;
    const correctOpt = layoutA.objectiveAnswerKey[targetQNum];

    record.answers[0] = {
      ...targetAns,
      markedOption: correctOpt,
      manualOverride: true,
      detectedOption: 'D',
    };

    const { records: updatedRecords } = regradeRecords([record], initialSampleExam);
    const updatedAns = updatedRecords[0].answers[0];
    expect(updatedAns.manualOverride).toBe(true);
    expect(updatedAns.markedOption).toBe(correctOpt);
    expect(updatedAns.isCorrect).toBe(true);
  });

  it('deve atualizar maxPoints e clamp em questões dissertativas mantendo notas lançadas', () => {
    const record = createSampleRecord({
      subjectiveAnswers: [
        {
          questionNumber: 4,
          maxPoints: 2.5,
          pointsEarned: 2.0,
        },
      ],
    });

    // Prova atual altera o valor da dissertativa para 1.5 pt
    const modifiedExam: Exam = {
      ...initialSampleExam,
      questions: initialSampleExam.questions.map((q) => {
        if (q.type === 'subjective') {
          return { ...q, points: 1.5 };
        }
        return q;
      }),
    };

    const { records: updatedRecords } = regradeRecords([record], modifiedExam);
    const updatedSubj = updatedRecords[0].subjectiveAnswers?.[0];
    expect(updatedSubj?.maxPoints).toBe(1.5);
    expect(updatedSubj?.pointsEarned).toBe(1.5); // clamped de 2.0 para 1.5
  });

  it('deve ignorar registros sem impressão digital ou com estrutura modificada', () => {
    const recordNoFp = createSampleRecord({ id: 'r-no-fp', examFingerprint: undefined });
    const recordDiffFp = createSampleRecord({ id: 'r-diff-fp', examFingerprint: 'deadbeef' });
    const recordUnknownVersion = createSampleRecord({ id: 'r-unk-v', versionLetter: 'Z' });

    const { records: result, report } = regradeRecords(
      [recordNoFp, recordDiffFp, recordUnknownVersion],
      initialSampleExam
    );

    expect(report.updated).toBe(0);
    expect(report.skipped.noFingerprint).toBe(1);
    expect(report.skipped.structureChanged).toBe(1);
    expect(report.skipped.unknownVersion).toBe(1);
    expect(result.length).toBe(3);
  });

  it('não deve mutar o array nem os objetos de registro recebidos', () => {
    const originalRecord = createSampleRecord();
    const inputList = [originalRecord];
    const jsonBefore = JSON.stringify(inputList);

    regradeRecords(inputList, initialSampleExam);

    expect(JSON.stringify(inputList)).toBe(jsonBefore);
  });
});
