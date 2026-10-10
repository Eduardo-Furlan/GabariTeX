import { BubbleCoordinates, DecryptedQrPayload, OmrRawDetection, SheetCorners } from '../types/omr';
import { GradedAnswer, GradingRecord } from '../types/exam';

export interface GridConfig {
  totalQuestions: number;
  optionsPerQuestion: number;
  columnsCount: number;
  subjectiveQuestions?: number[];
}

/**
 * Calcula as coordenadas relativas (%) de cada bolinha na folha de respostas padronizada.
 */
export function getStandardBubbleCoordinates(config: GridConfig): BubbleCoordinates[] {
  const bubbles: BubbleCoordinates[] = [];
  const { totalQuestions, optionsPerQuestion = 5, columnsCount, subjectiveQuestions = [] } = config;
  const subjectiveSet = new Set(subjectiveQuestions);
  const questionsPerColumn = totalQuestions <= 12 ? totalQuestions : Math.ceil(totalQuestions / columnsCount);
  const optionLabels: ('A' | 'B' | 'C' | 'D' | 'E')[] = ['A', 'B', 'C', 'D', 'E'];

  const startY = 36.5;
  const rowHeight = 3.5;

  for (let q = 1; q <= totalQuestions; q++) {
    const colIndex = Math.floor((q - 1) / questionsPerColumn);
    const rowIndex = (q - 1) % questionsPerColumn;

    if (subjectiveSet.has(q)) {
      continue;
    }

    const rowCenterY = startY + (rowIndex + 0.5) * rowHeight;

    if (columnsCount === 1) {
      const optionsStartX = 35.6;
      const optionSpacing = 8.4;

      for (let o = 0; o < optionsPerQuestion; o++) {
        bubbles.push({
          questionNumber: q,
          optionLabel: optionLabels[o],
          centerXPercent: optionsStartX + o * optionSpacing,
          centerYPercent: rowCenterY,
          radiusPercent: 1.5,
        });
      }
    } else {
      const colBaseX = colIndex === 0 ? 18.0 : 58.0;
      const optionSpacing = 6.0;

      for (let o = 0; o < optionsPerQuestion; o++) {
        bubbles.push({
          questionNumber: q,
          optionLabel: optionLabels[o],
          centerXPercent: colBaseX + o * optionSpacing,
          centerYPercent: rowCenterY,
          radiusPercent: 1.3,
        });
      }
    }
  }

  return bubbles;
}

/**
 * Detecta dinamicamente a caixa delimitadora do gabarito e calcula as coordenadas
 * exatas das bolinhas no canvas.
 */
export function detectOmrGrid(
  canvas: HTMLCanvasElement,
  config: GridConfig
): BubbleCoordinates[] | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const width = canvas.width;
  const height = canvas.height;
  if (width < 100 || height < 100) return null;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const { totalQuestions, subjectiveQuestions = [] } = config;
  const subjectiveSet = new Set(subjectiveQuestions);

  const getDarkness = (x: number, y: number): number => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    const idx = (y * width + x) * 4;
    const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    return (255 - lum) / 255;
  };

  // 1. Bordas verticais da caixa OMR (esquerda e direita)
  let bestLeftX = -1;
  let bestLeftCount = -1;
  const minLeft = Math.floor(width * 0.02);
  const maxLeft = Math.floor(width * 0.30);
  for (let x = minLeft; x <= maxLeft; x++) {
    let count = 0;
    for (let y = Math.floor(height * 0.10); y <= Math.floor(height * 0.90); y += 2) {
      if (getDarkness(x, y) > 0.45) count++;
    }
    if (count > bestLeftCount) {
      bestLeftCount = count;
      bestLeftX = x;
    }
  }

  let bestRightX = -1;
  let bestRightCount = -1;
  const minRight = Math.floor(width * 0.70);
  const maxRight = Math.floor(width * 0.98);
  for (let x = minRight; x <= maxRight; x++) {
    let count = 0;
    for (let y = Math.floor(height * 0.10); y <= Math.floor(height * 0.90); y += 2) {
      if (getDarkness(x, y) > 0.45) count++;
    }
    if (count > bestRightCount) {
      bestRightCount = count;
      bestRightX = x;
    }
  }

  const minBorderPixels = Math.floor(height * 0.10);
  if (
    bestLeftX === -1 ||
    bestRightX === -1 ||
    bestRightX <= bestLeftX + 100 ||
    bestLeftCount < minBorderPixels ||
    bestRightCount < minBorderPixels
  ) {
    return null;
  }

  const leftX = bestLeftX;
  const rightX = bestRightX;
  const span = rightX - leftX;

  // 2. Linhas horizontais entre leftX e rightX com tolerância vertical de inclinação (+/- 2px)
  const solidThreshold = span * 0.65;
  const hLines: number[] = [];
  let currentGroup: { y: number; count: number }[] = [];

  for (let y = 0; y < height; y++) {
    let darkCount = 0;
    for (let x = leftX + 5; x <= rightX - 5; x += 2) {
      if (
        getDarkness(x, y) > 0.45 ||
        (y > 0 && getDarkness(x, y - 1) > 0.45) ||
        (y + 1 < height && getDarkness(x, y + 1) > 0.45) ||
        (y > 1 && getDarkness(x, y - 2) > 0.45) ||
        (y + 2 < height && getDarkness(x, y + 2) > 0.45)
      ) {
        darkCount += 2;
      }
    }
    if (darkCount >= solidThreshold) {
      if (currentGroup.length === 0 || y - currentGroup[currentGroup.length - 1].y <= 4) {
        currentGroup.push({ y, count: darkCount });
      } else {
        const best = currentGroup.reduce((max, cur) => (cur.count > max.count ? cur : max), currentGroup[0]);
        hLines.push(best.y);
        currentGroup = [{ y, count: darkCount }];
      }
    }
  }
  if (currentGroup.length > 0) {
    const best = currentGroup.reduce((max, cur) => (cur.count > max.count ? cur : max), currentGroup[0]);
    hLines.push(best.y);
  }

  // Encontra a maior caixa sólida onde as bordas esquerda e direita são contínuas sem falhas
  let bestBox: { top: number; bottom: number } | null = null;
  let maxBoxH = 0;

  for (let i = 0; i < hLines.length; i++) {
    for (let j = i + 1; j < hLines.length; j++) {
      const y1 = hLines[i];
      const y2 = hLines[j];
      const boxH = y2 - y1;
      if (boxH < 150) continue;

      let maxLeftGap = 0;
      let curLeftGap = 0;
      for (let y = y1; y <= y2; y++) {
        let hasDark = false;
        for (let dx = -14; dx <= 14; dx++) {
          if (getDarkness(leftX + dx, y) >= 0.35) {
            hasDark = true;
            break;
          }
        }
        if (!hasDark) {
          curLeftGap++;
          if (curLeftGap > maxLeftGap) maxLeftGap = curLeftGap;
        } else {
          curLeftGap = 0;
        }
      }

      let maxRightGap = 0;
      let curRightGap = 0;
      for (let y = y1; y <= y2; y++) {
        let hasDark = false;
        for (let dx = -14; dx <= 14; dx++) {
          if (getDarkness(rightX + dx, y) >= 0.35) {
            hasDark = true;
            break;
          }
        }
        if (!hasDark) {
          curRightGap++;
          if (curRightGap > maxRightGap) maxRightGap = curRightGap;
        } else {
          curRightGap = 0;
        }
      }

      if (maxLeftGap <= 40 && maxRightGap <= 40 && boxH >= Math.floor(height * 0.25)) {
        if (boxH > maxBoxH) {
          maxBoxH = boxH;
          bestBox = { top: y1, bottom: y2 };
        }
      }
    }
  }

  if (!bestBox) {
    return null;
  }

  const { top: boxTop, bottom: boxBottom } = bestBox;
  const boxH = boxBottom - boxTop;

  // 3. Linha divisória de cabeçalho dentro da caixa OMR (nos primeiros 50% da caixa)
  const hdrSearchEnd = boxTop + Math.floor(boxH * 0.50);
  let bestHdrY = -1;
  let bestHdrSum = 0;

  for (let y = boxTop + 10; y <= hdrSearchEnd; y++) {
    let sum = 0;
    for (let x = leftX + 10; x <= rightX - 10; x += 2) {
      sum += getDarkness(x, y);
    }
    if (sum > bestHdrSum) {
      bestHdrSum = sum;
      bestHdrY = y;
    }
  }

  if (bestHdrY === -1 || bestHdrSum < span * 0.15) {
    return null;
  }

  // Segmentos contínuos da linha de cabeçalho
  const segments: { start: number; end: number }[] = [];
  let inSegment = false;
  let segStart = 0;

  for (let x = leftX + 10; x <= rightX - 10; x++) {
    const isDark = getDarkness(x, bestHdrY) > 0.45;
    if (isDark && !inSegment) {
      inSegment = true;
      segStart = x;
    } else if (!isDark && inSegment) {
      inSegment = false;
      if (x - segStart > 40) {
        segments.push({ start: segStart, end: x });
      }
    }
  }
  if (inSegment && (rightX - 10 - segStart) > 40) {
    segments.push({ start: segStart, end: rightX - 10 });
  }

  if (segments.length === 0) {
    return null;
  }

  const actualCols = segments.length;
  const questionsPerColumn = totalQuestions <= 12 ? totalQuestions : Math.ceil(totalQuestions / actualCols);

  const optionLabels: ('A' | 'B' | 'C' | 'D' | 'E')[] = ['A', 'B', 'C', 'D', 'E'];
  const bubbles: BubbleCoordinates[] = [];

  for (let colIdx = 0; colIdx < segments.length; colIdx++) {
    const { start: segStart, end: segEnd } = segments[colIdx];
    const segW = segEnd - segStart;

    // Mede a inclinação (tilt slope) da linha de cabeçalho para calibrar os eixos X e Y
    const xSampleLeft = Math.floor(segStart + segW * 0.15);
    const xSampleRight = Math.floor(segEnd - segW * 0.15);

    let yLeft = bestHdrY;
    let maxDarkLeft = -1;
    for (let dy = -10; dy <= 10; dy++) {
      let dSum = 0;
      for (let dx = -3; dx <= 3; dx++) {
        dSum += getDarkness(xSampleLeft + dx, bestHdrY + dy);
      }
      if (dSum > maxDarkLeft) {
        maxDarkLeft = dSum;
        yLeft = bestHdrY + dy;
      }
    }

    let yRight = bestHdrY;
    let maxDarkRight = -1;
    for (let dy = -10; dy <= 10; dy++) {
      let dSum = 0;
      for (let dx = -3; dx <= 3; dx++) {
        dSum += getDarkness(xSampleRight + dx, bestHdrY + dy);
      }
      if (dSum > maxDarkRight) {
        maxDarkRight = dSum;
        yRight = bestHdrY + dy;
      }
    }

    const tiltSlope = (xSampleRight > xSampleLeft) ? (yRight - yLeft) / (xSampleRight - xSampleLeft) : 0;
    const firstRowY0 = (yLeft + yRight) / 2 + segW * 0.0654 - tiltSlope * ((xSampleLeft + xSampleRight) / 2 - segStart);
    const rowPitch = segW * 0.1035;
    const radiusPercent = ((segW * 0.031) / Math.min(width, height)) * 100;

    for (let rIdx = 0; rIdx < questionsPerColumn; rIdx++) {
      const qNum = colIdx * questionsPerColumn + rIdx + 1;
      if (qNum > totalQuestions) break;
      if (subjectiveSet.has(qNum)) continue;

      const baseCy = firstRowY0 + rIdx * rowPitch;

      for (let oIdx = 0; oIdx < 5; oIdx++) {
        const cx = segStart + segW * (0.180 + oIdx * 0.181);
        const cy = baseCy + tiltSlope * (cx - segStart);
        const cxPercent = (cx / width) * 100;
        const cyPercent = (cy / height) * 100;

        bubbles.push({
          questionNumber: qNum,
          optionLabel: optionLabels[oIdx],
          centerXPercent: cxPercent,
          centerYPercent: cyPercent,
          radiusPercent,
        });
      }
    }
  }

  return bubbles;
}

/**
 * Aplica transformação de perspectiva e analisa o preenchimento das bolinhas no Canvas.
 */
export function analyzeCanvasOmr(
  canvas: HTMLCanvasElement,
  bubbles: BubbleCoordinates[],
  _corners?: SheetCorners,
  config?: GridConfig
): OmrRawDetection[] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  const width = canvas.width;
  const height = canvas.height;

  // Tenta detecção dinâmica da grade na imagem
  let bubblesToUse = bubbles;
  const inferredConfig: GridConfig = config
    ? config
    : {
        totalQuestions: bubbles.length > 0 ? Math.max(...bubbles.map((b) => b.questionNumber)) : 0,
        optionsPerQuestion: 5,
        columnsCount: bubbles.some((b) => b.centerXPercent > 50 && b.questionNumber <= 12) ? 1 : 2,
        subjectiveQuestions: [],
      };

  const detectedBubbles = detectOmrGrid(canvas, inferredConfig);
  if (detectedBubbles && detectedBubbles.length > 0) {
    bubblesToUse = detectedBubbles;
  }

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const questionMap = new Map<number, { label: 'A' | 'B' | 'C' | 'D' | 'E'; darkness: number }[]>();

  for (const b of bubblesToUse) {
    const cx = (b.centerXPercent / 100) * width;
    const cy = (b.centerYPercent / 100) * height;
    const r = (b.radiusPercent / 100) * Math.min(width, height);
    const sampleRadius = Math.max(2, Math.floor(r * 0.65));

    // Busca na vizinhança local proporcional ao raio para máxima robustez contra deslocamentos
    const searchWindow = Math.max(5, Math.floor(r * 0.75));
    let bestFillRatio = 0;

    for (let dy = -searchWindow; dy <= searchWindow; dy += 2) {
      for (let dx = -searchWindow; dx <= searchWindow; dx += 2) {
        const scx = cx + dx;
        const scy = cy + dy;
        let darkPixels = 0;
        let totalPixels = 0;
        let sumDarkness = 0;

        for (let py = -sampleRadius; py <= sampleRadius; py++) {
          const iy = Math.floor(scy + py);
          if (iy < 0 || iy >= height) continue;
          for (let px = -sampleRadius; px <= sampleRadius; px++) {
            if (px * px + py * py <= sampleRadius * sampleRadius) {
              const ix = Math.floor(scx + px);
              if (ix < 0 || ix >= width) continue;
              const idx = (iy * width + ix) * 4;
              const rVal = data[idx];
              const gVal = data[idx + 1];
              const bVal = data[idx + 2];
              const lum = 0.299 * rVal + 0.587 * gVal + 0.114 * bVal;
              const darkness = (255 - lum) / 255;
              sumDarkness += darkness;
              if (darkness > 0.45) {
                darkPixels++;
              }
              totalPixels++;
            }
          }
        }

        const fillRatio = totalPixels > 0 ? (darkPixels / totalPixels) * 0.7 + (sumDarkness / totalPixels) * 0.3 : 0;
        if (fillRatio > bestFillRatio) {
          bestFillRatio = fillRatio;
        }
      }
    }

    if (!questionMap.has(b.questionNumber)) {
      questionMap.set(b.questionNumber, []);
    }
    questionMap.get(b.questionNumber)!.push({
      label: b.optionLabel,
      darkness: bestFillRatio,
    });
  }

  const results: OmrRawDetection[] = [];

  for (const [qNum, options] of questionMap.entries()) {
    const fillRatios: Record<'A' | 'B' | 'C' | 'D' | 'E', number> = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      E: 0,
    };

    options.forEach((opt) => {
      fillRatios[opt.label] = opt.darkness;
    });

    const sorted = [...options].sort((a, b) => b.darkness - a.darkness);
    const top = sorted[0];
    const second = sorted[1];

    const MARK_THRESHOLD = 0.40;
    const DIFFERENCE_THRESHOLD = 0.15;

    let detectedMark: 'A' | 'B' | 'C' | 'D' | 'E' | null = null;
    let status: 'marked' | 'blank' | 'multiple' = 'blank';

    if (top && top.darkness >= MARK_THRESHOLD) {
      if (second && second.darkness >= MARK_THRESHOLD && top.darkness - second.darkness < DIFFERENCE_THRESHOLD) {
        status = 'multiple';
      } else {
        status = 'marked';
        detectedMark = top.label;
      }
    }

    results.push({
      questionNumber: qNum,
      fillRatios,
      detectedMark,
      status,
    });
  }

  return results.sort((a, b) => a.questionNumber - b.questionNumber);
}

/**
 * Mapeia 4 cantos arbitrários para um retângulo plano de destino.
 */
export function warpPerspectiveCanvas(
  sourceCanvas: HTMLCanvasElement,
  corners: SheetCorners,
  targetWidth: number = 800,
  targetHeight: number = 1100
): HTMLCanvasElement {
  const destCanvas = document.createElement('canvas');
  destCanvas.width = targetWidth;
  destCanvas.height = targetHeight;
  const destCtx = destCanvas.getContext('2d');
  if (!destCtx) return destCanvas;

  destCtx.drawImage(
    sourceCanvas,
    corners.topLeft.x,
    corners.topLeft.y,
    corners.topRight.x - corners.topLeft.x,
    corners.bottomLeft.y - corners.topLeft.y,
    0,
    0,
    targetWidth,
    targetHeight
  );

  return destCanvas;
}

/**
 * Avalia um Canvas com a folha de respostas usando um gabarito descriptografado (DecryptedQrPayload)
 * e produz o registro completo de correção (GradingRecord).
 */
export function gradeCanvasWithPayload(
  canvas: HTMLCanvasElement,
  payload: DecryptedQrPayload
): GradingRecord {
  const totalQuestions =
    payload.totalQuestions ??
    Math.max(...Object.keys(payload.key).map(Number), 0);
  const subjectiveQuestions = payload.subjectiveQuestions ?? [];
  const columnsCount = totalQuestions <= 12 ? 1 : 2;

  const gridConfig: GridConfig = {
    totalQuestions,
    optionsPerQuestion: 5,
    columnsCount,
    subjectiveQuestions,
  };

  const bubbles = getStandardBubbleCoordinates(gridConfig);
  const omrDetections = analyzeCanvasOmr(canvas, bubbles, undefined, gridConfig);

  let totalPoints = 0;
  let maxPoints = 0;
  const answers: GradedAnswer[] = [];

  const objectiveQuestionNumbers = Object.keys(payload.key)
    .map(Number)
    .sort((a, b) => a - b);

  for (const i of objectiveQuestionNumbers) {
    const correctOpt = payload.key[i] || 'A';
    const qPoint = payload.points?.[i] ?? 1.0;
    maxPoints += qPoint;

    const detected = omrDetections.find((d) => d.questionNumber === i);
    const marked = detected?.detectedMark || null;
    const isCorrect = marked === correctOpt;
    const pointsEarned = isCorrect ? qPoint : 0;
    totalPoints += pointsEarned;

    answers.push({
      questionNumber: i,
      markedOption: marked,
      correctOption: correctOpt,
      isCorrect,
      status:
        detected?.status === 'multiple'
          ? 'multiple'
          : marked === null
          ? 'blank'
          : isCorrect
          ? 'correct'
          : 'wrong',
      pointsEarned,
      maxPoints: qPoint,
    });
  }

  const percentage = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0;

  return {
    id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    studentName: '',
    studentId: '',
    versionLetter: payload.version,
    totalScore: totalPoints,
    maxScore: maxPoints,
    percentage,
    answers,
  };
}
