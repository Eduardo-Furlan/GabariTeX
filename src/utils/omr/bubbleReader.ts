import { GrayImage } from './grayImage';
import { SheetDetectionResult } from './sheetDetector';
import {
  BubbleCoordinates,
  OmrBubbleDebug,
  OmrRawDetection,
  OmrTimingMarkDebug,
} from '../../types/omr';
import {
  bubbleRadiusPx,
  getColumnLayout,
  markSpanPx,
  optionCenterOffsetsPx,
} from '../sheetLayout';
import { OmrDetectionError } from './errors';

export const FR = optionCenterOffsetsPx().map((offset) =>
  Number((offset / markSpanPx()).toFixed(3))
);
export const OPTION_LABELS: ('A' | 'B' | 'C' | 'D' | 'E')[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
];

export interface BubbleReaderOptions {
  totalQuestions: number;
  subjectiveQuestions?: number[];
  optionsPerQuestion?: number;
  innerRadiusFactor?: number;
  ambiguousThreshold?: number;
  markedThreshold?: number;
}

export interface BubbleReaderResult {
  detections: OmrRawDetection[];
  bubbles: BubbleCoordinates[];
  debugBubbles: OmrBubbleDebug[];
  timingMarks: OmrTimingMarkDebug[];
}

/**
 * Lê e classifica o preenchimento de cada bolinha com base na folha e linhas detectadas.
 */
export function readBubbles(
  gray: GrayImage,
  det: SheetDetectionResult,
  options: BubbleReaderOptions
): BubbleReaderResult {
  const {
    totalQuestions,
    subjectiveQuestions = [],
    optionsPerQuestion = 5,
    innerRadiusFactor = 0.70,
    ambiguousThreshold = 0.35,
    markedThreshold = 0.55,
  } = options;

  const { width, height, data } = gray;
  const subjectiveSet = new Set(subjectiveQuestions);

  // 1. Amostra a intensidade média da tinta sobre os sincronizadores detectados
  const inkSamples: number[] = [];
  for (const col of det.columns) {
    for (const [l, r] of col) {
      for (const p of [l, r]) {
        const px = Math.round(p.x);
        const py = Math.round(p.y);
        if (px >= 1 && px < width - 1 && py >= 1 && py < height - 1) {
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const rowOffset = (py + dy) * width;
            for (let dx = -1; dx <= 1; dx++) {
              sum += data[rowOffset + px + dx];
            }
          }
          inkSamples.push(sum / 9);
        }
      }
    }
  }

  inkSamples.sort((a, b) => a - b);
  const ink =
    inkSamples.length > 0
      ? inkSamples[Math.floor(inkSamples.length / 2)]
      : 50.0;

  const detections: OmrRawDetection[] = [];
  const bubbles: BubbleCoordinates[] = [];
  const debugBubbles: OmrBubbleDebug[] = [];
  const timingMarks: OmrTimingMarkDebug[] = [];

  const span = markSpanPx();
  const offsets = optionCenterOffsetsPx();
  const baseRad = bubbleRadiusPx();

  // Validação geométrica: variação de escala entre linhas e compatibilidade com fiduciais
  const scales: number[] = [];
  for (const col of det.columns) {
    for (const [l, r] of col) {
      const d = Math.hypot(r.x - l.x, r.y - l.y);
      scales.push(d / span);
    }
  }

  if (scales.length > 0) {
    const sortedScales = [...scales].sort((a, b) => a - b);
    const medianScale = sortedScales[Math.floor(sortedScales.length / 2)];
    if (medianScale > 0) {
      const maxDev = Math.max(...scales.map((s) => Math.abs(s - medianScale) / medianScale));
      if (maxDev > 0.25) {
        throw new OmrDetectionError(
          'INVALID_GEOMETRY',
          `Variação excessiva de escala entre linhas (${(maxDev * 100).toFixed(1)}% > 25%). Folha pode estar amassada ou distorcida.`
        );
      }

      if (det.corners && det.corners.length === 4) {
        const topFidDist = Math.hypot(det.corners[1].x - det.corners[0].x, det.corners[1].y - det.corners[0].y);
        const bottomFidDist = Math.hypot(det.corners[2].x - det.corners[3].x, det.corners[2].y - det.corners[3].y);
        const fidWidth = Math.max(topFidDist, bottomFidDist);
        const medianDist = medianScale * span;
        if (fidWidth > 0 && (medianDist < 0.1 * fidWidth || medianDist > 1.1 * fidWidth)) {
          throw new OmrDetectionError(
            'INVALID_GEOMETRY',
            'Largura das linhas incompatível com o tamanho dos fiduciais da folha.'
          );
        }
      }
    }
  }

  const { perColumn: questionsPerColumn } = getColumnLayout(totalQuestions);

  for (let cIdx = 0; cIdx < det.columns.length; cIdx++) {
    const colPairs = det.columns[cIdx];
    for (let rIdx = 0; rIdx < colPairs.length; rIdx++) {
      const currentQ = cIdx * questionsPerColumn + rIdx + 1;
      if (currentQ > totalQuestions) {
        continue;
      }

      const [l, r] = colPairs[rIdx];

      timingMarks.push({
        rowNumber: currentQ,
        leftX: l.x,
        leftY: l.y,
        rightX: r.x,
        rightY: r.y,
      });

      const isSubjective = subjectiveSet.has(currentQ);
      const dx = r.x - l.x;
      const dy = r.y - l.y;
      const dist = Math.hypot(dx, dy);
      const lineScale = span > 0 ? dist / span : 1;
      const rad = baseRad * lineScale;
      const dirX = dist > 0 ? dx / dist : 1;
      const dirY = dist > 0 ? dy / dist : 0;

      const fillRatios: Record<'A' | 'B' | 'C' | 'D' | 'E', number> = {
        A: 0,
        B: 0,
        C: 0,
        D: 0,
        E: 0,
      };

      const rIn = Math.max(2, Math.round(rad * innerRadiusFactor));
      const rOut1 = Math.round(rad * 1.4);
      const rOut2 = Math.round(rad * 1.9);
      const rInSq = rIn * rIn;
      const rOut1Sq = rOut1 * rOut1;
      const rOut2Sq = rOut2 * rOut2;

      const numOptions = Math.min(optionsPerQuestion, offsets.length);
      for (let o = 0; o < numOptions; o++) {
        const optLabel = OPTION_LABELS[o];
        const offset = offsets[o];
        const cx = l.x + dirX * offset * lineScale;
        const cy = l.y + dirY * offset * lineScale;
        const cxRound = Math.round(cx);
        const cyRound = Math.round(cy);

        bubbles.push({
          questionNumber: currentQ,
          optionLabel: optLabel,
          centerXPercent: (cx / width) * 100,
          centerYPercent: (cy / height) * 100,
          radiusPercent: (rad / Math.min(width, height)) * 100,
        });

        if (isSubjective) {
          continue;
        }

        // Amostra o anel de papel circundante [1.4*r, 1.9*r]
        const yMin = Math.max(0, cyRound - rOut2);
        const yMax = Math.min(height - 1, cyRound + rOut2);
        const xMin = Math.max(0, cxRound - rOut2);
        const xMax = Math.min(width - 1, cxRound + rOut2);

        const ringValues: number[] = [];
        for (let py = yMin; py <= yMax; py++) {
          const rowOffset = py * width;
          const dySq = (py - cyRound) * (py - cyRound);
          for (let px = xMin; px <= xMax; px++) {
            const dSq = (px - cxRound) * (px - cxRound) + dySq;
            if (dSq >= rOut1Sq && dSq <= rOut2Sq) {
              ringValues.push(data[rowOffset + px]);
            }
          }
        }

        ringValues.sort((a, b) => a - b);
        const paper =
          ringValues.length > 0
            ? ringValues[Math.floor(ringValues.length / 2)]
            : 200.0;

        const thr = (paper + ink) / 2.0;

        // Amostra o disco interno de raio rIn
        let diskCount = 0;
        let darkCount = 0;
        const inYMin = Math.max(0, cyRound - rIn);
        const inYMax = Math.min(height - 1, cyRound + rIn);
        const inXMin = Math.max(0, cxRound - rIn);
        const inXMax = Math.min(width - 1, cxRound + rIn);

        for (let py = inYMin; py <= inYMax; py++) {
          const rowOffset = py * width;
          const dySq = (py - cyRound) * (py - cyRound);
          for (let px = inXMin; px <= inXMax; px++) {
            const dSq = (px - cxRound) * (px - cxRound) + dySq;
            if (dSq <= rInSq) {
              diskCount++;
              if (data[rowOffset + px] < thr) {
                darkCount++;
              }
            }
          }
        }

        const fill = diskCount > 0 ? darkCount / diskCount : 0;
        fillRatios[optLabel] = fill;

        debugBubbles.push({
          questionNumber: currentQ,
          optionLabel: optLabel,
          cx,
          cy,
          radius: rad,
          fillRatio: fill,
          isMarked: fill >= markedThreshold,
        });
      }

      if (isSubjective) {
        detections.push({
          questionNumber: currentQ,
          fillRatios,
          detectedMark: null,
          status: 'blank',
        });
        continue;
      }

      // Decisão da resposta da questão
      const markedIndices: number[] = [];
      const ambiguousIndices: number[] = [];

      for (let o = 0; o < 5; o++) {
        const val = fillRatios[OPTION_LABELS[o]];
        if (val >= markedThreshold) {
          markedIndices.push(o);
        } else if (val >= ambiguousThreshold) {
          ambiguousIndices.push(o);
        }
      }

      let detectedMark: 'A' | 'B' | 'C' | 'D' | 'E' | null = null;
      let status: 'marked' | 'blank' | 'multiple' = 'blank';

      if (markedIndices.length === 1 && ambiguousIndices.length === 0) {
        status = 'marked';
        detectedMark = OPTION_LABELS[markedIndices[0]];
      } else if (markedIndices.length === 0 && ambiguousIndices.length === 0) {
        status = 'blank';
        detectedMark = null;
      } else {
        status = 'multiple';
        detectedMark = null;
      }

      detections.push({
        questionNumber: currentQ,
        fillRatios,
        detectedMark,
        status,
      });
    }
  }

  // Ordena por número da questão
  detections.sort((a, b) => a.questionNumber - b.questionNumber);

  return {
    detections,
    bubbles,
    debugBubbles,
    timingMarks,
  };
}
