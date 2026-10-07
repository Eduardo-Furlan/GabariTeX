import { describe, it, expect } from 'vitest';
import { getStandardBubbleCoordinates, analyzeCanvasOmr, gradeCanvasWithPayload } from '../src/utils/omrProcessor';
import { DecryptedQrPayload } from '../src/types/omr';

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

  it('deve desconsiderar questões dissertativas mantendo a grade das demais alinhada', () => {
    const bubbles = getStandardBubbleCoordinates({
      totalQuestions: 5,
      optionsPerQuestion: 5,
      columnsCount: 1,
      subjectiveQuestions: [2],
    });

    expect(bubbles.length).toBe(20); // 4 questões objetivas * 5 opções
    expect(bubbles.some((b) => b.questionNumber === 2)).toBe(false);

    const q1A = bubbles.find((b) => b.questionNumber === 1 && b.optionLabel === 'A');
    const q3A = bubbles.find((b) => b.questionNumber === 3 && b.optionLabel === 'A');
    expect(q1A).toBeDefined();
    expect(q3A).toBeDefined();
    // A questão 3 deve estar abaixo da linha 2 (pulando a linha da dissertativa)
    expect(q3A!.centerYPercent).toBeGreaterThan(q1A!.centerYPercent);
  });

  it('deve analisar corretamente as bolinhas preenchidas no canvas', () => {
    const width = 200;
    const height = 200;
    const data = new Uint8ClampedArray(width * height * 4);
    // Inicializa tudo com fundo branco
    data.fill(255);

    // Preenche a opção C da questão 1 com preto (centro em x=100, y=100)
    for (let y = 90; y <= 110; y++) {
      for (let x = 90; x <= 110; x++) {
        if ((x - 100) ** 2 + (y - 100) ** 2 <= 64) {
          const idx = (y * width + x) * 4;
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 255;
        }
      }
    }

    const mockCanvas = {
      width,
      height,
      getContext: () => ({
        getImageData: () => ({ width, height, data }),
      }),
    } as unknown as HTMLCanvasElement;

    const bubbles = [
      { questionNumber: 1, optionLabel: 'A' as const, centerXPercent: 20, centerYPercent: 50, radiusPercent: 5 },
      { questionNumber: 1, optionLabel: 'B' as const, centerXPercent: 35, centerYPercent: 50, radiusPercent: 5 },
      { questionNumber: 1, optionLabel: 'C' as const, centerXPercent: 50, centerYPercent: 50, radiusPercent: 5 },
      { questionNumber: 1, optionLabel: 'D' as const, centerXPercent: 65, centerYPercent: 50, radiusPercent: 5 },
      { questionNumber: 1, optionLabel: 'E' as const, centerXPercent: 80, centerYPercent: 50, radiusPercent: 5 },
    ];

    const results = analyzeCanvasOmr(mockCanvas, bubbles);
    expect(results.length).toBe(1);
    expect(results[0].questionNumber).toBe(1);
    expect(results[0].status).toBe('marked');
    expect(results[0].detectedMark).toBe('C');
    expect(results[0].fillRatios['C']).toBeGreaterThan(0.7);
    expect(results[0].fillRatios['A']).toBeLessThan(0.1);
  });

  it('deve calcular o GradingRecord completo com gradeCanvasWithPayload', () => {
    const width = 800;
    const height = 1100;
    const data = new Uint8ClampedArray(width * height * 4);
    data.fill(255); // Fundo branco

    const mockCanvas = {
      width,
      height,
      getContext: () => ({
        getImageData: () => ({ width, height, data }),
      }),
    } as unknown as HTMLCanvasElement;

    const payload: DecryptedQrPayload = {
      examId: 'test-exam',
      version: 'A',
      key: { 1: 'C', 2: 'A' },
      points: { 1: 2.0, 2: 3.0 },
      totalQuestions: 2,
      subjectiveQuestions: [],
    };

    const record = gradeCanvasWithPayload(mockCanvas, payload);
    expect(record.versionLetter).toBe('A');
    expect(record.maxScore).toBe(5.0);
    expect(record.answers.length).toBe(2);
    // Como a folha estava toda em branco, respostas devem ser em branco (0 pontos)
    expect(record.totalScore).toBe(0);
    expect(record.percentage).toBe(0);
    expect(record.answers[0].status).toBe('blank');
    expect(record.answers[1].status).toBe('blank');
  });
});

