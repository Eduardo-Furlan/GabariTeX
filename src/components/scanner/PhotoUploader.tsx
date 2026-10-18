import React, { useRef, useState, useEffect } from 'react';
import { ExamVersion, GradingRecord } from '../../types/exam';
import { DecryptedQrPayload, OmrDebugInfo, GradingEvidence } from '../../types/omr';
import { gradePhotoFile } from '../../utils/photoPipeline';
import {
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
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FileCheck,
  Smartphone,
  Upload,
} from 'lucide-react';

import { PasswordModal } from './PasswordModal';
import { reportRemotePhoto } from '../../platform/remoteCamera';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Alert } from '../ui/Alert';

interface PhotoUploaderProps {
  teacherPassword: string;
  candidatePasswords?: string[];
  activePayload: DecryptedQrPayload | null;
  onLockPayload?: (payload: DecryptedQrPayload | null) => void;
  onGraded: (record: GradingRecord, evidence?: GradingEvidence) => void;
  availableVersions?: ExamVersion[];
  onSelectExamVersion?: (v: ExamVersion) => void;
  onOpenRemoteCamera?: () => void;
  isRemoteConnected?: boolean;
  incomingRemotePhoto?: {
    file: File;
    id: string;
    target?: 'qr' | 'sheet';
    timestamp: number;
  } | null;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  teacherPassword,
  candidatePasswords,
  activePayload,
  onLockPayload,
  onGraded,
  availableVersions = [],
  onSelectExamVersion,
  onOpenRemoteCamera,
  isRemoteConnected = false,
  incomingRemotePhoto,
}) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [scanTarget, setScanTarget] = useState<'qr' | 'sheet'>(activePayload ? 'sheet' : 'qr');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsManualPassword, setNeedsManualPassword] = useState<boolean>(false);
  const [showManualPasswordModal, setShowManualPasswordModal] = useState<boolean>(false);
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
    evidence?: GradingEvidence;
  } | null>(null);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);
  const [errorDebugUrl, setErrorDebugUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const lastProcessedFileRef = useRef<File | null>(null);
  const lockedPayloadRef = useRef<DecryptedQrPayload | null>(activePayload);
  const scanTargetRef = useRef<'qr' | 'sheet'>(scanTarget);

  useEffect(() => {
    scanTargetRef.current = scanTarget;
  }, [scanTarget]);

  useEffect(() => {
    lockedPayloadRef.current = activePayload;
    if (activePayload) {
      setScanTarget('sheet');
      scanTargetRef.current = 'sheet';
    }
  }, [activePayload]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Processa automaticamente fotos recebidas da câmera remota
  useEffect(() => {
    if (!incomingRemotePhoto) return;
    const { file, id, target } = incomingRemotePhoto;
    if (target) {
      setScanTarget(target);
      scanTargetRef.current = target;
    }
    handleProcessImage(file, undefined, id, target);
  }, [incomingRemotePhoto]);

  const handleProcessImage = async (
    file: File,
    overridePassword?: string,
    remoteId?: string,
    overrideTarget?: 'qr' | 'sheet'
  ) => {
    lastProcessedFileRef.current = file;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    try {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } catch {
      setPreviewUrl(null);
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setNeedsManualPassword(false);
    setSuccessMessage(null);
    setErrorDebugUrl(null);

    const passwordsToTry = overridePassword
      ? [overridePassword, ...(candidatePasswords || [])]
      : candidatePasswords;

    const effectivePayload = lockedPayloadRef.current || activePayload;
    const effectiveTarget = overrideTarget || scanTargetRef.current;

    const result = await gradePhotoFile(file, {
      teacherPassword,
      candidatePasswords: passwordsToTry,
      lockedPayload: effectivePayload,
      scanTarget: effectiveTarget,
      alwaysReadQr: false,
      availableVersions,
    });

    setIsProcessing(false);

    if (result.status === 'error') {
      setErrorMessage(result.error || 'Não foi possível processar a imagem.');
      if (result.needsManualPassword) {
        setNeedsManualPassword(true);
      }
      if (result.debugCanvasUrl) {
        setErrorDebugUrl(result.debugCanvasUrl);
      }
      if (remoteId) {
        reportRemotePhoto(
          remoteId,
          'error',
          'Erro na leitura',
          result.error || 'Não foi possível ler a folha'
        );
      }
      return;
    }

    if (result.status === 'qr_only') {
      if (result.payload) {
        lockedPayloadRef.current = result.payload;
        onLockPayload?.(result.payload);
        setScanTarget('sheet');
        setSuccessMessage(
          `Versão ${result.payload.version} detectada e travada com sucesso! Agora você pode fotografar ou selecionar a folha de respostas.`
        );
      }
      if (remoteId) {
        reportRemotePhoto(
          remoteId,
          'ok',
          `QR Versão ${result.payload?.version || 'identificado'}`,
          'Agora envie a foto da folha de respostas'
        );
      }
      return;
    }

    if (result.payload && result.payloadSource === 'qr') {
      lockedPayloadRef.current = result.payload;
      onLockPayload?.(result.payload);
      setScanTarget('sheet');
      setSuccessMessage(
        `QR Code identificado! Gabarito da Versão ${result.payload.version} carregado com sucesso.`
      );
    }

    if (remoteId) {
      if (result.record) {
        reportRemotePhoto(
          remoteId,
          'ok',
          `Nota: ${result.record.totalScore.toFixed(1)}`,
          `Versão ${result.record.versionLetter || 'A'}`
        );
      } else {
        reportRemotePhoto(remoteId, 'ok', 'Foto recebida e processada');
      }
    }

    if (isDebugAllowed && isDebugMode && result.record && result.debugInfo && result.debugCanvasUrl) {
      setDebugResult({
        record: result.record,
        debugInfo: result.debugInfo,
        debugCanvasUrl: result.debugCanvasUrl,
        evidence: result.evidence,
      });
    } else if (result.record) {
      onGraded(result.record, result.evidence);
    }
  };

  const handleDownloadDebugImage = () => {
    const url = debugResult?.debugCanvasUrl || errorDebugUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `omr-debug-diagnostico-${Date.now()}.jpg`;
    a.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isProcessing) return;
    if (scanTarget === 'sheet' && !activePayload) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessImage(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="bg-white rounded-card shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
      <div>
        <div
          id="hidden-qr-reader"
          style={{
            position: 'fixed',
            top: -9999,
            left: -9999,
            width: 800,
            height: 800,
            opacity: 0,
            pointerEvents: 'none',
          }}
        />

        {/* Header com Toggle do Modo Diagnóstico */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-200 flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-body font-display font-bold text-slate-900">Leitor Óptico de Gabaritos (OMR)</h3>
              <p className="text-meta text-slate-500 font-medium">
                Tire uma foto ou faça upload da folha para correção automática
              </p>
            </div>
          </div>

          {isDebugAllowed && (
            <div className="flex items-center gap-2">
              <Button
                variant={isDebugMode ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setIsDebugMode(!isDebugMode)}
                icon={<Bug className="w-3.5 h-3.5" />}
              >
                <span>Modo Diagnóstico OMR {isDebugMode ? 'ATIVO' : 'DESATIVADO'}</span>
              </Button>
            </div>
          )}
        </div>

        {/* Status da Versão Travada */}
        <div className="mb-5 p-4 rounded-xl border flex items-center justify-between flex-wrap gap-3 text-meta bg-slate-50/80 border-slate-200">
          {activePayload ? (
            <div className="flex items-center justify-between w-full flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1 bg-emerald-600 text-on-accent font-black rounded-lg flex items-center gap-1.5 shadow-sm text-meta">
                  <CheckCircle2 className="w-4 h-4" /> VERSÃO {activePayload.version} TRAVADA
                </span>
                <span className="text-slate-700 font-medium text-meta">
                  Pronto! Enquadre e fotografe a folha de respostas.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-meta text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <Sparkles className="w-3.5 h-3.5" /> OMR com auto-alinhamento ativo
                </div>
                {onLockPayload && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      lockedPayloadRef.current = null;
                      setScanTarget('qr');
                      onLockPayload(null);
                    }}
                    icon={<RefreshCw className="w-3 h-3" />}
                  >
                    Destravar
                  </Button>
                )}
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
                  {availableVersions.map((v, idx) => (
                    <button
                      key={v?.versionLetter || idx}
                      type="button"
                      onClick={() => onSelectExamVersion(v)}
                      className="px-3 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-on-accent text-indigo-700 border border-indigo-200 rounded-lg font-bold text-meta transition active:scale-95 shadow-sm"
                    >
                      Versão {v?.versionLetter || '?'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Painel do Modo Diagnóstico OMR / Resultado Debug */}
        {isDebugAllowed && isDebugMode && debugResult && (
          <div className="keep-light-palette mb-6 p-5 bg-slate-900 text-slate-100 rounded-card shadow-xl border border-slate-800 space-y-5">
            {/* Barra de Título do Debug */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
                  <Eye className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="font-extrabold text-sm text-on-accent">
                    Diagnóstico OMR. Visualização em Tempo Real
                  </h4>
                  <p className="text-meta text-slate-400">
                    Método:{' '}
                    <span className="text-sky-400 font-bold">
                      {debugResult.debugInfo.method === 'fiducials_timing_marks'
                        ? 'Fiduciais + Sincronizadores (OMR)'
                        : debugResult.debugInfo.method === 'timing_marks'
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
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadDebugImage}
                  icon={<Download className="w-3.5 h-3.5" />}
                >
                  Baixar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsImageModalOpen(true)}
                  icon={<Maximize2 className="w-3.5 h-3.5" />}
                >
                  Ampliar
                </Button>
              </div>
            </div>

            {/* Imagem Processada Anotada */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-5 bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center relative group min-h-[220px]">
                <img
                  src={debugResult.debugCanvasUrl}
                  alt="OMR Debug Canvas"
                  className="max-h-64 object-contain"
                />
                <button
                  type="button"
                  onClick={() => setIsImageModalOpen(true)}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-on-accent font-bold text-xs gap-1.5"
                >
                  <Maximize2 className="w-4 h-4" /> Clique para ampliar inspeção
                </button>
              </div>

              {/* Tabela de Porcentagens de Escuridão por Opção */}
              <div className="lg:col-span-7 bg-slate-950/60 rounded-xl p-3 border border-slate-800 overflow-x-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-meta font-bold text-slate-300">
                    Valores de Preenchimento Detectados (% de Escuridão)
                  </span>
                  <span className="text-meta font-mono text-emerald-400 font-semibold tabular-nums">
                    Acertos: {debugResult.record.totalScore} / {debugResult.record.maxScore} (
                    {debugResult.record.percentage.toFixed(0)}%)
                  </span>
                </div>

                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800 text-meta">
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
                            <span className="px-1.5 py-0.5 bg-slate-800 font-bold rounded text-slate-300 text-meta">
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
                              <span className="text-slate-500 font-mono text-meta">—</span>
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
                              <span className="text-emerald-400 font-bold text-meta">Correta</span>
                            )}
                            {ans.status === 'wrong' && (
                              <span className="text-rose-400 font-bold text-meta">Incorreta</span>
                            )}
                            {ans.status === 'blank' && (
                              <span className="text-slate-500 text-meta">Em branco</span>
                            )}
                            {ans.status === 'multiple' && (
                              <span className="text-amber-400 font-bold text-meta">Múltipla</span>
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
                <div className="p-3 bg-slate-950 font-mono text-meta text-slate-400 space-y-1 max-h-40 overflow-y-auto border-t border-slate-800">
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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDebugResult(null)}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Escanear Outra Folha
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onGraded(debugResult.record, debugResult.evidence);
                  setSuccessMessage('Correção confirmada e registrada com sucesso!');
                }}
                icon={<Check className="w-4 h-4" />}
              >
                Confirmar e Salvar no Livro de Notas
              </Button>
            </div>
          </div>
        )}

        {/* Seletor de Etapa: QR Code vs Folha de Gabarito */}
        <div className="mb-5">
          <div className="text-meta font-bold text-slate-800 mb-2 flex items-center justify-between">
            <span>O que você deseja escanear agora?</span>
            {!activePayload && (
              <span className="text-meta font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Trave uma versão antes de ler o gabarito
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
            {/* Opção 1: Ler QR Code */}
            <button
              type="button"
              onClick={() => {
                setScanTarget('qr');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex items-center gap-2.5 p-3 rounded-lg text-left transition ${
                scanTarget === 'qr'
                  ? 'bg-white shadow-sm font-bold border border-indigo-400'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <div
                className={`p-2 rounded-lg ${
                  scanTarget === 'qr'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-200/80 text-slate-700'
                }`}
              >
                <QrCode className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div
                  className={`text-body font-bold leading-tight ${
                    scanTarget === 'qr' ? 'text-indigo-700' : 'text-slate-800'
                  }`}
                >
                  1. Ler QR Code da Prova
                </div>
                <div className="text-meta font-medium leading-tight mt-0.5 text-slate-500">
                  Identifica a versão e desbloqueia com a senha
                </div>
              </div>
            </button>

            {/* Opção 2: Ler Gabarito (OMR) */}
            <button
              type="button"
              disabled={!activePayload}
              onClick={() => {
                if (activePayload) {
                  setScanTarget('sheet');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }
              }}
              className={`flex items-center gap-2.5 p-3 rounded-lg text-left transition ${
                !activePayload
                  ? 'opacity-40 cursor-not-allowed bg-transparent'
                  : scanTarget === 'sheet'
                  ? 'bg-white shadow-sm font-bold border border-emerald-400'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <div
                className={`p-2 rounded-lg ${
                  !activePayload
                    ? 'bg-slate-200/40 text-slate-400'
                    : scanTarget === 'sheet'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-200/80 text-slate-700'
                }`}
              >
                <FileCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div
                  className={`text-body font-bold leading-tight flex items-center gap-1.5 ${
                    !activePayload
                      ? 'text-slate-400'
                      : scanTarget === 'sheet'
                      ? 'text-emerald-700'
                      : 'text-slate-800'
                  }`}
                >
                  <span>2. Ler Folha de Gabarito</span>
                  {activePayload && (
                    <span className="text-meta px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-black">
                      Versão {activePayload.version}
                    </span>
                  )}
                </div>
                <div className="text-meta font-medium leading-tight mt-0.5 text-slate-500">
                  {activePayload
                    ? 'Corrige o cartão-resposta e marcações'
                    : 'Bloqueado (trave a versão primeiro)'}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Inputs de Arquivo Ocultos */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={isProcessing}
          onClick={(e) => {
            (e.target as HTMLInputElement).value = '';
          }}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              const file = e.target.files[0];
              e.target.value = '';
              handleProcessImage(file);
            }
          }}
        />
        {!__DESKTOP__ && (
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={isProcessing}
            onClick={(e) => {
              (e.target as HTMLInputElement).value = '';
            }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                e.target.value = '';
                handleProcessImage(file);
              }
            }}
          />
        )}

        {/* Botões de Ação para Captura */}
        <div className="space-y-3">
          {typeof __DESKTOP__ !== 'undefined' && __DESKTOP__ && onOpenRemoteCamera && (
            <button
              type="button"
              onClick={onOpenRemoteCamera}
              disabled={isProcessing}
              className={`w-full py-4 px-5 font-extrabold text-sm rounded-xl border-2 transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 active:scale-[0.99] shadow-xs ${
                isRemoteConnected
                  ? 'border-emerald-300 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100'
                  : 'border-dashed border-indigo-300 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              <Smartphone className="w-5 h-5 text-indigo-600" />
              <span>
                {isRemoteConnected
                  ? 'Celular Conectado. Ver QR Code / Instruções'
                  : 'Tirar Foto com a Câmera do Celular (Parear por QR Code)'}
              </span>
            </button>
          )}

          {!__DESKTOP__ && (
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isProcessing || (scanTarget === 'sheet' && !activePayload)}
              className={`w-full py-4 px-5 text-on-accent font-extrabold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 active:scale-[0.99] ${
                scanTarget === 'sheet'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-700/20'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-700/20'
              }`}
            >
              <Camera className="w-5 h-5" />
              <span>
                {isProcessing
                  ? scanTarget === 'qr'
                    ? 'Lendo QR Code...'
                    : 'Processando folha com OMR...'
                  : scanTarget === 'sheet' && activePayload
                  ? `Tirar Foto da Folha de Respostas (Versão ${activePayload.version})`
                  : 'Tirar Foto do QR Code'}
              </span>
            </button>
          )}

          {/* Dropzone com estados: idle / drag-over / reading */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              if (!isProcessing && !(scanTarget === 'sheet' && !activePayload)) {
                if (fileInputRef.current) fileInputRef.current.value = '';
                fileInputRef.current?.click();
              }
            }}
            className={`border-2 border-dashed rounded-card p-6 text-center cursor-pointer transition transform ${
              scanTarget === 'sheet' && !activePayload
                ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50'
                : isProcessing
                ? 'border-indigo-500 bg-indigo-50/50'
                : isDragOver
                ? 'border-indigo-600 bg-indigo-50/60 scale-[1.01]'
                : scanTarget === 'sheet'
                ? 'border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/20'
                : 'border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/20'
            }`}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center py-2 space-y-3">
                <div className="relative w-28 h-36 rounded-lg overflow-hidden border border-indigo-300 bg-slate-100 flex items-center justify-center shadow-xs">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Folha em leitura"
                      className="w-full h-full object-cover opacity-80"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-indigo-400 opacity-60" />
                  )}
                  {/* Linha de varredura do leitor óptico */}
                  <div
                    className="absolute inset-x-0 h-1 bg-indigo-600 shadow-sm animate-scan-sweep pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-body font-bold text-indigo-900 block">
                    {scanTarget === 'qr' ? 'Lendo QR Code...' : 'Lendo folha…'}
                  </span>
                  <span className="text-meta text-slate-500 block">
                    Retificando perspectiva e alinhando fiduciais ópticos
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center">
                {isDragOver ? (
                  <Upload className="w-8 h-8 text-indigo-600 mb-2 animate-bounce" />
                ) : scanTarget === 'qr' ? (
                  <QrCode className="w-8 h-8 text-indigo-500 mb-2" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-emerald-500 mb-2" />
                )}
                <span className="text-body font-bold text-slate-800">
                  {isDragOver
                    ? 'Solte a foto aqui para iniciar a leitura'
                    : scanTarget === 'qr'
                    ? 'Clique ou arraste a foto do QR Code da prova'
                    : activePayload
                    ? `Clique ou arraste a foto da folha de respostas (Versão ${activePayload.version})`
                    : 'Trave uma versão antes de ler o gabarito'}
                </span>
                <span className="text-meta text-slate-500 mt-1">
                  {scanTarget === 'qr'
                    ? 'Busca estritamente o QR Code para destravar a versão com a senha'
                    : 'Busca estritamente os fiduciais e marcações das bolinhas'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Mensagens de Sucesso e Erro */}
        {successMessage && (
          <div className="mt-4">
            <Alert tone="success">
              {successMessage}
            </Alert>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4">
            <Alert
              tone="danger"
              action={
                needsManualPassword && lastProcessedFileRef.current ? (
                  <div className="pt-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setShowManualPasswordModal(true)}
                    >
                      Digitar senha manualmente
                    </Button>
                  </div>
                ) : undefined
              }
            >
              {errorMessage}
            </Alert>
          </div>
        )}

        {isDebugAllowed && isDebugMode && errorDebugUrl && !debugResult && (
          <div className="keep-light-palette mt-4 p-4 bg-slate-900 text-slate-100 rounded-card border border-slate-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-meta font-bold text-amber-400 flex items-center gap-1.5">
                <Bug className="w-4 h-4" /> Diagnóstico Visual da Imagem (Falha na Detecção)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadDebugImage}
                  icon={<Download className="w-3.5 h-3.5" />}
                >
                  Baixar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsImageModalOpen(true)}
                  icon={<Maximize2 className="w-3.5 h-3.5" />}
                >
                  Ampliar
                </Button>
              </div>
            </div>
            <div className="bg-black rounded-xl overflow-hidden border border-slate-800 flex justify-center">
              <img
                src={errorDebugUrl}
                alt="Diagnóstico de Erro OMR"
                onClick={() => setIsImageModalOpen(true)}
                className="max-h-80 object-contain cursor-zoom-in"
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-card text-meta text-slate-600 space-y-1.5">
        <p className="font-bold text-slate-800 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Como funciona o alinhamento OMR:
        </p>
        <p>
          • Os <strong>fiduciais de canto</strong> mapeiam a folha e retificam a perspectiva em tempo real, compensando inclinações e distorções de lente.
        </p>
        <p>
          • O <strong>Modo Diagnóstico OMR</strong> permite inspecionar cada círculo lido, seus índices de escuridão e visualizar com clareza qualquer marcação duvidosa.
        </p>
      </div>

      {/* Modal de Zoom da Imagem Anotada */}
      {isImageModalOpen && (debugResult?.debugCanvasUrl || errorDebugUrl) && (
        <Modal
          open={true}
          onOpenChange={(open) => setIsImageModalOpen(open)}
          title="Inspeção Visual de Alta Resolução do OMR"
          size="xl"
          footer={
            <div className="flex items-center justify-between w-full text-meta text-slate-500">
              <span>Círculos verdes = marcados | Linhas amarelas = timing marks | Bordas ciano = limites do gabarito</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownloadDebugImage}
                icon={<Download className="w-3.5 h-3.5" />}
              >
                Baixar Imagem
              </Button>
            </div>
          }
        >
          <div className="p-2 overflow-auto flex items-center justify-center bg-black rounded-xl">
            <img
              src={debugResult?.debugCanvasUrl || errorDebugUrl || ''}
              alt="OMR Debug Full View"
              className="max-w-full max-h-[70vh] object-contain"
            />
          </div>
        </Modal>
      )}

      {showManualPasswordModal && (
        <PasswordModal
          onSubmitPassword={(typedPass) => {
            setShowManualPasswordModal(false);
            if (lastProcessedFileRef.current) {
              handleProcessImage(lastProcessedFileRef.current, typedPass);
            }
          }}
          onClose={() => setShowManualPasswordModal(false)}
        />
      )}
    </div>
  );
};
