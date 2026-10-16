import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { GrayImage } from '../src/utils/omr/grayImage';
import { detectSheet, SheetDetectionResult } from '../src/utils/omr/sheetDetector';
import { readBubbles } from '../src/utils/omr/bubbleReader';
import { OmrDetectionError } from '../src/utils/omr/errors';
import { gradeCanvasWithPayloadDebug } from '../src/utils/omrProcessor';
import { Point2D } from '../src/utils/omr/homography';
import {
  getColumnLayout,
  markSpanPx,
  optionCenterOffsetsPx,
  bubbleRadiusPx,
} from '../src/utils/sheetLayout';

function loadJpgAsGray(path: string): GrayImage {
  const pyCode = `
import sys
from PIL import Image
im = Image.open("${path}").convert("L")
w, h = im.size
sys.stdout.buffer.write(w.to_bytes(4, "big"))
sys.stdout.buffer.write(h.to_bytes(4, "big"))
sys.stdout.buffer.write(im.tobytes())
`;
  const buf = execSync('python3', { input: pyCode, maxBuffer: 50 * 1024 * 1024 });
  const width = buf.readUInt32BE(0);
  const height = buf.readUInt32BE(4);
  const data = new Uint8Array(buf.subarray(8));
  return { width, height, data };
}

function createSyntheticSheet(options: {
  totalQuestions: number;
  answers: Record<number, 'A' | 'B' | 'C' | 'D' | 'E'>;
  subjectiveQuestions?: number[];
  scale?: number;
}): { gray: GrayImage; det: SheetDetectionResult; canvas: HTMLCanvasElement } {
  const width = 800;
  const height = 1100;
  const grayData = new Uint8Array(width * height);
  grayData.fill(255);

  const layout = getColumnLayout(options.totalQuestions);
  const span = markSpanPx();
  const offsets = optionCenterOffsetsPx();
  const rad = bubbleRadiusPx();
  const scale = options.scale ?? 1.0;
  const scaledSpan = span * scale;
  const scaledRad = rad * scale;

  const fiducials: [Point2D, Point2D, Point2D, Point2D] = [
    { x: 40, y: 40 },
    { x: 760, y: 40 },
    { x: 760, y: 1060 },
    { x: 40, y: 1060 },
  ];

  const columns: [Point2D, Point2D][][] = [];
  const startY = 100;
  const rowHeight = 22 * scale;

  for (let c = 0; c < layout.columns; c++) {
    const colPairs: [Point2D, Point2D][] = [];
    const numRows =
      c === 0 ? layout.perColumn : options.totalQuestions - layout.perColumn;
    const colStartX =
      layout.columns === 1
        ? (width - scaledSpan) / 2
        : c === 0
        ? 100
        : 450;

    for (let r = 0; r < numRows; r++) {
      const qNum = c * layout.perColumn + r + 1;
      const y = startY + r * rowHeight;
      const lx = colStartX;
      const rx = colStartX + scaledSpan;

      colPairs.push([
        { x: lx, y },
        { x: rx, y },
      ]);

      // Desenha sincronizadores esquerdo e direito (preto)
      for (let dy = -5; dy <= 5; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          const py = Math.round(y + dy);
          const pxL = Math.round(lx + dx);
          const pxR = Math.round(rx + dx);
          if (py >= 0 && py < height && pxL >= 0 && pxL < width) {
            grayData[py * width + pxL] = 20;
          }
          if (py >= 0 && py < height && pxR >= 0 && pxR < width) {
            grayData[py * width + pxR] = 20;
          }
        }
      }

      if (options.subjectiveQuestions?.includes(qNum)) {
        continue;
      }

      const markedOpt = options.answers[qNum];
      const optLabels: ('A' | 'B' | 'C' | 'D' | 'E')[] = ['A', 'B', 'C', 'D', 'E'];
      for (let o = 0; o < offsets.length; o++) {
        const bx = lx + offsets[o] * scale;
        const by = y;
        const isMarked = optLabels[o] === markedOpt;

        for (let dy = -Math.round(scaledRad) - 2; dy <= Math.round(scaledRad) + 2; dy++) {
          for (let dx = -Math.round(scaledRad) - 2; dx <= Math.round(scaledRad) + 2; dx++) {
            const dSq = dx * dx + dy * dy;
            const px = Math.round(bx + dx);
            const py = Math.round(by + dy);
            if (px >= 0 && px < width && py >= 0 && py < height) {
              if (isMarked && dSq <= (scaledRad * 0.75) ** 2) {
                grayData[py * width + px] = 15;
              } else if (dSq >= (scaledRad - 1) ** 2 && dSq <= (scaledRad + 1) ** 2) {
                grayData[py * width + px] = 40;
              }
            }
          }
        }
      }
    }
    columns.push(colPairs);
  }

  const gray: GrayImage = { width, height, data: grayData };
  const det: SheetDetectionResult = {
    corners: fiducials,
    columns,
    scale: 1.0,
  };

  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const val = grayData[i];
    const idx = i * 4;
    rgba[idx] = val;
    rgba[idx + 1] = val;
    rgba[idx + 2] = val;
    rgba[idx + 3] = 255;
  }

  const canvas = {
    width,
    height,
    getContext: () => ({
      getImageData: () => ({ width, height, data: rgba }),
    }),
  } as unknown as HTMLCanvasElement;

  return { gray, det, canvas };
}

describe('Detecção OMR pura em TypeScript (Fiduciais + Sincronizadores)', () => {
  it('deve rejeitar tests/1.jpg (foto com apenas QR code) sem fiduciais válidos', () => {
    const gray1 = loadJpgAsGray('tests/1.jpg');
    expect(() => detectSheet(gray1, 1, 10)).toThrow(OmrDetectionError);
  });

  it('deve rejeitar tests/4qr.png (foto focada apenas no QR code) sem fiduciais válidos', () => {
    const gray4qr = loadJpgAsGray('tests/4qr.png');
    expect(() => detectSheet(gray4qr, 1, 10)).toThrow(OmrDetectionError);
  });

  it('deve detectar perfeitamente os 4 fiduciais e sincronizadores de linha em tests/2.jpg e tests/3.jpg', () => {
    const gray2 = loadJpgAsGray('tests/2.jpg');
    const det2 = detectSheet(gray2, 1, 10);
    expect(det2.corners.length).toBe(4);
    expect(det2.columns.length).toBe(1);
    expect(det2.columns[0].length).toBe(10);

    const gray3 = loadJpgAsGray('tests/3.jpg');
    const det3 = detectSheet(gray3, 1, 10);
    expect(det3.corners.length).toBe(4);
    expect(det3.columns.length).toBe(1);
    expect(det3.columns[0].length).toBe(10);
  });

  it('deve ler com 100% de precisão as respostas na nova geometria de 1 coluna (10 questões)', () => {
    const answers: Record<number, 'A' | 'B' | 'C' | 'D' | 'E'> = {
      1: 'A',
      2: 'B',
      4: 'C',
      5: 'D',
      7: 'E',
      8: 'A',
      9: 'B',
      10: 'C',
    };

    const { gray, det } = createSyntheticSheet({
      totalQuestions: 10,
      answers,
      subjectiveQuestions: [3, 6],
    });

    const result = readBubbles(gray, det, {
      totalQuestions: 10,
      subjectiveQuestions: [3, 6],
    });

    expect(result.detections.length).toBe(10);
    const readAnswers = result.detections.map((d) => d.detectedMark || '-');
    expect(readAnswers).toEqual(['A', 'B', '-', 'C', 'D', '-', 'E', 'A', 'B', 'C']);
  });

  it('deve ler corretamente prova de 2 colunas com número ímpar de questões (13 questões)', () => {
    const answers: Record<number, 'A' | 'B' | 'C' | 'D' | 'E'> = {
      1: 'A',
      2: 'B',
      3: 'C',
      4: 'D',
      5: 'E',
      6: 'A',
      7: 'B',
      8: 'C',
      9: 'D',
      10: 'E',
      11: 'A',
      12: 'B',
      13: 'C',
    };

    const { gray, det } = createSyntheticSheet({
      totalQuestions: 13,
      answers,
    });

    // Coluna 1 deve ter 7 linhas e Coluna 2 deve ter 6 linhas
    expect(det.columns[0].length).toBe(7);
    expect(det.columns[1].length).toBe(6);

    const result = readBubbles(gray, det, {
      totalQuestions: 13,
    });

    expect(result.detections.length).toBe(13);
    const readAnswers = result.detections.map((d) => d.detectedMark);
    expect(readAnswers).toEqual([
      'A', 'B', 'C', 'D', 'E', 'A', 'B', 'C', 'D', 'E', 'A', 'B', 'C',
    ]);
  });

  it('deve resolver a regressão de 2 colunas (20 questões), lendo A e B da coluna 2 com perfeição', () => {
    const answers: Record<number, 'A' | 'B' | 'C' | 'D' | 'E'> = {
      1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E',
      6: 'A', 7: 'B', 8: 'C', 9: 'D', 10: 'E',
      11: 'A', 12: 'B', 13: 'C', 14: 'D', 15: 'E',
      16: 'A', 17: 'B', 18: 'C', 19: 'D', 20: 'E',
    };

    const { gray, det } = createSyntheticSheet({
      totalQuestions: 20,
      answers,
    });

    const result = readBubbles(gray, det, {
      totalQuestions: 20,
    });

    expect(result.detections.length).toBe(20);
    // Verifica especificamente as alternativas A e B da coluna 2 (Q11 e Q12)
    const q11 = result.detections.find((d) => d.questionNumber === 11);
    const q12 = result.detections.find((d) => d.questionNumber === 12);
    expect(q11?.detectedMark).toBe('A');
    expect(q12?.detectedMark).toBe('B');

    const allRead = result.detections.map((d) => d.detectedMark);
    expect(allRead).toEqual([
      'A', 'B', 'C', 'D', 'E',
      'A', 'B', 'C', 'D', 'E',
      'A', 'B', 'C', 'D', 'E',
      'A', 'B', 'C', 'D', 'E',
    ]);
  });

  it('deve suportar o limite máximo de 40 questões em 2 colunas (20 + 20)', () => {
    const answers: Record<number, 'A' | 'B' | 'C' | 'D' | 'E'> = {};
    const labels: ('A' | 'B' | 'C' | 'D' | 'E')[] = ['A', 'B', 'C', 'D', 'E'];
    for (let q = 1; q <= 40; q++) {
      answers[q] = labels[(q - 1) % 5];
    }

    const { gray, det } = createSyntheticSheet({
      totalQuestions: 40,
      answers,
    });

    expect(det.columns[0].length).toBe(20);
    expect(det.columns[1].length).toBe(20);

    const result = readBubbles(gray, det, {
      totalQuestions: 40,
    });

    expect(result.detections.length).toBe(40);
    for (let q = 1; q <= 40; q++) {
      expect(result.detections[q - 1].detectedMark).toBe(answers[q]);
    }
  });

  it('deve rejeitar com INVALID_GEOMETRY se houver variação excessiva de escala entre linhas (> 25%)', () => {
    const { gray, det } = createSyntheticSheet({
      totalQuestions: 10,
      answers: { 1: 'A' },
    });

    // Introduz distorção extrema na linha 5 (> 30% maior que as outras)
    const [l, r] = det.columns[0][4];
    det.columns[0][4] = [
      { x: l.x - 50, y: l.y },
      { x: r.x + 50, y: r.y },
    ];

    expect(() =>
      readBubbles(gray, det, {
        totalQuestions: 10,
      })
    ).toThrow(OmrDetectionError);
  });
});


