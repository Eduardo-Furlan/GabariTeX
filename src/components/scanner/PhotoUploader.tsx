import React, { useRef, useState, useEffect } from 'react';
import { ExamVersion, GradingRecord } from '../../types/exam';
import { DecryptedQrPayload, OmrDebugInfo, GradingEvidence } from '../../types/omr';
import { gradePhotoFile } from '../../utils/photoPipeline';
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
  FileCheck,
} from 'lucide-react';

import { PasswordModal } from './PasswordModal';

interface PhotoUploaderProps {
  teacherPassword: string;
  candidatePasswords?: string[];
  activePayload: DecryptedQrPayload | null;
  onLockPayload?: (payload: DecryptedQrPayload | null) => void;
  onGraded: (record: GradingRecord, evidence?: GradingEvidence) => void;
  availableVersions?: ExamVersion[];
  onSelectExamVersion?: (v: ExamVersion) => void;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  teacherPassword,
  candidatePasswords,
  activePayload,
  onLockPayload,
  onGraded,
  availableVersions = [],
  onSelectExamVersion,
}) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [scanTarget, setScanTarget] = useState<'qr' | 'sheet'>(activePayload ? 'sheet' : 'qr');
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

  useEffect(() => {
    if (activePayload && scanTarget === 'qr') {
      setScanTarget('sheet');
    } else if (!activePayload && scanTarget === 'sheet') {
      setScanTarget('qr');
    }
  }, [activePayload]);

  const handleProcessImage = async (file: File, overridePassword?: string) => {
    lastProcessedFileRef.current = file;
    setIsProcessing(true);
    setErrorMessage(null);
    setNeedsManualPassword(false);
    setSuccessMessage(null);
    setErrorDebugUrl(null);

    const passwordsToTry = overridePassword
      ? [overridePassword, ...(candidatePasswords || [])]
      : candidatePasswords;

    const result = await gradePhotoFile(file, {
      teacherPassword,
      candidatePasswords: passwordsToTry,
      lockedPayload: activePayload,
      scanTarget,
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
      return;
    }

    if (result.status === 'qr_only') {
      if (result.payload) {
        onLockPayload?.(result.payload);
        setScanTarget('sheet');
        setSuccessMessage(
          `Versão ${result.payload.version} detectada e travada com sucesso! Agora você pode fotografar ou selecionar a folha de respostas.`
        );
      }
      return;
    }

    if (result.payload && result.payloadSource === 'qr') {
      onLockPayload?.(result.payload);
      setScanTarget('sheet');
      setSuccessMessage(
        `QR Code identificado! Gabarito da Versão ${result.payload.version} carregado com sucesso.`
      );
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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
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
            <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
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
                    ? 'bg-amber-500 text-on-accent shadow-amber-500/20'
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
                <span className="px-3 py-1 bg-emerald-600 text-on-accent font-black rounded-lg flex items-center gap-1.5 shadow-sm text-xs">
                  <CheckCircle2 className="w-4 h-4" /> VERSÃO {activePayload.version} TRAVADA
                </span>
                <span className="text-slate-700 font-medium text-xs">
                  Pronto! Enquadre e fotografe a folha de respostas.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/30">
                  <Sparkles className="w-3.5 h-3.5" /> OMR com auto-alinhamento ativo
                </div>
                {onLockPayload && (
                  <button
                    type="button"
                    onClick={() => onLockPayload(null)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 rounded-lg transition border border-slate-200 bg-white"
                  >
                    <RefreshCw className="w-3 h-3" /> Destravar
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full flex-wrap gap-3">
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <QrCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Selecione a versão da prova ou fotografe o QR Code da folha:</span>
              </div>
              {availableVersions.length > 0 && onSelectExamVersion && (
                <div className="flex items-center gap-1.5">
                  {availableVersions.map((v, idx) => (
                    <button
                      key={v?.versionLetter || idx}
                      type="button"
                      onClick={() => onSelectExamVersion(v)}
                      className="px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-600 hover:text-on-accent text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 rounded-lg font-bold text-xs transition active:scale-95 shadow-sm"
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
          <div className="keep-light-palette mb-6 p-5 bg-slate-900 text-slate-100 rounded-2xl shadow-xl border border-slate-800 space-y-5 animate-in fade-in duration-300">
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
                  <p className="text-[11px] text-slate-400">
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
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-on-accent rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
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
                  onGraded(debugResult.record, debugResult.evidence);
                  setSuccessMessage('Correção confirmada e registrada com sucesso!');
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-on-accent rounded-xl text-xs font-black transition shadow-lg shadow-emerald-900/30 flex items-center gap-2"
              >
                <Check className="w-4 h-4" /> Confirmar e Salvar no Livro de Notas
              </button>
            </div>
          </div>
        )}

        {/* Seletor de Etapa: QR Code vs Folha de Gabarito */}
        <div className="mb-5">
          <div className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
            <span>O que você deseja escanear agora?</span>
            {!activePayload && (
              <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/80">
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
                  ? 'bg-white shadow-sm font-bold border border-indigo-400 dark:border-indigo-500/60'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <div
                className={`p-2 rounded-lg ${
                  scanTarget === 'qr'
                    ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                    : 'bg-slate-200/80 text-slate-700'
                }`}
              >
                <QrCode className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div
                  className={`text-xs font-bold leading-tight ${
                    scanTarget === 'qr'
                      ? 'text-indigo-700 dark:text-indigo-300'
                      : 'text-slate-800'
                  }`}
                >
                  1. Ler QR Code da Prova
                </div>
                <div
                  className={`text-[10px] font-medium leading-tight mt-0.5 ${
                    scanTarget === 'qr' ? 'text-slate-600' : 'text-slate-500'
                  }`}
                >
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
                  ? 'bg-white shadow-sm font-bold border border-emerald-400 dark:border-emerald-500/60'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <div
                className={`p-2 rounded-lg ${
                  !activePayload
                    ? 'bg-slate-200/40 text-slate-400'
                    : scanTarget === 'sheet'
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-200/80 text-slate-700'
                }`}
              >
                <FileCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div
                  className={`text-xs font-bold leading-tight flex items-center gap-1.5 ${
                    !activePayload
                      ? 'text-slate-400'
                      : scanTarget === 'sheet'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-slate-800'
                  }`}
                >
                  <span>2. Ler Folha de Gabarito</span>
                  {activePayload && (
                    <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded font-black">
                      Versão {activePayload.version}
                    </span>
                  )}
                </div>
                <div
                  className={`text-[10px] font-medium leading-tight mt-0.5 ${
                    !activePayload
                      ? 'text-slate-400'
                      : scanTarget === 'sheet'
                      ? 'text-slate-600'
                      : 'text-slate-500'
                  }`}
                >
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

          <div
            onClick={() => {
              if (!isProcessing && !(scanTarget === 'sheet' && !activePayload)) {
                if (fileInputRef.current) fileInputRef.current.value = '';
                fileInputRef.current?.click();
              }
            }}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition ${
              scanTarget === 'sheet' && !activePayload
                ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50'
                : isProcessing
                ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-500/10'
                : scanTarget === 'sheet'
                ? 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-500/10'
                : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-indigo-500/10'
            }`}
          >
            <div className="flex flex-col items-center justify-center">
              {scanTarget === 'qr' ? (
                <QrCode className="w-6 h-6 text-indigo-500 dark:text-indigo-400 mb-1.5" />
              ) : (
                <ImageIcon className="w-6 h-6 text-emerald-500 dark:text-emerald-400 mb-1.5" />
              )}
              <span className="text-xs font-semibold text-slate-700">
                {scanTarget === 'qr'
                  ? 'Selecionar foto do QR Code da prova'
                  : activePayload
                  ? `Selecionar foto da folha de respostas (Versão ${activePayload.version})`
                  : 'Trave uma versão antes de ler o gabarito'}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                {scanTarget === 'qr'
                  ? 'Busca estritamente o QR Code para destravar a versão com a senha'
                  : 'Busca estritamente os fiduciais e marcações das bolinhas'}
              </span>
            </div>
          </div>
        </div>

        {/* Mensagens de Sucesso e Erro */}
        {successMessage && (
          <div className="mt-4 p-3.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 font-bold" />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 p-3.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs text-rose-700 dark:text-rose-300 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
              <span className="font-medium">{errorMessage}</span>
            </div>
            {needsManualPassword && lastProcessedFileRef.current && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowManualPasswordModal(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-on-accent text-xs font-bold rounded-lg shadow-sm transition"
                >
                  Digitar senha manualmente
                </button>
              </div>
            )}
          </div>
        )}

        {isDebugAllowed && isDebugMode && errorDebugUrl && !debugResult && (
          <div className="keep-light-palette mt-4 p-4 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Bug className="w-4 h-4" /> Diagnóstico Visual da Imagem (Falha na Detecção)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadDebugImage}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar
                </button>
                <button
                  type="button"
                  onClick={() => setIsImageModalOpen(true)}
                  className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-on-accent rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Maximize2 className="w-3.5 h-3.5" /> Ampliar
                </button>
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

      <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1.5">
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="keep-light-palette bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h4 className="font-bold text-sm text-on-accent flex items-center gap-2">
                <Eye className="w-4 h-4 text-sky-400" /> Inspeção Visual de Alta Resolução do OMR
              </h4>
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-on-accent hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-black">
              <img
                src={debugResult?.debugCanvasUrl || errorDebugUrl || ''}
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
