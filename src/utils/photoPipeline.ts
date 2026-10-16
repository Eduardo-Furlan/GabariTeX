import { ExamVersion, GradingRecord, GradedAnswer, SubjectiveAnswer } from '../types/exam';
import { DecryptedQrPayload, OmrDebugInfo, GradingEvidence } from '../types/omr';
import { decryptWithCandidatePasswords } from './crypto';
import { gradeCanvasWithPayloadDebug } from './omrProcessor';
import { buildObjectiveAnswer, recomputeTotals } from './grading';
import { processExamPhotoNative, convertNativeResponse } from '../platform/omrBackend';

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
  needsManualPassword?: boolean;
}

export type ScanTarget = 'auto' | 'qr' | 'sheet';

export interface GradePhotoOptions {
  teacherPassword?: string;
  candidatePasswords?: string[];
  lockedPayload: DecryptedQrPayload | null;
  scanTarget?: ScanTarget; // 'qr' | 'sheet' | 'auto'
  alwaysReadQr?: boolean; // false no fluxo de uma foto (comportamento atual); true no lote
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

function resolveCandidatePasswords(opts: GradePhotoOptions): string[] {
  const list: string[] = [];
  if (opts.candidatePasswords && opts.candidatePasswords.length > 0) {
    for (const p of opts.candidatePasswords) {
      if (p && p.trim()) list.push(p.trim());
    }
  }
  if (opts.teacherPassword && opts.teacherPassword.trim()) {
    list.push(opts.teacherPassword.trim());
  }
  return Array.from(new Set(list));
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
    const { Html5Qrcode } = await import('html5-qrcode');
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

    // Tentativa 3: Região central (para fotos focadas / close-up do QR Code como em fotos verticais centralizadas)
    if (!decodedText) {
      const cropX = Math.floor(canvas.width * 0.05);
      const cropY = Math.floor(canvas.height * 0.15);
      const cropW = Math.floor(canvas.width * 0.90);
      const cropH = Math.floor(canvas.height * 0.70);
      const maxDim = Math.max(cropW, cropH);
      const scale = Math.min(1, 1400 / maxDim);
      const centerCanvas = document.createElement('canvas');
      centerCanvas.width = Math.max(300, Math.round(cropW * scale));
      centerCanvas.height = Math.max(300, Math.round(cropH * scale));
      const centerCtx = centerCanvas.getContext('2d');
      if (centerCtx) {
        centerCtx.imageSmoothingEnabled = true;
        centerCtx.imageSmoothingQuality = 'high';
        centerCtx.drawImage(
          canvas,
          cropX,
          cropY,
          cropW,
          cropH,
          0,
          0,
          centerCanvas.width,
          centerCanvas.height
        );
        try {
          decodedText = await scanCanvas(centerCanvas);
        } catch {
          // Falha
        }
      }
      centerCanvas.width = 0;
      centerCanvas.height = 0;
    }
  } catch {
    // Falha silenciosa no leitor de QR
  }

  return decodedText;
}

function buildRecordFromNativeResponse(
  nativeRes: import('../platform/omrBackend').NativeOmrResponse,
  targetPayload: DecryptedQrPayload,
  payloadSource: 'qr' | 'locked' | 'none',
  versionMismatch: boolean
): PhotoResult {
  const { detections, debugInfo, evidence } = convertNativeResponse(nativeRes);

  const answers: GradedAnswer[] = [];
  const objectiveQuestionNumbers = Object.keys(targetPayload.key)
    .map(Number)
    .sort((a, b) => a - b);

  for (const i of objectiveQuestionNumbers) {
    const correctOpt = targetPayload.key[i] || 'A';
    const qPoint = targetPayload.points?.[i] ?? 1.0;
    const detected = detections.find((d) => d.questionNumber === i);

    answers.push(
      buildObjectiveAnswer({
        questionNumber: i,
        correctOption: correctOpt,
        maxPoints: qPoint,
        detection: detected,
      })
    );
  }

  const subjectiveAnswers: SubjectiveAnswer[] = [];
  const subjMap: Record<number, number> = {};

  if (targetPayload.subjectivePoints) {
    Object.entries(targetPayload.subjectivePoints).forEach(([q, pts]) => {
      subjMap[Number(q)] = pts;
    });
  }

  if (targetPayload.subjectiveQuestions && Array.isArray(targetPayload.subjectiveQuestions)) {
    for (const qNum of targetPayload.subjectiveQuestions) {
      if (subjMap[qNum] === undefined) {
        const fallbackPts = targetPayload.points?.[qNum];
        subjMap[qNum] = typeof fallbackPts === 'number' && fallbackPts > 0 ? fallbackPts : 1.0;
      }
    }
  }

  const sortedSubj = Object.entries(subjMap)
    .map(([q, pts]) => ({ qNum: Number(q), pts }))
    .sort((a, b) => a.qNum - b.qNum);

  for (const item of sortedSubj) {
    subjectiveAnswers.push({
      questionNumber: item.qNum,
      maxPoints: item.pts > 0 ? item.pts : 1.0,
      pointsEarned: null,
    });
  }

  const initialRecord: GradingRecord = {
    id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    studentName: '',
    studentId: '',
    versionLetter: targetPayload.version,
    examId: targetPayload.examId,
    totalScore: 0,
    maxScore: 0,
    percentage: 0,
    answers,
    subjectiveAnswers: subjectiveAnswers.length > 0 ? subjectiveAnswers : undefined,
  };

  const record = recomputeTotals(initialRecord);

  return {
    status: 'graded',
    record,
    evidence,
    payload: targetPayload,
    payloadSource,
    versionMismatch,
    debugInfo,
    debugCanvasUrl: nativeRes.debugImageDataUrl,
  };
}

export async function gradePhotoFile(
  file: File,
  opts: GradePhotoOptions
): Promise<PhotoResult> {
  const scanTarget: ScanTarget =
    opts.scanTarget ??
    (opts.alwaysReadQr ? 'auto' : (opts.lockedPayload ? 'sheet' : 'qr'));

  if (scanTarget === 'sheet' && !opts.lockedPayload) {
    return {
      status: 'error',
      payloadSource: 'none',
      error:
        'Nenhuma versão de prova está travada. Selecione uma versão manualmente ou escaneie o QR Code antes de corrigir a folha.',
    };
  }

  const candidatePasswords = resolveCandidatePasswords(opts);
  if (
    scanTarget === 'qr' &&
    candidatePasswords.length === 0 &&
    (!opts.teacherPassword || !opts.teacherPassword.trim())
  ) {
    return {
      status: 'error',
      payloadSource: 'none',
      error:
        'Por favor, informe a senha da prova para desbloquear e ler o QR Code.',
      needsManualPassword: true,
    };
  }

  // Se estiver no ambiente desktop, processa via OpenCV nativo no Tauri
  if (__DESKTOP__) {
    try {
      const buffer = await file.arrayBuffer();
      const imageBytes = new Uint8Array(buffer);

      // MODO 1: LER EXCLUSIVAMENTE QR CODE
      if (scanTarget === 'qr') {
        const nativeRes = await processExamPhotoNative(imageBytes, {
          totalQuestions: 20,
          subjectiveQuestions: [],
          readQr: true,
          readOmr: false,
          generateDebugImage: false,
        });

        if (nativeRes.omrError || !nativeRes.qrRawText) {
          return {
            status: 'error',
            payloadSource: 'none',
            error:
              nativeRes.omrError?.message ||
              'Nenhum QR Code detectado na foto. Aproxime a câmera do QR Code e verifique o enquadramento.',
          };
        }

        const passwords = resolveCandidatePasswords(opts);
        if (passwords.length === 0) {
          return {
            status: 'error',
            payloadSource: 'none',
            error: 'Nenhuma senha de prova informada para decodificar o QR Code.',
            needsManualPassword: true,
          };
        }

        try {
          const decRes = await decryptWithCandidatePasswords(nativeRes.qrRawText, passwords);
          const qrPayload = decRes.payload;
          enrichSubjectivePoints(qrPayload, opts.availableVersions);
          return {
            status: 'qr_only',
            payload: qrPayload,
            payloadSource: 'qr',
          };
        } catch {
          return {
            status: 'error',
            payloadSource: 'none',
            error:
              'Não consegui abrir este QR com as senhas das provas deste perfil. A folha pode ser de outra prova ou de outro perfil.',
            needsManualPassword: true,
          };
        }
      }

      // MODO 2: LER EXCLUSIVAMENTE FOLHA DE RESPOSTAS (GABARITO)
      if (scanTarget === 'sheet') {
        const targetPayload = opts.lockedPayload!;
        const totalQuestions =
          targetPayload.totalQuestions ??
          Math.max(...Object.keys(targetPayload.key).map(Number), 0);
        const subjectiveQuestions = targetPayload.subjectiveQuestions ?? [];

        const nativeRes = await processExamPhotoNative(imageBytes, {
          totalQuestions,
          subjectiveQuestions,
          readQr: false,
          readOmr: true,
          generateDebugImage: true,
        });

        if (nativeRes.omrError) {
          return {
            status: 'error',
            payloadSource: 'locked',
            error: `Não foi possível detectar o cartão-resposta na imagem: ${nativeRes.omrError.message}`,
            debugCanvasUrl: nativeRes.debugImageDataUrl,
          };
        }

        return buildRecordFromNativeResponse(nativeRes, targetPayload, 'locked', false);
      }

      // MODO 3: AUTOMÁTICO / COMBINADO
      const targetPayload = opts.lockedPayload;
      const initialTotalQuestions =
        targetPayload?.totalQuestions ??
        (targetPayload?.key
          ? Math.max(...Object.keys(targetPayload.key).map(Number), 0)
          : opts.availableVersions?.[0]?.questions.length || 20);

      const initialSubjectiveQuestions =
        targetPayload?.subjectiveQuestions ??
        (opts.availableVersions?.[0]
          ? opts.availableVersions[0].questions
              .map((q, idx) => (q.type === 'subjective' ? idx + 1 : -1))
              .filter((idx) => idx !== -1)
          : []);

      const shouldReadQr = opts.alwaysReadQr || !targetPayload;

      let nativeRes = await processExamPhotoNative(imageBytes, {
        totalQuestions: initialTotalQuestions,
        subjectiveQuestions: initialSubjectiveQuestions,
        readQr: shouldReadQr,
        readOmr: true,
        generateDebugImage: true,
      });

      let resolvedPayload = targetPayload;
      let payloadSource: 'qr' | 'locked' | 'none' = targetPayload ? 'locked' : 'none';
      let versionMismatch = false;

      if (nativeRes.qrRawText) {
        const passwords = resolveCandidatePasswords(opts);
        if (passwords.length > 0) {
          try {
            const decRes = await decryptWithCandidatePasswords(nativeRes.qrRawText, passwords);
            const qrPayload = decRes.payload;
            enrichSubjectivePoints(qrPayload, opts.availableVersions);

            if (targetPayload) {
              if (
                targetPayload.examId &&
                qrPayload.examId === targetPayload.examId &&
                qrPayload.version !== targetPayload.version
              ) {
                versionMismatch = true;
              } else if (
                !opts.alwaysReadQr &&
                qrPayload.examId &&
                targetPayload.examId &&
                qrPayload.examId !== targetPayload.examId
              ) {
                versionMismatch = true;
              }
            }
            resolvedPayload = qrPayload;
            payloadSource = 'qr';
          } catch {
            return {
              status: 'error',
              payloadSource: 'none',
              error:
                'Não consegui abrir este QR com as senhas das provas deste perfil. A folha pode ser de outra prova ou de outro perfil.',
              needsManualPassword: true,
            };
          }
        } else {
          return {
            status: 'error',
            payloadSource: 'none',
            error: 'Nenhuma senha de prova informada para decodificar o QR Code.',
            needsManualPassword: true,
          };
        }
      }

      if (nativeRes.omrError) {
        if (payloadSource === 'qr' && resolvedPayload) {
          return {
            status: 'qr_only',
            payload: resolvedPayload,
            payloadSource,
            versionMismatch,
            debugCanvasUrl: nativeRes.debugImageDataUrl,
          };
        }
        return {
          status: 'error',
          payloadSource,
          versionMismatch,
          error: `Não foi possível detectar o cartão-resposta na imagem: ${nativeRes.omrError.message}`,
          debugCanvasUrl: nativeRes.debugImageDataUrl,
        };
      }

      if (!resolvedPayload) {
        return {
          status: 'error',
          payloadSource: 'none',
          error:
            'Não foi possível identificar o QR Code na folha e nenhuma versão de prova está travada. Enquadre o QR Code ou selecione a versão manualmente.',
          debugCanvasUrl: nativeRes.debugImageDataUrl,
        };
      }

      const finalTotalQuestions =
        resolvedPayload.totalQuestions ??
        Math.max(...Object.keys(resolvedPayload.key).map(Number), 0);
      const finalSubjectiveQuestions = resolvedPayload.subjectiveQuestions ?? [];

      if (
        finalTotalQuestions !== initialTotalQuestions ||
        JSON.stringify(finalSubjectiveQuestions) !== JSON.stringify(initialSubjectiveQuestions)
      ) {
        nativeRes = await processExamPhotoNative(imageBytes, {
          totalQuestions: finalTotalQuestions,
          subjectiveQuestions: finalSubjectiveQuestions,
          readQr: false,
          readOmr: true,
          generateDebugImage: true,
        });
      }

      return buildRecordFromNativeResponse(nativeRes, resolvedPayload, payloadSource, versionMismatch);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar arquivo no motor nativo OpenCV.';
      return {
        status: 'error',
        payloadSource: 'none',
        error: msg,
      };
    }
  }

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

    // BROWSER: MODO 1: LER EXCLUSIVAMENTE QR CODE
    if (scanTarget === 'qr') {
      const decodedText = await scanQrFromImageOrCanvas(file, canvas);
      if (!decodedText) {
        return {
          status: 'error',
          payloadSource: 'none',
          error:
            'Nenhum QR Code detectado na foto. Aproxime a câmera do QR Code e verifique o enquadramento.',
        };
      }
      const passwords = resolveCandidatePasswords(opts);
      if (passwords.length === 0) {
        return {
          status: 'error',
          payloadSource: 'none',
          error: 'Nenhuma senha de prova informada para decodificar o QR Code.',
          needsManualPassword: true,
        };
      }

      try {
        const decRes = await decryptWithCandidatePasswords(decodedText, passwords);
        const qrPayload = decRes.payload;
        enrichSubjectivePoints(qrPayload, opts.availableVersions);
        return {
          status: 'qr_only',
          payload: qrPayload,
          payloadSource: 'qr',
        };
      } catch {
        return {
          status: 'error',
          payloadSource: 'none',
          error:
            'Não consegui abrir este QR com as senhas das provas deste perfil. A folha pode ser de outra prova ou de outro perfil.',
          needsManualPassword: true,
        };
      }
    }

    // BROWSER: MODO 2: LER EXCLUSIVAMENTE FOLHA DE RESPOSTAS (GABARITO)
    if (scanTarget === 'sheet') {
      const targetPayload = opts.lockedPayload!;
      try {
        const omrRes = gradeCanvasWithPayloadDebug(canvas, targetPayload);
        return {
          status: 'graded',
          record: omrRes.record,
          evidence: omrRes.evidence,
          payload: targetPayload,
          payloadSource: 'locked',
          versionMismatch: false,
          debugInfo: omrRes.debugInfo,
          debugCanvasUrl: omrRes.debugCanvasUrl,
        };
      } catch (omrErr) {
        const msg =
          omrErr instanceof Error
            ? omrErr.message
            : 'Falha na detecção da folha de respostas.';
        return {
          status: 'error',
          payloadSource: 'locked',
          versionMismatch: false,
          error: `Não foi possível detectar o cartão-resposta na imagem: ${msg}`,
        };
      }
    }

    // BROWSER: MODO 3: AUTOMÁTICO / COMBINADO
    let targetPayload: DecryptedQrPayload | null = opts.lockedPayload;
    let payloadSource: 'qr' | 'locked' | 'none' = opts.lockedPayload ? 'locked' : 'none';
    let versionMismatch = false;

    const shouldReadQr = opts.alwaysReadQr || !opts.lockedPayload;

    if (shouldReadQr) {
      const decodedText = await scanQrFromImageOrCanvas(file, canvas);

      if (decodedText) {
        const passwords = resolveCandidatePasswords(opts);
        if (passwords.length > 0) {
          try {
            const decRes = await decryptWithCandidatePasswords(decodedText, passwords);
            const qrPayload = decRes.payload;
            enrichSubjectivePoints(qrPayload, opts.availableVersions);

            if (opts.lockedPayload) {
              if (
                opts.lockedPayload.examId &&
                qrPayload.examId === opts.lockedPayload.examId &&
                qrPayload.version !== opts.lockedPayload.version
              ) {
                versionMismatch = true;
              } else if (
                !opts.alwaysReadQr &&
                qrPayload.examId &&
                opts.lockedPayload.examId &&
                qrPayload.examId !== opts.lockedPayload.examId
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
                'Não consegui abrir este QR com as senhas das provas deste perfil. A folha pode ser de outra prova ou de outro perfil.',
              needsManualPassword: true,
            };
          }
        } else {
          return {
            status: 'error',
            payloadSource: 'none',
            error: 'Nenhuma senha de prova informada para decodificar o QR Code.',
            needsManualPassword: true,
          };
        }
      }
    }

    if (!targetPayload) {
      return {
        status: 'error',
        payloadSource: 'none',
        error:
          'Não foi possível identificar o QR Code na folha e nenhuma versão está selecionada no corretor. Enquadre a folha completa ou selecione uma versão manualmente.',
      };
    }

    let record: GradingRecord;
    let debugInfo: OmrDebugInfo;
    let debugCanvasUrl: string = '';
    let evidence: GradingEvidence | undefined;

    try {
      const omrRes = gradeCanvasWithPayloadDebug(canvas, targetPayload);
      record = omrRes.record;
      debugInfo = omrRes.debugInfo;
      debugCanvasUrl = omrRes.debugCanvasUrl;
      evidence = omrRes.evidence;
    } catch (omrErr) {
      if (payloadSource === 'qr') {
        return {
          status: 'qr_only',
          payload: targetPayload,
          payloadSource,
          versionMismatch,
        };
      }
      const msg =
        omrErr instanceof Error
          ? omrErr.message
          : 'Falha na detecção da folha de respostas.';
      return {
        status: 'error',
        payloadSource,
        versionMismatch,
        error: `Não foi possível detectar o cartão-resposta na imagem: ${msg}`,
      };
    }

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

