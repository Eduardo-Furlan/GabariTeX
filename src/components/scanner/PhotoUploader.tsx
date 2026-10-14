import React, { useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ExamVersion, GradingRecord } from '../../types/exam';
import { DecryptedQrPayload, OmrDebugInfo } from '../../types/omr';
import { decryptAnswerKey } from '../../utils/crypto';
import { gradeCanvasWithPayloadDebug, detectOmrGrid, GridConfig } from '../../utils/omrProcessor';
import {
  AlertTriangle,
  Image as ImageIcon,
  CheckCircle2,
  QrCode,
  Camera,
  Check,
  Sparkles,
  Bug,
  Download,
  Eye,
  Maximize2,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';

interface PhotoUploaderProps {
  teacherPassword: string;
  activePayload: DecryptedQrPayload | null;
  onLockPayload?: (payload: DecryptedQrPayload) => void;
  onGraded: (record: GradingRecord) => void;
  availableVersions?: ExamVersion[];
  onSelectExamVersion?: (v: ExamVersion) => void;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  teacherPassword,
  activePayload,
  onLockPayload,
  onGraded,
  availableVersions = [],
  onSelectExamVersion,
}) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isDebugAllowed = Boolean(
    import.meta.env.DEV ||
      (typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).has('debug'))
  );
  const [isDebugMode, setIsDebugMode] = useState<boolean>(isDebugAllowed);
  const [debugResult, setDebugResult] = useState<{
    record: GradingRecord;
    debugInfo: OmrDebugInfo;
    debugCanvasUrl: string;
  } | null>(null);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleProcessImage = async (file: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // 1. Carrega imagem em um canvas para processamento
      const img = new Image();
      const imgUrl = URL.createObjectURL(file);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Falha ao carregar arquivo de imagem.'));
        img.src = imgUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 1100;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
      URL.revokeObjectURL(imgUrl);

      let targetPayload = activePayload;

      // 2. Se a versão ainda não estiver travada, busca QR Code na imagem
      if (!targetPayload) {
        let decodedText: string | null = null;

        if (teacherPassword && teacherPassword.trim()) {
          try {
            const qrScanner = new Html5Qrcode('hidden-qr-reader');
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

            // Tentativa: Quadrante superior direito
            if (!decodedText) {
              const cropX = Math.floor(canvas.width * 0.45);
              const cropY = 0;
              const cropW = canvas.width - cropX;
              const cropH = Math.floor(canvas.height * 0.35);
              const scale = Math.min(1, 1000 / Math.max(cropW, cropH));
              const cropCanvas = document.createElement('canvas');
              cropCanvas.width = Math.max(250, Math.floor(cropW * scale));
              cropCanvas.height = Math.max(250, Math.floor(cropH * scale));
              const cropCtx = cropCanvas.getContext('2d');
              if (cropCtx) {
                cropCtx.imageSmoothingEnabled = false;
                cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropCanvas.width, cropCanvas.height);
                try {
                  decodedText = await scanCanvas(cropCanvas);
                } catch {
                  // Falha
                }
              }
            }

            if (decodedText) {
              targetPayload = await decryptAnswerKey(decodedText, teacherPassword);
              onLockPayload?.(targetPayload);
            }
          } catch {
            // Falha silenciosa no QR scan
          }
        }

        // Se o QR Code não foi encontrado na foto
        if (!targetPayload) {
          if (availableVersions.length > 0) {
            // Aplica a primeira versão disponível para permitir inspeção da grade
            const defaultVer = availableVersions[0];
            const pointsMap: Record<number, number> = {};
            const subjectiveQuestions: number[] = [];
            defaultVer.questions.forEach((q, idx) => {
              const qNum = idx + 1;
              if (q.type === 'subjective') {
                subjectiveQuestions.push(qNum);
              } else {
                pointsMap[qNum] = q.points;
              }
            });

            targetPayload = {
              examId: 'auto-exam',
              version: defaultVer.versionLetter,
              key: defaultVer.objectiveAnswerKey,
              points: pointsMap,
              totalQuestions: defaultVer.questions.length,
              subjectiveQuestions,
            };
            onLockPayload?.(targetPayload);
            setSuccessMessage(
              `Foto da grade de respostas detectada. Aplicando gabarito da Versão ${defaultVer.versionLetter}.`
            );
          } else {
            // Mock gabarito de 10 questões para teste visual em modo diagnóstico
            targetPayload = {
              examId: 'debug-exam',
              version: 'A',
              key: { 1: 'A', 2: 'B', 3: 'C', 4: 'C', 5: 'D', 6: 'A', 7: 'E', 8: 'A', 9: 'B', 10: 'C' },
              points: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1 },
              totalQuestions: 10,
              subjectiveQuestions: [3, 6],
            };
          }
        }

        // Se a foto foi apenas um close-up do QR Code (sem a grade de respostas),
        // salva a versão e orienta o usuário a fotografar a folha de respostas
        const totalQuestions =
          targetPayload.totalQuestions ??
          Math.max(...Object.keys(targetPayload.key).map(Number), 0);
        const subjectiveQuestions = targetPayload.subjectiveQuestions ?? [];
        const columnsCount = totalQuestions <= 12 ? 1 : 2;

        const gridConfig: GridConfig = {
          totalQuestions,
          optionsPerQuestion: 5,
          columnsCount,
          subjectiveQuestions,
        };

        const detected = detectOmrGrid(canvas, gridConfig);
        if (!detected || detected.length === 0) {
          setIsProcessing(false);
          setSuccessMessage(
            `Versão ${targetPayload.version} detectada e travada com sucesso! Agora fotografe a folha de respostas.`
          );
          return;
        }
      }

      // 3. Analisa e gera diagnóstico completo do OMR
      const { record, debugInfo, debugCanvasUrl } = gradeCanvasWithPayloadDebug(
        canvas,
        targetPayload
      );

      setIsProcessing(false);

      if (isDebugAllowed && isDebugMode) {
        setDebugResult({ record, debugInfo, debugCanvasUrl });
      } else {
        onGraded(record);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível ler o gabarito na foto.';
      setErrorMessage(msg);
      setIsProcessing(false);
    }
  };

  const handleDownloadDebugImage = () => {
    if (!debugResult?.debugCanvasUrl) return;
    const a = document.createElement('a');
    a.href = debugResult.debugCanvasUrl;
    a.download = `omr-debug-diagnostico-${Date.now()}.jpg`;
    a.click();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
      <div>
        <div id="hidden-qr-reader" className="hidden" />

        {/* Header com Toggle do Modo Diagnóstico */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100 flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Leitor Óptico de Gabaritos (OMR)</h3>
              <p className="text-xs text-slate-500 font-medium">
                Tire uma foto ou faça upload da folha para correção automática
              </p>
            </div>
          </div>

          {isDebugAllowed && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDebugMode(!isDebugMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
                  isDebugMode
                    ? 'bg-amber-500 text-white shadow-amber-500/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Bug className="w-3.5 h-3.5" />
                <span>Modo Diagnóstico OMR {isDebugMode ? 'ATIVO' : 'DESATIVADO'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Status da Versão Travada */}
        <div className="mb-5 p-4 rounded-xl border flex items-center justify-between flex-wrap gap-3 text-xs bg-slate-50/80 border-slate-200">
          {activePayload ? (
            <div className="flex items-center justify-between w-full flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1 bg-emerald-600 text-white font-black rounded-lg flex items-center gap-1.5 shadow-sm text-xs">
                  <CheckCircle2 className="w-4 h-4" /> VERSÃO {activePayload.version} TRAVADA
                </span>
                <span className="text-slate-700 font-medium text-xs">
                  Pronto! Enquadre e fotografe a folha de respostas.
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <Sparkles className="w-3.5 h-3.5" /> OMR com auto-alinhamento ativo
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full flex-wrap gap-3">
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <QrCode className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Selecione a versão da prova ou fotografe o QR Code da folha:</span>
              </div>
              {availableVersions.length > 0 && onSelectExamVersion && (
                <div className="flex items-center gap-1.5">
                  {availableVersions.map((v) => (
                    <button
                      key={v.versionLetter}
                      type="button"
                      onClick={() => onSelectExamVersion(v)}
                      className="px-3 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-200 rounded-lg font-bold text-xs transition active:scale-95 shadow-sm"
                    >
                      Versão {v.versionLetter}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Painel do Modo Diagnóstico OMR / Resultado Debug */}
        {isDebugAllowed && isDebugMode && debugResult && (
          <div className="mb-6 p-5 bg-slate-900 text-slate-100 rounded-2xl shadow-xl border border-slate-800 space-y-5 animate-in fade-in duration-300">
            {/* Barra de Título do Debug */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
                  <Eye className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="font-extrabold text-sm text-white">
                    Diagnóstico OMR — Visualização em Tempo Real
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Método:{' '}
                    <span className="text-sky-400 font-bold">
                      {debugResult.debugInfo.method === 'timing_marks'
                        ? 'Sincronizadores de Linha (Timing Marks)'
                        : debugResult.debugInfo.method === 'box_borders'
                        ? 'Caixa Delimitadora (Bordas)'
                        : 'Coordenadas Padrão A4'}
                    </span>{' '}
                    | Linhas mapeadas:{' '}
                    <span className="text-emerald-400 font-bold">
                      {debugResult.debugInfo.timingMarks?.length ?? 0}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadDebugImage}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar Imagem Anotada
                </button>
                <button
                  type="button"
                  onClick={() => setIsImageModalOpen(true)}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                >
                  <Maximize2 className="w-3.5 h-3.5" /> Zoom da Leitura
                </button>
              </div>
            </div>

            {/* Imagem Anotada e Tabela de Diagnóstico */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Preview da Imagem com Anotações Visuais */}
              <div className="lg:col-span-5 bg-black rounded-xl overflow-hidden border border-slate-800 relative group">
                {debugResult.debugCanvasUrl ? (
                  <img
                    src={debugResult.debugCanvasUrl}
                    alt="OMR Debug Annotated"
                    className="w-full h-auto object-contain max-h-[380px] mx-auto cursor-pointer"
                    onClick={() => setIsImageModalOpen(true)}
                  />
                ) : (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Sem preview disponível
                  </div>
                )}
                <div className="absolute bottom-2 left-2 right-2 bg-slate-900/90 backdrop-blur px-2.5 py-1.5 rounded-lg text-[10px] text-slate-300 flex items-center justify-between border border-slate-700/50">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Marcada
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block ml-1" /> Suspeita
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block ml-1" /> Vazia
                  </span>
                  <span className="text-slate-400 font-mono">Clique para ampliar</span>
                </div>
              </div>

              {/* Tabela de Porcentagens de Escuridão por Opção */}
              <div className="lg:col-span-7 bg-slate-950/60 rounded-xl p-3 border border-slate-800 overflow-x-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300">
                    Valores de Preenchimento Detectados (% de Escuridão)
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                    Acertos: {debugResult.record.totalScore} / {debugResult.record.maxScore} (
                    {debugResult.record.percentage.toFixed(0)}%)
                  </span>
                </div>

                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800 text-[11px]">
                      <th className="py-1 px-2 font-semibold">Q#</th>
                      <th className="py-1 px-2 font-semibold text-center">Gabarito</th>
                      <th className="py-1 px-2 font-semibold text-center">Detectado</th>
                      <th className="py-1 px-2 font-semibold">Preenchimentos (A, B, C, D, E)</th>
                      <th className="py-1 px-2 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {debugResult.record.answers.map((ans) => {
                      const qBubbles = debugResult.debugInfo.bubbles.filter(
                        (b) => b.questionNumber === ans.questionNumber
                      );

                      return (
                        <tr key={ans.questionNumber} className="hover:bg-slate-800/40">
                          <td className="py-1.5 px-2 font-bold font-mono text-slate-300">
                            Q{ans.questionNumber < 10 ? `0${ans.questionNumber}` : ans.questionNumber}
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <span className="px-1.5 py-0.5 bg-slate-800 font-bold rounded text-slate-300 text-[11px]">
                              {ans.correctOption}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            {ans.markedOption ? (
                              <span
                                className={`px-2 py-0.5 rounded font-black text-xs ${
                                  ans.isCorrect
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                }`}
                              >
                                {ans.markedOption}
                              </span>
                            ) : (
                              <span className="text-slate-500 font-mono text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-1.5 px-2">
                            <div className="flex items-center gap-1">
                              {(['A', 'B', 'C', 'D', 'E'] as const).map((opt) => {
                                const bInfo = qBubbles.find((b) => b.optionLabel === opt);
                                const ratio = bInfo ? Math.round(bInfo.fillRatio * 100) : 0;
                                const isMarked = bInfo?.isMarked ?? false;
                                const isSuspicious = !isMarked && ratio >= 25;

                                return (
                                  <span
                                    key={opt}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                      isMarked
                                        ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                                        : isSuspicious
                                        ? 'bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40'
                                        : 'bg-slate-800/80 text-slate-400'
                                    }`}
                                  >
                                    {opt}:{ratio}%
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            {ans.status === 'correct' && (
                              <span className="text-emerald-400 font-bold text-[11px]">Correta</span>
                            )}
                            {ans.status === 'wrong' && (
                              <span className="text-rose-400 font-bold text-[11px]">Incorreta</span>
                            )}
                            {ans.status === 'blank' && (
                              <span className="text-slate-500 text-[11px]">Em branco</span>
                            )}
                            {ans.status === 'multiple' && (
                              <span className="text-amber-400 font-bold text-[11px]">Múltipla</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Logs Detalhados do OMR */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/70">
              <button
                type="button"
                onClick={() => setShowLogs(!showLogs)}
                className="w-full px-4 py-2 text-left text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center justify-between transition"
              >
                <span>Logs do Processamento OMR ({debugResult.debugInfo.logs.length} eventos)</span>
                {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showLogs && (
                <div className="p-3 bg-slate-950 font-mono text-[11px] text-slate-400 space-y-1 max-h-40 overflow-y-auto border-t border-slate-800">
                  {debugResult.debugInfo.logs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-slate-600 select-none">{idx + 1}.</span>
                      <span className="text-slate-300">{log}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ações do Diagnóstico */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDebugResult(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Escanear Outra Folha
              </button>
              <button
                type="button"
                onClick={() => {
                  onGraded(debugResult.record);
                  setSuccessMessage('Correção confirmada e registrada com sucesso!');
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition shadow-lg shadow-emerald-900/30 flex items-center gap-2"
              >
                <Check className="w-4 h-4" /> Confirmar e Salvar no Livro de Notas
              </button>
            </div>
          </div>
        )}

        {/* Inputs de Arquivo Ocultos */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={isProcessing}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleProcessImage(e.target.files[0]);
            }
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={isProcessing}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleProcessImage(e.target.files[0]);
            }
          }}
        />

        {/* Botões de Ação para Captura */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isProcessing}
            className={`w-full py-4 px-5 text-white font-extrabold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 active:scale-[0.99] ${
              activePayload
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-700/20'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-700/20'
            }`}
          >
            <Camera className="w-5 h-5" />
            <span>
              {isProcessing
                ? 'Processando imagem com OMR...'
                : activePayload
                ? `Tirar Foto da Folha de Respostas (Versão ${activePayload.version})`
                : 'Tirar Foto com Câmera do Celular'}
            </span>
          </button>

          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition ${
              isProcessing
                ? 'border-indigo-400 bg-indigo-50/50'
                : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30'
            }`}
          >
            <div className="flex flex-col items-center justify-center">
              <ImageIcon className="w-6 h-6 text-slate-400 mb-1.5" />
              <span className="text-xs font-semibold text-slate-700">
                Ou selecionar foto já tirada da galeria / arquivos
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Formatos suportados: JPG, PNG, WEBP</span>
            </div>
          </div>
        </div>

        {/* Mensagens de Sucesso e Erro */}
        {successMessage && (
          <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600 font-bold" />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1.5">
        <p className="font-bold text-slate-800 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Como funciona o alinhamento OMR:
        </p>
        <p>
          • Os <strong>sincronizadores de linha (timing marks)</strong> mapeiam cada linha de resposta de forma independente, compensando inclinações e distorções de lente.
        </p>
        <p>
          • O <strong>Modo Diagnóstico OMR</strong> permite inspecionar cada círculo lido, seus índices de escuridão e visualizar com clareza qualquer marcação duvidosa.
        </p>
      </div>

      {/* Modal de Zoom da Imagem Anotada */}
      {isImageModalOpen && debugResult?.debugCanvasUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-sky-400" /> Inspeção Visual de Alta Resolução do OMR
              </h4>
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-black">
              <img
                src={debugResult.debugCanvasUrl}
                alt="OMR Debug Full View"
                className="max-w-full max-h-[75vh] object-contain"
              />
            </div>
            <div className="p-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between text-xs text-slate-400">
              <span>Círculos verdes = marcados | Linhas amarelas = timing marks | Bordas ciano = limites do gabarito</span>
              <button
                type="button"
                onClick={handleDownloadDebugImage}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" /> Baixar Imagem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
