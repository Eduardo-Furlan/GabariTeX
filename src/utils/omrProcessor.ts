import { BubbleCoordinates, OmrRawDetection, SheetCorners } from '../types/omr';

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
  const questionsPerColumn = Math.ceil(totalQuestions / columnsCount);
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
  const minLeft = Math.floor(width * 0.05);
  const maxLeft = Math.floor(width * 0.20);
  for (let x = minLeft; x <= maxLeft; x++) {
    let count = 0;
    for (let y = Math.floor(height * 0.15); y <= Math.floor(height * 0.85); y += 2) {
      if (getDarkness(x, y) > 0.45) count++;
    }
    if (count > bestLeftCount) {
      bestLeftCount = count;
      bestLeftX = x;
    }
  }

  let bestRightX = -1;
  let bestRightCount = -1;
  const minRight = Math.floor(width * 0.80);
  const maxRight = Math.floor(width * 0.95);
  for (let x = minRight; x <= maxRight; x++) {
    let count = 0;
    for (let y = Math.floor(height * 0.15); y <= Math.floor(height * 0.85); y += 2) {
      if (getDarkness(x, y) > 0.45) count++;
    }
    if (count > bestRightCount) {
      bestRightCount = count;
      bestRightX = x;
    }
  }

  if (bestLeftX === -1 || bestRightX === -1 || bestRightX <= bestLeftX + 100) {
    return null;
  }

  const leftX = bestLeftX;
  const rightX = bestRightX;
  const span = rightX - leftX;

  // 2. Linhas horizontais entre leftX e rightX
  const solidThreshold = span * 0.85;
  const hLines: number[] = [];
  let currentGroup: number[] = [];

  for (let y = 0; y < height; y++) {
    let darkCount = 0;
    for (let x = leftX + 5; x <= rightX - 5; x += 2) {
      if (getDarkness(x, y) > 0.45) darkCount += 2;
    }
    if (darkCount >= solidThreshold) {
      if (currentGroup.length === 0 || y - currentGroup[currentGroup.length - 1] <= 3) {
        currentGroup.push(y);
      } else {
        const avg = Math.round(currentGroup.reduce((a, b) => a + b, 0) / currentGroup.length);
        hLines.push(avg);
        currentGroup = [y];
      }
    }
  }
  if (currentGroup.length > 0) {
    const avg = Math.round(currentGroup.reduce((a, b) => a + b, 0) / currentGroup.length);
    hLines.push(avg);
  }

  // Encontra a maior caixa sólida onde as bordas esquerda e direita são contínuas sem falhas
  let bestBox: { top: number; bottom: number } | null = null;
  let maxBoxH = 0;

  for (let i = 0; i < hLines.length; i++) {
    for (let j = i + 1; j < hLines.length; j++) {
      const y1 = hLines[i];
      const y2 = hLines[j];
      const boxH = y2 - y1;
      if (boxH < 60) continue;

      let maxLeftGap = 0;
      let curLeftGap = 0;
      for (let y = y1; y <= y2; y++) {
        if (getDarkness(leftX, y) < 0.4) {
          curLeftGap++;
          if (curLeftGap > maxLeftGap) maxLeftGap = curLeftGap;
        } else {
          curLeftGap = 0;
        }
      }

      let maxRightGap = 0;
      let curRightGap = 0;
      for (let y = y1; y <= y2; y++) {
        if (getDarkness(rightX, y) < 0.4) {
          curRightGap++;
          if (curRightGap > maxRightGap) maxRightGap = curRightGap;
        } else {
          curRightGap = 0;
        }
      }

      if (maxLeftGap <= 6 && maxRightGap <= 6) {
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

  // 3. Linha divisória de cabeçalho dentro da caixa OMR (nos primeiros 40% da caixa)
  const hdrSearchEnd = boxTop + Math.floor(boxH * 0.40);
  let bestHdrY = -1;
  let bestHdrCount = 0;

  for (let y = boxTop + 10; y <= hdrSearchEnd; y++) {
    let count = 0;
    for (let x = leftX + 10; x <= rightX - 10; x += 2) {
      if (getDarkness(x, y) > 0.45) count += 2;
    }
    if (count > bestHdrCount) {
      bestHdrCount = count;
      bestHdrY = y;
    }
  }

  if (bestHdrY === -1 || bestHdrCount < span * 0.25) {
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
  const questionsPerColumn = actualCols === 1 ? totalQuestions : Math.ceil(totalQuestions / actualCols);

  const scale = width / 724.0;
  const firstRowY = bestHdrY + 22.0 * scale;
  const lastRowY = boxBottom - 22.0 * scale;
  const stdPitch = 35.0 * scale;
  const rowPitch = questionsPerColumn > 1
    ? Math.min(stdPitch, (lastRowY - firstRowY) / (questionsPerColumn - 1))
    : stdPitch;

  const optionLabels: ('A' | 'B' | 'C' | 'D' | 'E')[] = ['A', 'B', 'C', 'D', 'E'];
  const bubbles: BubbleCoordinates[] = [];
  const radiusPercent = (7.0 * scale / Math.min(width, height)) * 100;

  for (let colIdx = 0; colIdx < segments.length; colIdx++) {
    const { start: segStart, end: segEnd } = segments[colIdx];
    const segW = segEnd - segStart;

    for (let rIdx = 0; rIdx < questionsPerColumn; rIdx++) {
      const qNum = colIdx * questionsPerColumn + rIdx + 1;
      if (qNum > totalQuestions) break;
      if (subjectiveSet.has(qNum)) continue;

      const cy = firstRowY + rIdx * rowPitch;
      const cyPercent = (cy / height) * 100;

      for (let oIdx = 0; oIdx < 5; oIdx++) {
        const cx = segStart + segW * (0.194 + oIdx * 0.179);
        const cxPercent = (cx / width) * 100;

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
  const inferredConfig: GridConfig = config ?? {
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

    // Busca na vizinhança local (+/- 3px) para máxima robustez contra deslocamentos
    let bestFillRatio = 0;

    for (let dy = -3; dy <= 3; dy += 2) {
      for (let dx = -3; dx <= 3; dx += 2) {
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
