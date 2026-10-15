import { Html5Qrcode } from 'html5-qrcode';
import { ExamVersion, GradingRecord } from '../types/exam';
import { DecryptedQrPayload, OmrDebugInfo, GradingEvidence } from '../types/omr';
import { decryptAnswerKey } from './crypto';
import { buildPayload } from './payload';
import { gradeCanvasWithPayloadDebug } from './omrProcessor';

export interface PhotoResult {
  status: 'graded' | 'qr_only' | 'error';
  record?: GradingRecord;
  evidence?: GradingEvidence;
  payload?: DecryptedQrPayload;
  payloadSource: 'qr' | 'locked' | 'none';
  versionMismatch?: boolean;
  error?: string;
  debugInfo?: OmrDebugInfo;
  debugCanvasUrl?: string;
}

export interface GradePhotoOptions {
  teacherPassword?: string;
  lockedPayload: DecryptedQrPayload | null;
  alwaysReadQr: boolean; // false no fluxo de uma foto (comportamento atual); true no lote
  maxSide?: number; // padrão 2400
  availableVersions?: ExamVersion[];
}

function getOrCreateHiddenQrElement(): HTMLElement {
  let el = document.getElementById('hidden-qr-reader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'hidden-qr-reader';
    el.style.position = 'fixed';
    el.style.top = '-9999px';
    el.style.left = '-9999px';
    el.style.width = '800px';
    el.style.height = '800px';
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    document.body.appendChild(el);
  }
  return el;
}

function enrichSubjectivePoints(payload: DecryptedQrPayload, availableVersions?: ExamVersion[]): void {
  if (
    (!payload.subjectivePoints || Object.keys(payload.subjectivePoints).length === 0) &&
    availableVersions &&
    availableVersions.length > 0
  ) {
    const matchingVer =
      availableVersions.find((v) => v.versionLetter === payload.version) ||
      (availableVersions.length === 1 ? availableVersions[0] : undefined);

    if (matchingVer) {
      const enrichedSubjPoints: Record<number, number> = {};
      matchingVer.questions.forEach((q, idx) => {
        if (q.type === 'subjective' && q.points > 0) {
          enrichedSubjPoints[idx + 1] = q.points;
        }
      });
      if (Object.keys(enrichedSubjPoints).length > 0) {
        payload.subjectivePoints = enrichedSubjPoints;
      }
    }
  }
}

async function scanQrFromImageOrCanvas(file: File, canvas: HTMLCanvasElement): Promise<string | null> {
  getOrCreateHiddenQrElement();
  let decodedText: string | null = null;

  try {
    const qrScanner = new Html5Qrcode('hidden-qr-reader');

    // Tentativa 0: Arquivo original inteiro
    try {
      decodedText = await qrScanner.scanFile(file, false);
    } catch {
      // Continua para tentativas com recorte
    }

    const scanCanvas = async (subCanvas: HTMLCanvasElement): Promise<string> => {
      const blob = await new Promise<Blob | null>((resolve) =>
        subCanvas.toBlob(resolve, 'image/png')
      );
      if (!blob) throw new Error('Falha ao gerar blob do canvas');
      const cropFile = new File([blob], 'qr-crop.png', { type: 'image/png' });
      return await qrScanner.scanFile(cropFile, false);
    };

    // Tentativa 1: Quadrante superior direito (onde fica o QR Code da folha do GabariTeX)
    if (!decodedText) {
      const cropX = Math.floor(canvas.width * 0.45);
      const cropY = 0;
      const cropW = canvas.width - cropX;
      const cropH = Math.floor(canvas.height * 0.32);
      const maxDim = Math.max(cropW, cropH);
      const scale = Math.min(1, 1400 / maxDim);
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = Math.max(300, Math.round(cropW * scale));
      cropCanvas.height = Math.max(300, Math.round(cropH * scale));
      const cropCtx = cropCanvas.getContext('2d');
      if (cropCtx) {
        cropCtx.imageSmoothingEnabled = true;
        cropCtx.imageSmoothingQuality = 'high';
        cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropCanvas.width, cropCanvas.height);
        try {
          decodedText = await scanCanvas(cropCanvas);
        } catch {
          // Falha
        }
      }
      cropCanvas.width = 0;
      cropCanvas.height = 0;
    }

    // Tentativa 2: Metade superior inteira (para enquadramento inclinado ou deslocado)
    if (!decodedText) {
      const topH = Math.floor(canvas.height * 0.42);
      const maxDim = Math.max(canvas.width, topH);
      const scale = Math.min(1, 1400 / maxDim);
      const topCanvas = document.createElement('canvas');
      topCanvas.width = Math.max(300, Math.round(canvas.width * scale));
      topCanvas.height = Math.max(300, Math.round(topH * scale));
      const topCtx = topCanvas.getContext('2d');
      if (topCtx) {
        topCtx.imageSmoothingEnabled = true;
        topCtx.imageSmoothingQuality = 'high';
        topCtx.drawImage(canvas, 0, 0, canvas.width, topH, 0, 0, topCanvas.width, topCanvas.height);
        try {
          decodedText = await scanCanvas(topCanvas);
        } catch {
          // Falha
        }
      }
      topCanvas.width = 0;
      topCanvas.height = 0;
    }
  } catch {
    // Falha silenciosa no leitor de QR
  }

  return decodedText;
}

export async function gradePhotoFile(
  file: File,
  opts: GradePhotoOptions
): Promise<PhotoResult> {
  let imgUrl: string | null = null;
  const canvas = document.createElement('canvas');

  try {
    // 1. Carrega imagem em um canvas para processamento limitando ao maxSide
    const img = new Image();
    imgUrl = URL.createObjectURL(file);
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Falha ao carregar arquivo de imagem.'));
      img.src = imgUrl!;
    });

    const naturalWidth = img.naturalWidth || 800;
    const naturalHeight = img.naturalHeight || 1100;
    const maxSide = opts.maxSide && opts.maxSide > 0 ? opts.maxSide : 2400;
    const maxDim = Math.max(naturalWidth, naturalHeight);
    const scale = maxDim > maxSide ? maxSide / maxDim : 1;

    canvas.width = Math.round(naturalWidth * scale);
    canvas.height = Math.round(naturalHeight * scale);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    URL.revokeObjectURL(imgUrl);
    imgUrl = null;

    let targetPayload: DecryptedQrPayload | null = opts.lockedPayload;
    let payloadSource: 'qr' | 'locked' | 'none' = opts.lockedPayload ? 'locked' : 'none';
    let versionMismatch = false;

    // Se alwaysReadQr=true ou não temos payload travado, tentamos ler o QR
    const shouldReadQr = opts.alwaysReadQr || !opts.lockedPayload;

    if (shouldReadQr) {
      const decodedText = await scanQrFromImageOrCanvas(file, canvas);

      if (decodedText) {
        if (opts.teacherPassword && opts.teacherPassword.trim()) {
          try {
            const qrPayload = await decryptAnswerKey(decodedText, opts.teacherPassword);
            enrichSubjectivePoints(qrPayload, opts.availableVersions);

            if (opts.lockedPayload) {
              if (
                qrPayload.version !== opts.lockedPayload.version ||
                (qrPayload.examId && opts.lockedPayload.examId && qrPayload.examId !== opts.lockedPayload.examId)
              ) {
                versionMismatch = true;
              }
            }

            targetPayload = qrPayload;
            payloadSource = 'qr';
          } catch {
            return {
              status: 'error',
              payloadSource: 'none',
              error:
                'QR Code detectado na folha, porém a senha informada não confere com a senha da prova. Verifique a senha do professor.',
            };
          }
        } else {
          return {
            status: 'error',
            payloadSource: 'none',
            error: 'QR Code detectado na folha! Por favor, informe a senha da prova para desbloquear a correção.',
          };
        }
      }
    }

    if (!targetPayload) {
      if (opts.alwaysReadQr) {
        return {
          status: 'error',
          payloadSource: 'none',
          error: 'Não encontrei o QR code na folha e não há versão selecionada.',
        };
      }

      // Fallback para fluxo de teste de 1 foto quando não há QR code
      const defaultVer = opts.availableVersions?.find((v) => v.questions && v.questions.length > 0);
      if (defaultVer) {
        targetPayload = buildPayload({
          examId: 'auto-exam',
          versionLetter: defaultVer.versionLetter,
          questions: defaultVer.questions,
          objectiveAnswerKey: defaultVer.objectiveAnswerKey,
        });
        payloadSource = 'locked';
      } else {
        targetPayload = {
          examId: 'debug-exam',
          version: 'A',
          key: { 1: 'A', 2: 'B', 3: 'C', 4: 'C', 5: 'D', 6: 'A', 7: 'E', 8: 'A', 9: 'B', 10: 'C' },
          points: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1 },
          totalQuestions: 10,
          subjectiveQuestions: [1, 2, 4],
          subjectivePoints: { 1: 1, 2: 1, 4: 1 },
        };
        payloadSource = 'locked';
      }
    }

    // 2. Executa OMR e extrai evidências
    const { record, debugInfo, debugCanvasUrl, evidence } = gradeCanvasWithPayloadDebug(
      canvas,
      targetPayload
    );

    // 3. Se a foto teve QR Code lido, mas não contém a grade de respostas com fiduciais (apenas close-up do QR Code)
    if (payloadSource === 'qr' && debugInfo.method !== 'fiducials_timing_marks') {
      return {
        status: 'qr_only',
        payload: targetPayload,
        payloadSource,
        versionMismatch,
        debugInfo,
        debugCanvasUrl,
      };
    }

    return {
      status: 'graded',
      record,
      evidence,
      payload: targetPayload,
      payloadSource,
      versionMismatch,
      debugInfo,
      debugCanvasUrl,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha ao processar arquivo de foto.';
    return {
      status: 'error',
      payloadSource: 'none',
      error: msg,
    };
  } finally {
    if (imgUrl) {
      try {
        URL.revokeObjectURL(imgUrl);
      } catch {
        // Ignora
      }
    }
    canvas.width = 0;
    canvas.height = 0;
  }
}

