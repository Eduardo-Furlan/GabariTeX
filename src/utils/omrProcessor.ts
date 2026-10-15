import {
  BubbleCoordinates,
  DecryptedQrPayload,
  OmrRawDetection,
  SheetCorners,
  OmrDebugInfo,
  GradingEvidence,
} from '../types/omr';
import { GradedAnswer, GradingRecord } from '../types/exam';
import { toGray } from './omr/grayImage';
import { detectSheet } from './omr/sheetDetector';
import { readBubbles } from './omr/bubbleReader';
import { buildObjectiveAnswer, recomputeTotals } from './grading';
import { buildEvidence } from './omrEvidence';

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
 * Detecta a grade OMR utilizando os 4 fiduciais de canto e sincronizadores de linha.
 */
export function detectOmrGrid(
  canvas: HTMLCanvasElement,
  config: GridConfig,
  debugInfo?: Partial<OmrDebugInfo>
): BubbleCoordinates[] | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const width = canvas.width;
  const height = canvas.height;
  if (width < 100 || height < 100) return null;

  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const gray = toGray(imgData);
    const questionsPerColumn =
      config.totalQuestions > 0
        ? config.totalQuestions <= 12
          ? config.totalQuestions
          : Math.ceil(config.totalQuestions / Math.max(1, config.columnsCount))
        : undefined;

    const det = detectSheet(gray, config.columnsCount, questionsPerColumn);
    const detectedTotalQuestions = det.columns.reduce((sum, col) => sum + col.length, 0);
    const effectiveTotalQuestions =
      config.totalQuestions > 0 ? config.totalQuestions : detectedTotalQuestions;

    const result = readBubbles(gray, det, {
      totalQuestions: effectiveTotalQuestions,
      subjectiveQuestions: config.subjectiveQuestions,
    });

    if (debugInfo) {
      debugInfo.method = 'fiducials_timing_marks';
      debugInfo.fiducials = {
        topLeft: det.corners[0],
        topRight: det.corners[1],
        bottomRight: det.corners[2],
        bottomLeft: det.corners[3],
      };
      debugInfo.timingMarks = result.timingMarks;
      debugInfo.logs?.push(
        `Folha detectada com sucesso via 4 fiduciais e ${result.timingMarks.length} sincronizadores de linha.`
      );
    }

    return result.bubbles;
  } catch (err) {
    if (debugInfo) {
      const msg = err instanceof Error ? err.message : String(err);
      debugInfo.logs?.push(`Detecção por fiduciais falhou: ${msg}`);
    }
    return null;
  }
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

  const inferredConfig: GridConfig = config
    ? config
    : {
        totalQuestions: bubbles.length > 0 ? Math.max(...bubbles.map((b) => b.questionNumber)) : 0,
        optionsPerQuestion: 5,
        columnsCount: bubbles.some((b) => b.centerXPercent > 50 && b.questionNumber <= 12) ? 1 : 2,
        subjectiveQuestions: [],
      };

  // Tenta detecção dinâmica de alta precisão por fiduciais e sincronizadores de linha
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const gray = toGray(imgData);
    const questionsPerColumn =
      inferredConfig.totalQuestions > 0
        ? inferredConfig.totalQuestions <= 12
          ? inferredConfig.totalQuestions
          : Math.ceil(inferredConfig.totalQuestions / Math.max(1, inferredConfig.columnsCount))
        : undefined;

    const det = detectSheet(gray, inferredConfig.columnsCount, questionsPerColumn);
    const detectedTotalQuestions = det.columns.reduce((sum, col) => sum + col.length, 0);
    const effectiveTotalQuestions =
      inferredConfig.totalQuestions > 0 ? inferredConfig.totalQuestions : detectedTotalQuestions;

    const result = readBubbles(gray, det, {
      totalQuestions: effectiveTotalQuestions,
      subjectiveQuestions: inferredConfig.subjectiveQuestions,
    });

    debugInfo.method = 'fiducials_timing_marks';
    debugInfo.fiducials = {
      topLeft: det.corners[0],
      topRight: det.corners[1],
      bottomRight: det.corners[2],
      bottomLeft: det.corners[3],
    };
    debugInfo.timingMarks = result.timingMarks;
    debugInfo.bubbles = result.debugBubbles;
    debugInfo.logs.push(
      `Folha detectada com sucesso via 4 fiduciais e ${result.timingMarks.length} sincronizadores de linha.`
    );

    return {
      detections: result.detections,
      debugInfo,
      bubbles: result.bubbles,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debugInfo.logs.push(`Detecção por fiduciais não disponível: ${msg}. Utilizando coordenadas padronizadas.`);
  }

  let bubblesToUse = bubbles;

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

  // 2. Se houver fiduciais de canto detectados, desenha o polígono e marcadores
  if (debugInfo.fiducials) {
    const { topLeft, topRight, bottomRight, bottomLeft } = debugInfo.fiducials;
    if (topLeft && topRight && bottomRight && bottomLeft) {
      ctx.save();
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(topLeft.x, topLeft.y);
      ctx.lineTo(topRight.x, topRight.y);
      ctx.lineTo(bottomRight.x, bottomRight.y);
      ctx.lineTo(bottomLeft.x, bottomLeft.y);
      ctx.closePath();
      ctx.stroke();

      for (const p of [topLeft, topRight, bottomRight, bottomLeft]) {
        ctx.fillStyle = '#a855f7';
        ctx.fillRect(p.x - 7, p.y - 7, 14, 14);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x - 7, p.y - 7, 14, 14);
      }
      ctx.restore();
    }
  }

  // 3. Se houver caixa detectada, desenha as bordas da caixa
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
    fiducials_timing_marks: 'Fiduciais + Sincronizadores (OMR)',
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
  evidence?: GradingEvidence;
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

  const answers: GradedAnswer[] = [];

  const objectiveQuestionNumbers = Object.keys(payload.key)
    .map(Number)
    .sort((a, b) => a - b);

  for (const i of objectiveQuestionNumbers) {
    const correctOpt = payload.key[i] || 'A';
    const qPoint = payload.points?.[i] ?? 1.0;
    const detected = omrDetections.find((d) => d.questionNumber === i);

    answers.push(
      buildObjectiveAnswer({
        questionNumber: i,
        correctOption: correctOpt,
        maxPoints: qPoint,
        detection: detected,
      })
    );
  }

  const initialRecord: GradingRecord = {
    id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    studentName: '',
    studentId: '',
    versionLetter: payload.version,
    totalScore: 0,
    maxScore: 0,
    percentage: 0,
    answers,
  };

  const record = recomputeTotals(initialRecord);

  let evidence: GradingEvidence | undefined;
  try {
    evidence = buildEvidence(canvas, debugInfo, record);
  } catch {
    evidence = undefined;
  }

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
    evidence,
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

