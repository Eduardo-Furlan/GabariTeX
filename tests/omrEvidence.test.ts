import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildEvidence } from '../src/utils/omrEvidence';
import { GradingRecord } from '../src/types/exam';
import { OmrDebugInfo } from '../src/types/omr';

describe('omrEvidence', () => {
  const originalDocument = globalThis.document;

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  const dummyRecord: GradingRecord = {
    id: 'rec-1',
    timestamp: Date.now(),
    studentName: 'Aluno Teste',
    studentId: '100',
    versionLetter: 'A',
    totalScore: 5,
    maxScore: 10,
    percentage: 50,
    answers: [
      {
        questionNumber: 1,
        markedOption: 'A',
        correctOption: 'A',
        isCorrect: true,
        status: 'correct',
        pointsEarned: 5,
        maxPoints: 5,
        needsReview: false,
      },
      {
        questionNumber: 2,
        markedOption: 'B',
        correctOption: 'C',
        isCorrect: false,
        status: 'wrong',
        pointsEarned: 0,
        maxPoints: 5,
        needsReview: true,
      },
    ],
  };

  const dummyDebugInfo: OmrDebugInfo = {
    method: 'fiducials_timing_marks',
    bubbles: [
      { questionNumber: 2, optionLabel: 'A', cx: 100, cy: 150, radius: 10, fillRatio: 0.1, isMarked: false },
      { questionNumber: 2, optionLabel: 'B', cx: 130, cy: 150, radius: 10, fillRatio: 0.65, isMarked: true },
      { questionNumber: 2, optionLabel: 'C', cx: 160, cy: 150, radius: 10, fillRatio: 0.1, isMarked: false },
      { questionNumber: 2, optionLabel: 'D', cx: 190, cy: 150, radius: 10, fillRatio: 0.05, isMarked: false },
      { questionNumber: 2, optionLabel: 'E', cx: 220, cy: 150, radius: 10, fillRatio: 0.02, isMarked: false },
    ],
    logs: [],
  };

  it('safely handles missing document or canvas without throwing', () => {
    // @ts-expect-error simulating undefined document
    globalThis.document = undefined;
    const res = buildEvidence(null as unknown as HTMLCanvasElement, dummyDebugInfo, dummyRecord);
    expect(res).toEqual({ rowCrops: {} });
  });

  it('generates row crop for answers with needsReview and thumbnail', () => {
    const drawImageMock = vi.fn();
    const toDataURLMock = vi.fn().mockReturnValue('data:image/jpeg;base64,mockdata');

    const fakeCanvas = {
      width: 1000,
      height: 1400,
      getContext: () => ({
        drawImage: drawImageMock,
      }),
      toDataURL: toDataURLMock,
    };

    // @ts-expect-error mocking document for node test
    globalThis.document = {
      createElement: (tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => ({
              drawImage: drawImageMock,
            }),
            toDataURL: toDataURLMock,
          };
        }
        return {};
      },
    };

    const res = buildEvidence(fakeCanvas as unknown as HTMLCanvasElement, dummyDebugInfo, dummyRecord);

    expect(res.sheetThumbUrl).toBe('data:image/jpeg;base64,mockdata');
    expect(res.rowCrops[2]).toBe('data:image/jpeg;base64,mockdata');
    expect(res.rowCrops[1]).toBeUndefined(); // question 1 didn't need review
  });

  it('safely handles out-of-bounds coordinates without throwing', () => {
    const outOfBoundsDebug: OmrDebugInfo = {
      method: 'fiducials_timing_marks',
      bubbles: [
        { questionNumber: 2, optionLabel: 'A', cx: -50, cy: -20, radius: 20, fillRatio: 0.6, isMarked: true },
      ],
      logs: [],
    };

    const drawImageMock = vi.fn();
    const toDataURLMock = vi.fn().mockReturnValue('data:image/jpeg;base64,mockdata');

    const fakeCanvas = {
      width: 200,
      height: 300,
      getContext: () => ({ drawImage: drawImageMock }),
      toDataURL: toDataURLMock,
    };

    // @ts-expect-error mocking document for node test
    globalThis.document = {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: drawImageMock }),
        toDataURL: toDataURLMock,
      }),
    };

    expect(() => {
      buildEvidence(fakeCanvas as unknown as HTMLCanvasElement, outOfBoundsDebug, dummyRecord);
    }).not.toThrow();
  });
});

