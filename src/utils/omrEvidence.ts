import { GradingRecord } from '../types/exam';
import { GradingEvidence, OmrDebugInfo } from '../types/omr';

/**
 * Constrói a evidência visual transitória (recortes das questões em dúvida e miniatura da folha).
 * Nunca lança exceção para não bloquear a correção.
 */
export function buildEvidence(
  canvas: HTMLCanvasElement,
  debugInfo: OmrDebugInfo,
  record: GradingRecord
): GradingEvidence {
  const rowCrops: Record<number, string> = {};
  let sheetThumbUrl: string | undefined;

  try {
    if (!canvas || typeof document === 'undefined') {
      return { rowCrops };
    }

    // 1. Gera miniatura da folha inteira (lado maior <= 900 px)
    if (canvas.width > 0 && canvas.height > 0) {
      try {
        const maxDim = Math.max(canvas.width, canvas.height);
        const scale = Math.min(1, 900 / maxDim);
        const thumbW = Math.max(1, Math.round(canvas.width * scale));
        const thumbH = Math.max(1, Math.round(canvas.height * scale));

        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = thumbW;
        thumbCanvas.height = thumbH;
        const thumbCtx = thumbCanvas.getContext('2d');
        if (thumbCtx) {
          thumbCtx.drawImage(canvas, 0, 0, thumbW, thumbH);
          sheetThumbUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);
        }
      } catch {
        // Ignora erro ao gerar miniatura
      }
    }

    // 2. Para cada questão com needsReview, recorta a faixa correspondente
    const answersNeedingReview = record.answers.filter((a) => a.needsReview);

    for (const ans of answersNeedingReview) {
      try {
        const qBubbles = (debugInfo.bubbles || []).filter(
          (b) => b.questionNumber === ans.questionNumber
        );

        if (qBubbles.length === 0) continue;

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let sumRadius = 0;

        for (const b of qBubbles) {
          minX = Math.min(minX, b.cx - b.radius);
          maxX = Math.max(maxX, b.cx + b.radius);
          minY = Math.min(minY, b.cy - b.radius);
          maxY = Math.max(maxY, b.cy + b.radius);
          sumRadius += b.radius;
        }

        const avgRadius = sumRadius / qBubbles.length;
        const marginX = avgRadius * 0.6;
        const marginY = avgRadius * 0.8;

        const cropX = Math.max(0, Math.floor(minX - marginX));
        const cropY = Math.max(0, Math.floor(minY - marginY));
        const cropW = Math.min(canvas.width - cropX, Math.ceil(maxX + marginX - cropX));
        const cropH = Math.min(canvas.height - cropY, Math.ceil(maxY + marginY - cropY));

        if (cropW <= 0 || cropH <= 0) continue;

        const targetW = Math.min(520, cropW);
        const scale = targetW / cropW;
        const targetH = Math.max(1, Math.round(cropH * scale));

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = targetW;
        cropCanvas.height = targetH;
        const cropCtx = cropCanvas.getContext('2d');

        if (cropCtx) {
          cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
          rowCrops[ans.questionNumber] = cropCanvas.toDataURL('image/jpeg', 0.7);
        }
      } catch {
        // Ignora falha de recorte de questão individual
      }
    }
  } catch {
    // Nunca lança erro
  }

  return {
    rowCrops,
    sheetThumbUrl,
  };
}

