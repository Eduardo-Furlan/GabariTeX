import { BubbleCoordinates, OmrRawDetection, SheetCorners } from '../types/omr';

export interface GridConfig {
  totalQuestions: number;
  optionsPerQuestion: number;
  columnsCount: number;
}

/**
 * Calcula as coordenadas relativas (%) de cada bolinha na folha de respostas padronizada.
 */
export function getStandardBubbleCoordinates(config: GridConfig): BubbleCoordinates[] {
  const bubbles: BubbleCoordinates[] = [];
  const { totalQuestions, optionsPerQuestion, columnsCount } = config;
  const questionsPerColumn = Math.ceil(totalQuestions / columnsCount);
  const optionLabels: ('A' | 'B' | 'C' | 'D' | 'E')[] = ['A', 'B', 'C', 'D', 'E'];

  // Margens internas da área do gabarito em porcentagem (0 a 100)
  const gridTop = 32; // abaixo do cabeçalho e QR Code
  const gridBottom = 92;
  const gridLeft = 8;
  const gridRight = 92;

  const totalGridWidth = gridRight - gridLeft;
  const totalGridHeight = gridBottom - gridTop;
  const columnWidth = totalGridWidth / columnsCount;
  const rowHeight = totalGridHeight / Math.max(questionsPerColumn, 1);

  for (let q = 1; q <= totalQuestions; q++) {
    const colIndex = Math.floor((q - 1) / questionsPerColumn);
    const rowIndex = (q - 1) % questionsPerColumn;

    const colStartX = gridLeft + colIndex * columnWidth;
    const rowCenterY = gridTop + (rowIndex + 0.5) * rowHeight;

    // Espaço para número da questão à esquerda (ex: 25% da largura da coluna)
    const optionsStartX = colStartX + columnWidth * 0.28;
    const optionsWidth = columnWidth * 0.68;
    const optionSpacing = optionsWidth / optionsPerQuestion;

    for (let o = 0; o < optionsPerQuestion; o++) {
      const centerX = optionsStartX + (o + 0.5) * optionSpacing;
      bubbles.push({
        questionNumber: q,
        optionLabel: optionLabels[o],
        centerXPercent: centerX,
        centerYPercent: rowCenterY,
        radiusPercent: Math.min(optionSpacing * 0.38, rowHeight * 0.36),
      });
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
  _corners?: SheetCorners
): OmrRawDetection[] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  // Se corners forem informados e diferentes do retângulo padrão,
  // aqui podemos usar um canvas intermediário desinclinado.
  const width = canvas.width;
  const height = canvas.height;

  // Mapa de agrupamento por questão
  const questionMap = new Map<number, { label: 'A' | 'B' | 'C' | 'D' | 'E'; darkness: number }[]>();

  for (const b of bubbles) {
    const cx = (b.centerXPercent / 100) * width;
    const cy = (b.centerYPercent / 100) * height;
    const r = (b.radiusPercent / 100) * Math.min(width, height);

    // Amostra apenas a área interna da bolinha (0.7 do raio para evitar a borda preta desenhada)
    const sampleRadius = Math.max(2, Math.floor(r * 0.65));
    const sx = Math.max(0, Math.floor(cx - sampleRadius));
    const sy = Math.max(0, Math.floor(cy - sampleRadius));
    const sw = Math.min(width - sx, sampleRadius * 2);
    const sh = Math.min(height - sy, sampleRadius * 2);

    if (sw <= 0 || sh <= 0) continue;

    const imgData = ctx.getImageData(sx, sy, sw, sh);
    const data = imgData.data;

    let darkPixels = 0;
    let totalPixels = 0;
    let sumDarkness = 0;

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const dx = x - sampleRadius;
        const dy = y - sampleRadius;
        if (dx * dx + dy * dy <= sampleRadius * sampleRadius) {
          const idx = (y * sw + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          // Luminância de 0 (preto) a 255 (branco)
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          const darkness = (255 - luminance) / 255;
          sumDarkness += darkness;
          if (darkness > 0.45) {
            darkPixels++;
          }
          totalPixels++;
        }
      }
    }

    const fillRatio = totalPixels > 0 ? (darkPixels / totalPixels) * 0.7 + (sumDarkness / totalPixels) * 0.3 : 0;

    if (!questionMap.has(b.questionNumber)) {
      questionMap.set(b.questionNumber, []);
    }
    questionMap.get(b.questionNumber)!.push({
      label: b.optionLabel,
      darkness: fillRatio,
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

    // Ordena por escuridão decrescente
    const sorted = [...options].sort((a, b) => b.darkness - a.darkness);
    const top = sorted[0];
    const second = sorted[1];

    const MARK_THRESHOLD = 0.35;
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

  // Caso os cantos sejam praticamente o retângulo inteiro, desenha direto
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
