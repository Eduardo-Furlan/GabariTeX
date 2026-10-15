import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { toGray, GrayImage } from '../src/utils/omr/grayImage';
import { detectSheet } from '../src/utils/omr/sheetDetector';
import { readBubbles } from '../src/utils/omr/bubbleReader';
import { OmrDetectionError } from '../src/utils/omr/errors';
import { gradeCanvasWithPayloadDebug } from '../src/utils/omrProcessor';

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

describe('Detecção OMR pura em TypeScript (Fiduciais + Sincronizadores)', () => {
  it('deve rejeitar tests/1.jpg (foto com apenas QR code) sem fiduciais válidos', () => {
    const gray1 = loadJpgAsGray('tests/1.jpg');
    expect(() => detectSheet(gray1, 1, 10)).toThrow(OmrDetectionError);
  });

  it('deve detectar perfeitamente o gabarito e ler as respostas em tests/2.jpg', () => {
    const gray2 = loadJpgAsGray('tests/2.jpg');
    const det = detectSheet(gray2, 1, 10);

    expect(det.corners.length).toBe(4);
    expect(det.columns.length).toBe(1);
    expect(det.columns[0].length).toBe(10);

    const result = readBubbles(gray2, det, {
      totalQuestions: 10,
      subjectiveQuestions: [3, 6],
    });

    expect(result.detections.length).toBe(10);

    const answers = result.detections.map((d) => d.detectedMark || '-');
    // Q1=A, Q2=B, Q3=- (dissertativa), Q4=C, Q5=D, Q6=- (dissertativa), Q7=E, Q8=A, Q9=B, Q10=C
    expect(answers).toEqual(['A', 'B', '-', 'C', 'D', '-', 'E', 'A', 'B', 'C']);
  });

  it('deve detectar perfeitamente o gabarito e ler as respostas em tests/3.jpg (foto real com inclinação)', () => {
    const gray3 = loadJpgAsGray('tests/3.jpg');
    const det = detectSheet(gray3, 1, 10);

    expect(det.corners.length).toBe(4);
    expect(det.columns.length).toBe(1);
    expect(det.columns[0].length).toBe(10);

    const result = readBubbles(gray3, det, {
      totalQuestions: 10,
      subjectiveQuestions: [3, 6],
    });

    expect(result.detections.length).toBe(10);

    const answers = result.detections.map((d) => d.detectedMark || '-');
    expect(answers).toEqual(['A', 'B', '-', 'C', 'D', '-', 'E', 'A', 'B', 'C']);
  });

  it('deve executar gradeCanvasWithPayloadDebug com 100% de acerto em tests/2.jpg', () => {
    const gray2 = loadJpgAsGray('tests/2.jpg');
    const rgba = new Uint8ClampedArray(gray2.width * gray2.height * 4);
    for (let i = 0; i < gray2.width * gray2.height; i++) {
      const g = gray2.data[i];
      const idx = i * 4;
      rgba[idx] = g;
      rgba[idx + 1] = g;
      rgba[idx + 2] = g;
      rgba[idx + 3] = 255;
    }

    const mockCanvas = {
      width: gray2.width,
      height: gray2.height,
      getContext: () => ({
        getImageData: () => ({
          width: gray2.width,
          height: gray2.height,
          data: rgba,
        }),
      }),
    } as unknown as HTMLCanvasElement;

    const payload = {
      examId: 'test-123',
      version: 'A',
      key: { 1: 'A', 2: 'B', 4: 'C', 5: 'D', 7: 'E', 8: 'A', 9: 'B', 10: 'C' },
      points: { 1: 1, 2: 1, 4: 1, 5: 1, 7: 1, 8: 1, 9: 1, 10: 1 },
      totalQuestions: 10,
      subjectiveQuestions: [3, 6],
    };

    const { record, debugInfo } = gradeCanvasWithPayloadDebug(mockCanvas, payload);

    expect(debugInfo.method).toBe('fiducials_timing_marks');
    expect(record.totalScore).toBe(8);
    expect(record.maxScore).toBe(8);
    expect(record.percentage).toBe(100);
  });

  it('deve detectar linhas dinamicamente sem erro quando expectedRows for 0 ou undefined', () => {
    const gray2 = loadJpgAsGray('tests/2.jpg');
    const detZero = detectSheet(gray2, 1, 0);
    expect(detZero.columns[0].length).toBe(10);

    const detUndef = detectSheet(gray2, 1, undefined);
    expect(detUndef.columns[0].length).toBe(10);
  });
});
