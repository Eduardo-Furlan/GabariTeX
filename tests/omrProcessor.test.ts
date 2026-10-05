import { describe, it, expect } from 'vitest';
import { getStandardBubbleCoordinates } from '../src/utils/omrProcessor';

describe('Processador OMR', () => {
  it('deve calcular corretamente a quantidade e coordenadas das bolinhas', () => {
    const bubbles = getStandardBubbleCoordinates({
      totalQuestions: 10,
      optionsPerQuestion: 5,
      columnsCount: 1,
    });

    expect(bubbles.length).toBe(50); // 10 questões * 5 opções
    expect(bubbles[0].questionNumber).toBe(1);
    expect(bubbles[0].optionLabel).toBe('A');
    expect(bubbles[4].optionLabel).toBe('E');
    expect(bubbles[49].questionNumber).toBe(10);
    expect(bubbles[49].optionLabel).toBe('E');

    // Valida se as porcentagens estão dentro do intervalo válido [0, 100]
    for (const b of bubbles) {
      expect(b.centerXPercent).toBeGreaterThan(0);
      expect(b.centerXPercent).toBeLessThan(100);
      expect(b.centerYPercent).toBeGreaterThan(0);
      expect(b.centerYPercent).toBeLessThan(100);
      expect(b.radiusPercent).toBeGreaterThan(0);
    }
  });

  it('deve suportar divisão em 2 colunas para provas maiores', () => {
    const bubbles = getStandardBubbleCoordinates({
      totalQuestions: 20,
      optionsPerQuestion: 5,
      columnsCount: 2,
    });

    expect(bubbles.length).toBe(100); // 20 questões * 5 opções
    const q1Bubble = bubbles.find((b) => b.questionNumber === 1 && b.optionLabel === 'A');
    const q11Bubble = bubbles.find((b) => b.questionNumber === 11 && b.optionLabel === 'A');

    expect(q1Bubble).toBeDefined();
    expect(q11Bubble).toBeDefined();
    // Questão 11 deve estar na segunda coluna (X maior que questão 1)
    expect(q11Bubble!.centerXPercent).toBeGreaterThan(q1Bubble!.centerXPercent);
  });
});
