import { describe, it, expect } from 'vitest';
import {
  buildObjectiveAnswer,
  applyManualOverride,
  revertOverride,
  recomputeTotals,
  countNeedsReview,
  setSubjectiveScore,
  setSubjectiveMaxPoints,
  countPendingSubjective,
  isPartial,
  computeAverages,
} from '../src/utils/grading';
import { OmrRawDetection } from '../src/types/omr';
import { GradingRecord } from '../src/types/exam';

describe('grading utilities', () => {
  describe('buildObjectiveAnswer', () => {
    it('grades correct answer with high confidence (no review needed)', () => {
      const detection: OmrRawDetection = {
        questionNumber: 1,
        detectedMark: 'B',
        status: 'marked',
        fillRatios: { A: 0.1, B: 0.85, C: 0.05, D: 0.02, E: 0.01 },
      };

      const ans = buildObjectiveAnswer({
        questionNumber: 1,
        correctOption: 'B',
        maxPoints: 2.0,
        detection,
      });

      expect(ans.isCorrect).toBe(true);
      expect(ans.pointsEarned).toBe(2.0);
      expect(ans.status).toBe('correct');
      expect(ans.detectedOption).toBe('B');
      expect(ans.needsReview).toBe(false);
      expect(ans.fillRatios).toBeUndefined();
      expect(ans.manualOverride).toBe(false);
    });

    it('grades wrong answer with high confidence (no review needed)', () => {
      const detection: OmrRawDetection = {
        questionNumber: 2,
        detectedMark: 'C',
        status: 'marked',
        fillRatios: { A: 0.05, B: 0.1, C: 0.80, D: 0.02, E: 0.01 },
      };

      const ans = buildObjectiveAnswer({
        questionNumber: 2,
        correctOption: 'A',
        maxPoints: 1.5,
        detection,
      });

      expect(ans.isCorrect).toBe(false);
      expect(ans.pointsEarned).toBe(0);
      expect(ans.status).toBe('wrong');
      expect(ans.needsReview).toBe(false);
    });

    it('flags needsReview when marked option fillRatio < 0.75 (threshold check: 0.74 vs 0.75)', () => {
      const detection74: OmrRawDetection = {
        questionNumber: 3,
        detectedMark: 'A',
        status: 'marked',
        fillRatios: { A: 0.74, B: 0.1, C: 0.05, D: 0.02, E: 0.01 },
      };

      const ans74 = buildObjectiveAnswer({
        questionNumber: 3,
        correctOption: 'A',
        maxPoints: 1.0,
        detection: detection74,
      });

      expect(ans74.needsReview).toBe(true);
      expect(ans74.fillRatios).toBeDefined();
      expect(ans74.fillRatios?.A).toBe(0.74);

      const detection75: OmrRawDetection = {
        questionNumber: 3,
        detectedMark: 'A',
        status: 'marked',
        fillRatios: { A: 0.75, B: 0.1, C: 0.05, D: 0.02, E: 0.01 },
      };

      const ans75 = buildObjectiveAnswer({
        questionNumber: 3,
        correctOption: 'A',
        maxPoints: 1.0,
        detection: detection75,
      });

      expect(ans75.needsReview).toBe(false);
      expect(ans75.fillRatios).toBeUndefined();
    });

    it('flags needsReview when detection status is multiple (rasura)', () => {
      const detection: OmrRawDetection = {
        questionNumber: 4,
        detectedMark: null,
        status: 'multiple',
        fillRatios: { A: 0.65, B: 0.70, C: 0.05, D: 0.02, E: 0.01 },
      };

      const ans = buildObjectiveAnswer({
        questionNumber: 4,
        correctOption: 'A',
        maxPoints: 1.0,
        detection,
      });

      expect(ans.status).toBe('multiple');
      expect(ans.isCorrect).toBe(false);
      expect(ans.pointsEarned).toBe(0);
      expect(ans.needsReview).toBe(true);
      expect(ans.fillRatios).toBeDefined();
    });

    it('does not flag blank question with all ratios < 0.30', () => {
      const detection: OmrRawDetection = {
        questionNumber: 5,
        detectedMark: null,
        status: 'blank',
        fillRatios: { A: 0.05, B: 0.1, C: 0.02, D: 0.03, E: 0.04 },
      };

      const ans = buildObjectiveAnswer({
        questionNumber: 5,
        correctOption: 'C',
        maxPoints: 1.0,
        detection,
      });

      expect(ans.status).toBe('blank');
      expect(ans.isCorrect).toBe(false);
      expect(ans.pointsEarned).toBe(0);
      expect(ans.needsReview).toBe(false);
    });

    it('handles undefined detection as blank with no review', () => {
      const ans = buildObjectiveAnswer({
        questionNumber: 6,
        correctOption: 'D',
        maxPoints: 1.0,
        detection: undefined,
      });

      expect(ans.status).toBe('blank');
      expect(ans.needsReview).toBe(false);
    });
  });

  describe('applyManualOverride', () => {
    const baseAnswer = buildObjectiveAnswer({
      questionNumber: 1,
      correctOption: 'C',
      maxPoints: 2.0,
      detection: {
        questionNumber: 1,
        detectedMark: 'B',
        status: 'marked',
        fillRatios: { A: 0.05, B: 0.60, C: 0.55, D: 0.02, E: 0.01 },
      },
    });

    it('changes to correct option letter', () => {
      const overridden = applyManualOverride(baseAnswer, 'C');

      expect(overridden.markedOption).toBe('C');
      expect(overridden.isCorrect).toBe(true);
      expect(overridden.pointsEarned).toBe(2.0);
      expect(overridden.status).toBe('correct');
      expect(overridden.manualOverride).toBe(true);
      expect(overridden.needsReview).toBe(false);
      expect(overridden.detectedOption).toBe('B');
    });

    it('changes to wrong option letter', () => {
      const overridden = applyManualOverride(baseAnswer, 'D');

      expect(overridden.markedOption).toBe('D');
      expect(overridden.isCorrect).toBe(false);
      expect(overridden.pointsEarned).toBe(0);
      expect(overridden.status).toBe('wrong');
      expect(overridden.manualOverride).toBe(true);
    });

    it('changes to BLANK', () => {
      const overridden = applyManualOverride(baseAnswer, 'BLANK');

      expect(overridden.markedOption).toBeNull();
      expect(overridden.isCorrect).toBe(false);
      expect(overridden.pointsEarned).toBe(0);
      expect(overridden.status).toBe('blank');
      expect(overridden.manualOverride).toBe(true);
    });

    it('changes to INVALID (multiple / rasura)', () => {
      const overridden = applyManualOverride(baseAnswer, 'INVALID');

      expect(overridden.markedOption).toBeNull();
      expect(overridden.isCorrect).toBe(false);
      expect(overridden.pointsEarned).toBe(0);
      expect(overridden.status).toBe('multiple');
      expect(overridden.manualOverride).toBe(true);
    });
  });

  describe('revertOverride', () => {
    it('restores original detected letter and recalculates isCorrect and needsReview', () => {
      const original = buildObjectiveAnswer({
        questionNumber: 1,
        correctOption: 'B',
        maxPoints: 2.0,
        detection: {
          questionNumber: 1,
          detectedMark: 'B',
          status: 'marked',
          fillRatios: { A: 0.05, B: 0.65, C: 0.1, D: 0.02, E: 0.01 },
        },
      });

      const overridden = applyManualOverride(original, 'A');
      expect(overridden.manualOverride).toBe(true);
      expect(overridden.isCorrect).toBe(false);

      const reverted = revertOverride(overridden);
      expect(reverted.manualOverride).toBe(false);
      expect(reverted.markedOption).toBe('B');
      expect(reverted.isCorrect).toBe(true);
      expect(reverted.pointsEarned).toBe(2.0);
      expect(reverted.needsReview).toBe(true);
    });

    it('restores multiple status when original detection was multiple', () => {
      const original = buildObjectiveAnswer({
        questionNumber: 2,
        correctOption: 'B',
        maxPoints: 2.0,
        detection: {
          questionNumber: 2,
          detectedMark: null,
          status: 'multiple',
          fillRatios: { A: 0.60, B: 0.65, C: 0.1, D: 0.02, E: 0.01 },
        },
      });

      const overridden = applyManualOverride(original, 'B');
      expect(overridden.markedOption).toBe('B');

      const reverted = revertOverride(overridden);
      expect(reverted.markedOption).toBeNull();
      expect(reverted.status).toBe('multiple');
      expect(reverted.manualOverride).toBe(false);
      expect(reverted.needsReview).toBe(true);
    });
  });

  describe('recomputeTotals and countNeedsReview', () => {
    it('recalculates totalScore, maxScore and percentage without mutating original', () => {
      const record: GradingRecord = {
        id: 'rec-1',
        timestamp: 12345,
        studentName: 'Aluno Teste',
        studentId: '123',
        versionLetter: 'A',
        totalScore: 0,
        maxScore: 0,
        percentage: 0,
        answers: [
          {
            questionNumber: 1,
            markedOption: 'A',
            correctOption: 'A',
            isCorrect: true,
            status: 'correct',
            pointsEarned: 2.5,
            maxPoints: 2.5,
            needsReview: false,
          },
          {
            questionNumber: 2,
            markedOption: 'B',
            correctOption: 'C',
            isCorrect: false,
            status: 'wrong',
            pointsEarned: 0,
            maxPoints: 2.5,
            needsReview: true,
          },
          {
            questionNumber: 3,
            markedOption: 'D',
            correctOption: 'D',
            isCorrect: true,
            status: 'correct',
            pointsEarned: 5.0,
            maxPoints: 5.0,
            needsReview: false,
          },
        ],
      };

      const computed = recomputeTotals(record);

      expect(computed.totalScore).toBe(7.5);
      expect(computed.maxScore).toBe(10.0);
      expect(computed.percentage).toBe(75.0);
      expect(countNeedsReview(computed)).toBe(1);

      // Verify immutability
      expect(record.totalScore).toBe(0);
    });
  });

  describe('subjective scoring and averages (Plano 02)', () => {
    const baseRecord: GradingRecord = {
      id: 'rec-subj-1',
      timestamp: 1000000,
      studentName: 'Marina Silva',
      studentId: '2026001',
      versionLetter: 'A',
      totalScore: 4.0,
      maxScore: 6.0,
      percentage: 66.67,
      answers: [
        {
          questionNumber: 1,
          markedOption: 'A',
          correctOption: 'A',
          isCorrect: true,
          status: 'correct',
          pointsEarned: 2.0,
          maxPoints: 2.0,
          needsReview: false,
        },
        {
          questionNumber: 2,
          markedOption: 'B',
          correctOption: 'B',
          isCorrect: true,
          status: 'correct',
          pointsEarned: 2.0,
          maxPoints: 2.0,
          needsReview: false,
        },
        {
          questionNumber: 3,
          markedOption: 'C',
          correctOption: 'D',
          isCorrect: false,
          status: 'wrong',
          pointsEarned: 0,
          maxPoints: 2.0,
          needsReview: false,
        },
      ],
      subjectiveAnswers: [
        {
          questionNumber: 4,
          maxPoints: 2.0,
          pointsEarned: null,
        },
        {
          questionNumber: 5,
          maxPoints: 2.0,
          pointsEarned: null,
        },
      ],
    };

    it('identifica registros parciais e conta questões pendentes corretamente', () => {
      const withTotals = recomputeTotals(baseRecord);

      expect(isPartial(withTotals)).toBe(true);
      expect(countPendingSubjective(withTotals)).toBe(2);
      // Objetivas: 4/6; Dissertativas pendentes contam 0 na totalScore, mas entram no maxScore
      expect(withTotals.totalScore).toBe(4.0);
      expect(withTotals.maxScore).toBe(10.0);
      expect(withTotals.percentage).toBe(40.0);
    });

    it('setSubjectiveScore faz clamp em [0, maxPoints] e arredonda a 2 casas decimais', () => {
      // Teste clamp superior
      const clampedHigh = setSubjectiveScore(baseRecord, 4, 3.5);
      const q4High = clampedHigh.subjectiveAnswers?.find((s) => s.questionNumber === 4);
      expect(q4High?.pointsEarned).toBe(2.0); // maxPoints era 2.0

      // Teste clamp inferior
      const clampedLow = setSubjectiveScore(baseRecord, 4, -1.0);
      const q4Low = clampedLow.subjectiveAnswers?.find((s) => s.questionNumber === 4);
      expect(q4Low?.pointsEarned).toBe(0);

      // Teste arredondamento
      const rounded = setSubjectiveScore(baseRecord, 4, 1.6666);
      const q4Rounded = rounded.subjectiveAnswers?.find((s) => s.questionNumber === 4);
      expect(q4Rounded?.pointsEarned).toBe(1.67);

      // Teste imutabilidade
      expect(baseRecord.subjectiveAnswers?.[0].pointsEarned).toBeNull();
    });

    it('setSubjectiveMaxPoints atualiza a nota máxima, recalcula maxScore e ajusta pontos lançados se necessário', () => {
      const updatedMax = setSubjectiveMaxPoints(baseRecord, 4, 3.0);
      const q4 = updatedMax.subjectiveAnswers?.find((s) => s.questionNumber === 4);
      expect(q4?.maxPoints).toBe(3.0);
      expect(updatedMax.maxScore).toBe(11.0); // 6 obj + 3 + 2

      // Se aluno já tinha 2.5 pontos lançados e reduzimos a nota máxima para 1.5, pointsEarned sofre clamp
      const scored = setSubjectiveScore(updatedMax, 4, 2.5);
      expect(scored.subjectiveAnswers?.find((s) => s.questionNumber === 4)?.pointsEarned).toBe(2.5);
      expect(scored.totalScore).toBe(6.5); // 4 obj + 2.5 diss

      const reducedMax = setSubjectiveMaxPoints(scored, 4, 1.5);
      const q4Reduced = reducedMax.subjectiveAnswers?.find((s) => s.questionNumber === 4);
      expect(q4Reduced?.maxPoints).toBe(1.5);
      expect(q4Reduced?.pointsEarned).toBe(1.5);
      expect(reducedMax.maxScore).toBe(9.5); // 6 obj + 1.5 + 2
      expect(reducedMax.totalScore).toBe(5.5); // 4 obj + 1.5
    });

    it('lançar notas dissertativas fecha o total e desmarca status parcial', () => {
      const afterQ4 = setSubjectiveScore(baseRecord, 4, 1.5);
      expect(isPartial(afterQ4)).toBe(true);
      expect(countPendingSubjective(afterQ4)).toBe(1);
      expect(afterQ4.totalScore).toBe(5.5); // 4.0 obj + 1.5 diss
      expect(afterQ4.maxScore).toBe(10.0);
      expect(afterQ4.percentage).toBe(55.0);

      const afterQ5 = setSubjectiveScore(afterQ4, 5, 2.0);
      expect(isPartial(afterQ5)).toBe(false);
      expect(countPendingSubjective(afterQ5)).toBe(0);
      expect(afterQ5.totalScore).toBe(7.5); // 4.0 obj + 1.5 + 2.0
      expect(afterQ5.maxScore).toBe(10.0);
      expect(afterQ5.percentage).toBe(75.0);
    });

    it('computeAverages considera apenas registros completos e reporta parciais excluídos', () => {
      const complete1 = setSubjectiveScore(setSubjectiveScore(baseRecord, 4, 2.0), 5, 2.0); // total 8.0 (80%)
      const complete2 = setSubjectiveScore(setSubjectiveScore(baseRecord, 4, 1.0), 5, 1.0); // total 6.0 (60%)
      const partialRecord = baseRecord; // total 4.0 (40%), parcial

      const avg = computeAverages([complete1, complete2, partialRecord]);

      expect(avg.totalEvaluated).toBe(2);
      expect(avg.excludedPartialCount).toBe(1);
      expect(avg.averageScore).toBe(7.0); // (8 + 6) / 2
      expect(avg.averagePercentage).toBe(70.0); // (80 + 60) / 2
    });

    it('computeAverages lida com lista vazia ou quando todos são parciais', () => {
      const emptyAvg = computeAverages([]);
      expect(emptyAvg.averageScore).toBe(0);
      expect(emptyAvg.averagePercentage).toBe(0);
      expect(emptyAvg.totalEvaluated).toBe(0);
      expect(emptyAvg.excludedPartialCount).toBe(0);

      const allPartialAvg = computeAverages([baseRecord]);
      expect(allPartialAvg.averageScore).toBe(0);
      expect(allPartialAvg.averagePercentage).toBe(0);
      expect(allPartialAvg.totalEvaluated).toBe(0);
      expect(allPartialAvg.excludedPartialCount).toBe(1);
    });
  });
});

