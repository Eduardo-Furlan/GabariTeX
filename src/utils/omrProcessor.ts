import {
  BubbleCoordinates,
  DecryptedQrPayload,
  OmrRawDetection,
  SheetCorners,
  OmrDebugInfo,
  OmrTimingMarkDebug,
} from '../types/omr';
import { GradedAnswer, GradingRecord } from '../types/exam';

export interface GridConfig {
  totalQuestions: number;
  optionsPerQuestion: number;
  columnsCount: number;
  subjectiveQuestions?: number[];
}

export interface OmrAnalysisResult {
  detections: OmrRawDetection[];
  debugInfo: OmrDebugInfo;
  bubbles: BubbleCoordinates[];
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
 * Detecta a grade OMR utilizando os sincronizadores de linha (timing marks) à esquerda e à direita
 * de cada questão. Fornece máxima robustez contra perspectiva, curvaturas e cortes de borda.
 */
export function detectOmrByTimingMarks(
  canvas: HTMLCanvasElement,
  config: GridConfig,
  debugInfo?: Partial<OmrDebugInfo>
): BubbleCoordinates[] | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const width = canvas.width;
  const height = canvas.height;
  if (width < 100 || height < 100) return null;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const getDarkness = (x: number, y: number): number => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    const idx = (y * width + x) * 4;
    const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    return (255 - lum) / 255;
  };

  const { totalQuestions, subjectiveQuestions = [], columnsCount = 1 } = config;
  const subjectiveSet = new Set(subjectiveQuestions);
  const questionsPerColumn = totalQuestions <= 12 ? totalQuestions : Math.ceil(totalQuestions / columnsCount);

  // Helper para escanear uma coluna vertical em busca de marcas periódicas com espaçamento regular
  const scanColumnRange = (xStart: number, xEnd: number): { bestCol: number; peaks: number[] } | null => {
    let bestCol = -1;
    let bestPeaks: number[] = [];
    let bestScore = -999999;

    for (let x = xStart; x <= xEnd; x += 2) {
      const yMin = Math.floor(height * 0.12);
      const yMax = Math.floor(height * 0.88);

      const rawPeaks: number[] = [];
      let inSeg = false;
      let startY = 0;

      for (let y = yMin; y <= yMax; y++) {
        let sum = 0;
        for (let dx = -2; dx <= 2; dx++) {
          sum += getDarkness(x + dx, y);
        }
        const val = sum / 5;

        if (val > 0.50 && !inSeg) {
          inSeg = true;
          startY = y;
        } else if (val <= 0.50 && inSeg) {
          inSeg = false;
          const segLen = y - startY;
          if (segLen >= 5 && segLen <= 35) {
            rawPeaks.push(Math.floor((startY + y) / 2));
          }
        }
      }
      if (inSeg) {
        const segLen = yMax - startY;
        if (segLen >= 5 && segLen <= 35) {
          rawPeaks.push(Math.floor((startY + yMax) / 2));
        }
      }

      if (rawPeaks.length >= 3) {
        const diffs = rawPeaks.slice(1).map((p, i) => p - rawPeaks[i]);
        const sortedDiffs = [...diffs].sort((a, b) => a - b);
        const medianP = sortedDiffs[Math.floor(sortedDiffs.length / 2)];

        let peaks = [...rawPeaks];
        // Remove borda de cabeçalho superior se tiver distância menor que 75% do passo regular
        while (peaks.length >= 3 && peaks[1] - peaks[0] < 0.75 * medianP) {
          peaks = peaks.slice(1);
        }
        // Remove borda inferior se tiver distância menor que 75% do passo regular
        while (peaks.length >= 3 && peaks[peaks.length - 1] - peaks[peaks.length - 2] < 0.75 * medianP) {
          peaks = peaks.slice(0, -1);
        }

        const cleanDiffs = peaks.slice(1).map((p, i) => p - peaks[i]);
        if (cleanDiffs.length >= 2) {
          const meanP = cleanDiffs.reduce((a, b) => a + b, 0) / cleanDiffs.length;
          const variance = cleanDiffs.reduce((a, b) => a + Math.pow(b - meanP, 2), 0) / cleanDiffs.length;
          const stdP = Math.sqrt(variance);

          const countDiff = Math.abs(peaks.length - questionsPerColumn);
          if (stdP < medianP * 0.20) {
            const score = 1000 - countDiff * 100 - stdP * 5;
            if (score > bestScore) {
              bestScore = score;
              bestCol = x;
              bestPeaks = peaks;
            }
          }
        }
      }
    }

    if (bestCol === -1 || bestPeaks.length < 3) return null;
    return { bestCol, peaks: bestPeaks };
  };

  const leftResult = scanColumnRange(Math.floor(width * 0.10), Math.floor(width * 0.45));
  const rightResult = scanColumnRange(Math.floor(width * 0.55), Math.floor(width * 0.90));

  if (!leftResult || !rightResult) return null;

  let leftPeaks = leftResult.peaks;
  let rightPeaks = rightResult.peaks;

  // Se a coluna esquerda capturou o cabeçalho (1 marca extra acima de todas as outras)
  if (leftPeaks.length === rightPeaks.length + 1 && leftPeaks[0] < rightPeaks[0] - 25) {
    leftPeaks = leftPeaks.slice(1);
  } else if (rightPeaks.length === leftPeaks.length + 1 && rightPeaks[0] < leftPeaks[0] - 25) {
    rightPeaks = rightPeaks.slice(1);
  }

  // Se ambas as colunas tiverem marcas a mais que questionsPerColumn, seleciona as últimas questionsPerColumn
  if (leftPeaks.length > questionsPerColumn && rightPeaks.length > questionsPerColumn) {
    leftPeaks = leftPeaks.slice(leftPeaks.length - questionsPerColumn);
    rightPeaks = rightPeaks.slice(rightPeaks.length - questionsPerColumn);
  }

  const matchedRowsCount = Math.min(leftPeaks.length, rightPeaks.length, questionsPerColumn);
  if (matchedRowsCount < Math.min(questionsPerColumn, 4)) return null;

  const leftX = leftResult.bestCol;
  const rightX = rightResult.bestCol;
  const span = rightX - leftX;
  if (span < 100) return null;

  const optionLabels: ('A' | 'B' | 'C' | 'D' | 'E')[] = ['A', 'B', 'C', 'D', 'E'];
  const bubbles: BubbleCoordinates[] = [];
  const radiusPercent = ((span * 0.024) / Math.min(width, height)) * 100;

  const timingMarksDebug: OmrTimingMarkDebug[] = [];

  for (let rIdx = 0; rIdx < matchedRowsCount; rIdx++) {
    const qNum = rIdx + 1;
    const yL = leftPeaks[rIdx];
    const yR = rightPeaks[rIdx];

    timingMarksDebug.push({
      rowNumber: qNum,
      leftX,
      leftY: yL,
      rightX,
      rightY: yR,
    });

    if (qNum > totalQuestions) break;
    if (subjectiveSet.has(qNum)) continue;

    for (let oIdx = 0; oIdx < 5; oIdx++) {
      const frac = 0.224 + oIdx * 0.164;
      const bx = leftX + span * frac;
      const by = yL + (yR - yL) * frac;

      bubbles.push({
        questionNumber: qNum,
        optionLabel: optionLabels[oIdx],
        centerXPercent: (bx / width) * 100,
        centerYPercent: (by / height) * 100,
        radiusPercent,
      });
    }
  }

  if (debugInfo) {
    debugInfo.timingMarks = timingMarksDebug;
  }

  return bubbles;
}

/**
 * Detecta dinamicamente a caixa delimitadora do gabarito e calcula as coordenadas
 * exatas das bolinhas no canvas através das bordas externas e linha de cabeçalho.
 */
export function detectOmrByBox(
  canvas: HTMLCanvasElement,
  config: GridConfig,
  debugInfo?: Partial<OmrDebugInfo>
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
  const minLeft = Math.max(1, Math.floor(width * 0.005));
  const maxLeft = Math.floor(width * 0.35);
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
  const minRight = Math.floor(width * 0.65);
  const maxRight = width - 2;
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
    const { start: sStart, end: sEnd } = segments[colIdx];
    const segW = sEnd - sStart;

    // Mede a inclinação (tilt slope) da linha de cabeçalho para calibrar os eixos X e Y
    const xSampleLeft = Math.floor(sStart + segW * 0.15);
    const xSampleRight = Math.floor(sEnd - segW * 0.15);

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
    const firstRowY0 = (yLeft + yRight) / 2 + segW * 0.0654 - tiltSlope * ((xSampleLeft + xSampleRight) / 2 - sStart);
    const rowPitch = segW * 0.1035;
    const radiusPercent = ((segW * 0.031) / Math.min(width, height)) * 100;

    if (debugInfo && !debugInfo.box) {
      debugInfo.box = {
        leftX,
        rightX,
        topY: boxTop,
        bottomY: boxBottom,
        hdrY: bestHdrY,
        tiltSlope,
      };
    }

    for (let rIdx = 0; rIdx < questionsPerColumn; rIdx++) {
      const qNum = colIdx * questionsPerColumn + rIdx + 1;
      if (qNum > totalQuestions) break;
      if (subjectiveSet.has(qNum)) continue;

      const baseCy = firstRowY0 + rIdx * rowPitch;

      for (let oIdx = 0; oIdx < 5; oIdx++) {
        const cx = sStart + segW * (0.180 + oIdx * 0.181);
        const cy = baseCy + tiltSlope * (cx - sStart);
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
 * Ponto de entrada dinâmico que seleciona automaticamente o método mais confiável:
 * 1. Sincronizadores de linha (timing marks) - máxima precisão
 * 2. Caixa delimitadora e linha de cabeçalho - fallback
 */
export function detectOmrGrid(
  canvas: HTMLCanvasElement,
  config: GridConfig,
  debugInfo?: Partial<OmrDebugInfo>
): BubbleCoordinates[] | null {
  const timingBubbles = detectOmrByTimingMarks(canvas, config, debugInfo);
  if (timingBubbles && timingBubbles.length > 0) {
    if (debugInfo) {
      debugInfo.method = 'timing_marks';
      debugInfo.logs?.push(`Sincronizadores de linha detectados com sucesso (${debugInfo.timingMarks?.length} linhas mapeadas).`);
    }
    return timingBubbles;
  }

  const boxBubbles = detectOmrByBox(canvas, config, debugInfo);
  if (boxBubbles && boxBubbles.length > 0) {
    if (debugInfo) {
      debugInfo.method = 'box_borders';
      debugInfo.logs?.push(`Caixa delimitadora do gabarito detectada: limites (${debugInfo.box?.leftX}, ${debugInfo.box?.topY}) a (${debugInfo.box?.rightX}, ${debugInfo.box?.bottomY}).`);
    }
    return boxBubbles;
  }

  if (debugInfo) {
    debugInfo.method = 'standard_fallback';
    debugInfo.logs?.push('Nenhum marcador ou caixa detectada na imagem. Utilizando coordenadas padronizadas de folha A4.');
  }

  return null;
}

/**
 * Aplica transformação de perspectiva e analisa o preenchimento das bolinhas no Canvas,
 * gerando informações detalhadas de diagnóstico e depuração visual.
 */
export function analyzeCanvasOmrWithDebug(
  canvas: HTMLCanvasElement,
  bubbles: BubbleCoordinates[],
  _corners?: SheetCorners,
  config?: GridConfig
): OmrAnalysisResult {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const debugInfo: OmrDebugInfo = {
    method: 'standard_fallback',
    bubbles: [],
    logs: [],
  };

  if (!ctx) {
    debugInfo.logs.push('Erro: Não foi possível obter contexto 2D do Canvas.');
    return { detections: [], debugInfo, bubbles: [] };
  }

  const width = canvas.width;
  const height = canvas.height;
  debugInfo.logs.push(`Dimensões da imagem: ${width}x${height}px`);

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

  const detectedBubbles = detectOmrGrid(canvas, inferredConfig, debugInfo);
  if (detectedBubbles && detectedBubbles.length > 0) {
    bubblesToUse = detectedBubbles;
  }

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const questionMap = new Map<
    number,
    { label: 'A' | 'B' | 'C' | 'D' | 'E'; darkness: number; cx: number; cy: number; r: number }[]
  >();

  for (const b of bubblesToUse) {
    const cx = (b.centerXPercent / 100) * width;
    const cy = (b.centerYPercent / 100) * height;
    const r = (b.radiusPercent / 100) * Math.min(width, height);
    const sampleRadius = Math.max(2, Math.floor(r * 0.65));

    // Busca na vizinhança local proporcional ao raio para máxima robustez contra deslocamentos
    const searchWindow = Math.max(4, Math.floor(r * 0.75));
    let bestFillRatio = 0;
    let bestScx = cx;
    let bestScy = cy;

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

        const fillRatio =
          totalPixels > 0 ? (darkPixels / totalPixels) * 0.7 + (sumDarkness / totalPixels) * 0.3 : 0;
        if (fillRatio > bestFillRatio) {
          bestFillRatio = fillRatio;
          bestScx = scx;
          bestScy = scy;
        }
      }
    }

    if (!questionMap.has(b.questionNumber)) {
      questionMap.set(b.questionNumber, []);
    }
    questionMap.get(b.questionNumber)!.push({
      label: b.optionLabel,
      darkness: bestFillRatio,
      cx: bestScx,
      cy: bestScy,
      r,
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
      if (
        second &&
        second.darkness >= MARK_THRESHOLD &&
        top.darkness - second.darkness < DIFFERENCE_THRESHOLD
      ) {
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

    for (const opt of options) {
      debugInfo.bubbles.push({
        questionNumber: qNum,
        optionLabel: opt.label,
        cx: opt.cx,
        cy: opt.cy,
        radius: opt.r,
        fillRatio: opt.darkness,
        isMarked: status === 'marked' && opt.label === detectedMark,
      });
    }
  }

  const sortedResults = results.sort((a, b) => a.questionNumber - b.questionNumber);
  debugInfo.logs.push(`Análise concluída: ${sortedResults.length} questões analisadas.`);

  return {
    detections: sortedResults,
    debugInfo,
    bubbles: bubblesToUse,
  };
}

/**
 * Analisa o preenchimento das bolinhas no Canvas (compatibilidade legada).
 */
export function analyzeCanvasOmr(
  canvas: HTMLCanvasElement,
  bubbles: BubbleCoordinates[],
  corners?: SheetCorners,
  config?: GridConfig
): OmrRawDetection[] {
  return analyzeCanvasOmrWithDebug(canvas, bubbles, corners, config).detections;
}

/**
 * Desenha sobre o canvas uma camada visual com todos os elementos detectados pelo OMR
 * (marcas de tempo, limites da caixa, círculos de leitura e porcentagens de preenchimento).
 */
export function drawOmrDebugCanvas(
  sourceCanvas: HTMLCanvasElement,
  debugInfo: OmrDebugInfo
): HTMLCanvasElement {
  const debugCanvas = document.createElement('canvas');
  debugCanvas.width = sourceCanvas.width;
  debugCanvas.height = sourceCanvas.height;
  const ctx = debugCanvas.getContext('2d');
  if (!ctx) return debugCanvas;

  // 1. Imagem original de fundo
  ctx.drawImage(sourceCanvas, 0, 0);

  // 2. Se houver caixa detectada, desenha as bordas da caixa
  if (debugInfo.box) {
    const { leftX, rightX, topY, bottomY, hdrY } = debugInfo.box;
    ctx.save();
    ctx.strokeStyle = '#06b6d4'; // Cyan
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(leftX, topY, rightX - leftX, bottomY - topY);

    if (hdrY) {
      ctx.strokeStyle = '#ec4899'; // Pink
      ctx.beginPath();
      ctx.moveTo(leftX, hdrY);
      ctx.lineTo(rightX, hdrY);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 3. Se houver sincronizadores de linha (timing marks), desenha marcas e linhas de apoio
  if (debugInfo.timingMarks && debugInfo.timingMarks.length > 0) {
    ctx.save();
    for (const tm of debugInfo.timingMarks) {
      // Linha guia conectando esquerda e direita
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(tm.leftX, tm.leftY);
      ctx.lineTo(tm.rightX, tm.rightY);
      ctx.stroke();

      // Marcador à esquerda
      ctx.fillStyle = '#eab308';
      ctx.fillRect(tm.leftX - 4, tm.leftY - 4, 8, 8);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(tm.leftX - 4, tm.leftY - 4, 8, 8);

      // Marcador à direita
      ctx.fillStyle = '#eab308';
      ctx.fillRect(tm.rightX - 4, tm.rightY - 4, 8, 8);
      ctx.strokeRect(tm.rightX - 4, tm.rightY - 4, 8, 8);

      // Label da linha (Questão)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(`Q${tm.rowNumber < 10 ? '0' : ''}${tm.rowNumber}`, tm.leftX - 32, tm.leftY + 4);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  // 4. Desenha as bolinhas analisadas com preenchimento colorido
  for (const b of debugInfo.bubbles) {
    const isMarked = b.isMarked;
    const isSuspicious = !isMarked && b.fillRatio >= 0.25;

    ctx.save();
    ctx.beginPath();
    ctx.arc(b.cx, b.cy, b.radius, 0, 2 * Math.PI);

    if (isMarked) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.45)'; // Emerald
      ctx.fill();
      ctx.strokeStyle = '#15803d'; // Verde escuro
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (isSuspicious) {
      ctx.fillStyle = 'rgba(249, 115, 22, 0.25)'; // Laranja
      ctx.fill();
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'; // Azul claro
      ctx.fill();
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Texto com porcentagem
    const pct = Math.round(b.fillRatio * 100);
    const text = `${b.optionLabel}:${pct}%`;
    const fontSize = Math.max(9, Math.floor(b.radius * 0.75));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText(text, b.cx, b.cy);
    ctx.restore();
  }

  // 5. HUD Banner no canto superior esquerdo com status
  const methodNames: Record<string, string> = {
    timing_marks: 'Sincronizadores de Linha (Timing Marks)',
    box_borders: 'Caixa Delimitadora (Bordas OMR)',
    standard_fallback: 'Posição Padrão A4 (Fallback)',
  };
  const methodName = methodNames[debugInfo.method] || debugInfo.method;

  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.fillRect(12, 12, 380, 72);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(12, 12, 380, 72);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('DIAGNÓSTICO OMR / GABARITEX DEBUG', 24, 32);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '11px sans-serif';
  ctx.fillText(`Método: ${methodName}`, 24, 52);
  ctx.fillText(
    `Marcadores: ${debugInfo.timingMarks?.length ?? 0} | Bolinhas: ${debugInfo.bubbles.length}`,
    24,
    68
  );
  ctx.restore();

  return debugCanvas;
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
 * e produz o registro completo de correção e informações completas de depuração.
 */
export function gradeCanvasWithPayloadDebug(
  canvas: HTMLCanvasElement,
  payload: DecryptedQrPayload
): {
  record: GradingRecord;
  debugInfo: OmrDebugInfo;
  debugCanvasUrl: string;
} {
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
  const { detections: omrDetections, debugInfo } = analyzeCanvasOmrWithDebug(
    canvas,
    bubbles,
    undefined,
    gridConfig
  );

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

  const record: GradingRecord = {
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

  let debugCanvasUrl = '';
  try {
    const debugCanvas = drawOmrDebugCanvas(canvas, debugInfo);
    if (typeof debugCanvas.toDataURL === 'function') {
      debugCanvasUrl = debugCanvas.toDataURL('image/jpeg', 0.90);
    }
  } catch {
    debugCanvasUrl = '';
  }

  return {
    record,
    debugInfo,
    debugCanvasUrl,
  };
}

/**
 * Avalia um Canvas com a folha de respostas usando um gabarito descriptografado (DecryptedQrPayload)
 * e produz o registro completo de correção (GradingRecord).
 */
export function gradeCanvasWithPayload(
  canvas: HTMLCanvasElement,
  payload: DecryptedQrPayload
): GradingRecord {
  return gradeCanvasWithPayloadDebug(canvas, payload).record;
}

