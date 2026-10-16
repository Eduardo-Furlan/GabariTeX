import { describe, it, expect } from 'vitest';
import {
  SHEET,
  getColumnLayout,
  rowWidthPx,
  markSpanPx,
  optionCenterOffsetsPx,
  bubbleRadiusPx,
} from '../src/utils/sheetLayout';
import {
  MAX_QUESTIONS,
  remainingQuestions,
  isWithinLimit,
  ExamTooLargeError,
  validateExamQuestionCount,
} from '../src/utils/examLimits';

describe('sheetLayout — Geometria e Limites da Folha', () => {
  describe('getColumnLayout', () => {
    it('divide em 1 coluna para provas de 1 a 12 questões', () => {
      for (let n = 1; n <= 12; n++) {
        const layout = getColumnLayout(n);
        expect(layout.columns).toBe(1);
        expect(layout.perColumn).toBe(n);
      }
    });

    it('divide em 2 colunas a partir de 13 questões', () => {
      const layout13 = getColumnLayout(13);
      expect(layout13.columns).toBe(2);
      expect(layout13.perColumn).toBe(7); // Coluna 1 com 7, Coluna 2 com 6

      const layout20 = getColumnLayout(20);
      expect(layout20.columns).toBe(2);
      expect(layout20.perColumn).toBe(10); // 10 e 10

      const layout39 = getColumnLayout(39);
      expect(layout39.columns).toBe(2);
      expect(layout39.perColumn).toBe(20); // 20 e 19

      const layout40 = getColumnLayout(40);
      expect(layout40.columns).toBe(2);
      expect(layout40.perColumn).toBe(20); // 20 e 20
    });
  });

  describe('Geometria determinística da linha', () => {
    it('rowWidthPx deve ser exatamente 256px', () => {
      expect(rowWidthPx()).toBe(256);
      expect(SHEET.MARK_PX).toBe(10);
      expect(SHEET.MARK_GAP_PX).toBe(6);
      expect(SHEET.LABEL_PX).toBe(48);
      expect(SHEET.OPTIONS_PX).toBe(176);
      expect(SHEET.BUBBLE_PX).toBe(24);
    });

    it('markSpanPx deve ser exatamente 246px', () => {
      expect(markSpanPx()).toBe(246);
    });

    it('bubbleRadiusPx deve ser 12px', () => {
      expect(bubbleRadiusPx()).toBe(12);
    });

    it('optionCenterOffsetsPx deve coincidir com os valores exatos de [76.6, 111.8, 147.0, 182.2, 217.4]', () => {
      const offsets = optionCenterOffsetsPx();
      expect(offsets).toEqual([76.6, 111.8, 147.0, 182.2, 217.4]);

      // Frações relativas a markSpanPx (246px)
      const span = markSpanPx();
      const fractions = offsets.map((off) => Number((off / span).toFixed(3)));
      expect(fractions).toEqual([0.311, 0.454, 0.598, 0.741, 0.884]);
    });
  });

  describe('examLimits — Limite de 40 questões', () => {
    it('valida corretamente limites de 40 e 41', () => {
      expect(MAX_QUESTIONS).toBe(40);
      expect(isWithinLimit(40)).toBe(true);
      expect(isWithinLimit(41)).toBe(false);
      expect(remainingQuestions(36)).toBe(4);
      expect(remainingQuestions(40)).toBe(0);
      expect(remainingQuestions(45)).toBe(0);
    });

    it('validateExamQuestionCount aceita até 40 e lança ExamTooLargeError acima de 40', () => {
      expect(() => validateExamQuestionCount(40)).not.toThrow();

      expect(() => validateExamQuestionCount(41)).toThrow(ExamTooLargeError);
      try {
        validateExamQuestionCount(42);
      } catch (err) {
        expect(err instanceof ExamTooLargeError).toBe(true);
        if (err instanceof ExamTooLargeError) {
          expect(err.count).toBe(42);
          expect(err.max).toBe(40);
        }
      }
    });
  });
});
