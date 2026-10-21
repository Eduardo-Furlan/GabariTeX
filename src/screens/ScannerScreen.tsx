import React, { useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  RefreshCw,
  Camera,
  Files,
  GraduationCap,
  Monitor,
  FileText,
  Smartphone,
} from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PhotoUploader } from '../components/scanner/PhotoUploader';
import { BatchGrader } from '../components/scanner/BatchGrader';
import { RemoteCameraPanel } from '../components/scanner/RemoteCameraPanel';
import {
  RemoteSessionInfo,
  NetworkInterfaceInfo,
  startRemoteCamera,
  stopRemoteCamera,
  getRemoteCameraStatus,
  getNetworkInterfaces,
  listenRemotePhotos,
  listenRemoteStopped,
  takeRemotePhoto,
  getRemotePendingPhotos,
} from '../platform/remoteCamera';
import { Route } from '../router/hashRouter';
import { Surface } from '../components/ui/Surface';
import { Button } from '../components/ui/Button';
import { Segmented } from '../components/ui/Segmented';
import { Select } from '../components/ui/Select';

interface ScannerScreenProps {
  onNavigate: (route: Route) => void;
}

const SCANNER_MODE_OPTIONS = [
  { value: 'single', label: 'Foto Individual', icon: <Camera className="w-4 h-4" /> },
  { value: 'batch', label: 'Em Lote', icon: <Files className="w-4 h-4" /> },
];

export const ScannerScreen: React.FC<ScannerScreenProps> = ({ onNavigate }) => {
  const {
    exam,
    activeExamId,
    versions,
    teacherPassword,
    updateTeacherPassword,
    candidatePasswords,
    activePayload,
    setActivePayload,
    handleLockPayload,
    handlePhotoGraded,
    handleBatchSaveRecords,
    handleSelectExamVersion,
    scannerMode,
    setScannerMode,
    setIsBatchProcessing,
    classes,
    activeClassId,
    setActiveClassId,
    records,
    handleAddStudentToClass,
    selectActiveExam,
  } = useProfile();

  const [showTeacherPassword, setShowTeacherPassword] = useState<boolean>(false);

  const isDesktopUI = Boolean(__DESKTOP__);

  // Estado e controle da Câmera Remota Desktop (Plano 13)
  const [remotePanelOpen, setRemotePanelOpen] = useState<boolean>(false);
  const [remoteSession, setRemoteSession] = useState<RemoteSessionInfo | null>(null);
  const [isStartingRemote, setIsStartingRemote] = useState<boolean>(false);
  const [remoteReceivedCount, setRemoteReceivedCount] = useState<number>(0);
  const [availableInterfaces, setAvailableInterfaces] = useState<NetworkInterfaceInfo[]>([]);
  const [incomingRemotePhoto, setIncomingRemotePhoto] = useState<{
    file: File;
    id: string;
    target?: 'qr' | 'sheet';
    timestamp: number;
  } | null>(null);
  const processedRemoteIdsRef = React.useRef<Set<string>>(new Set());

  const handleProcessRemotePhoto = React.useCallback(
    async (id: string, mime: string, target?: 'qr' | 'sheet') => {
      if (processedRemoteIdsRef.current.has(id)) return;
      processedRemoteIdsRef.current.add(id);

      const bytes = await takeRemotePhoto(id);
      if (!bytes || bytes.length === 0) return;

      const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      const file = new File(
        [bytes as BlobPart],
        `celular-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`,
        { type: mime || 'image/jpeg', lastModified: Date.now() }
      );

      setRemoteReceivedCount((c) => c + 1);
      setIncomingRemotePhoto({ file, id, target, timestamp: Date.now() });
    },
    []
  );

  React.useEffect(() => {
    if (typeof __DESKTOP__ === 'undefined' || !__DESKTOP__) return;
    getRemoteCameraStatus().then((s) => {
      if (s) setRemoteSession(s);
    });
    getNetworkInterfaces().then((list) => {
      setAvailableInterfaces(list);
    });

    let unlistenStopped: (() => void) | undefined;
    listenRemoteStopped(() => {
      setRemoteSession(null);
    }).then((un) => {
      unlistenStopped = un;
    });

    let unlistenPhotos: (() => void) | undefined;
    listenRemotePhotos((file, id, target) => {
      if (processedRemoteIdsRef.current.has(id)) return;
      processedRemoteIdsRef.current.add(id);
      setRemoteReceivedCount((c) => c + 1);
      setIncomingRemotePhoto({ file, id, target, timestamp: Date.now() });
    }).then((un) => {
      unlistenPhotos = un;
    });

    // Polling de redundância para garantir recebimento mesmo se o evento do Tauri for suprimido
    const pollInterval = setInterval(async () => {
      try {
        const pending = await getRemotePendingPhotos();
        for (const p of pending) {
          if (!processedRemoteIdsRef.current.has(p.id)) {
            await handleProcessRemotePhoto(
              p.id,
              p.mime,
              p.target === 'sheet' ? 'sheet' : 'qr'
            );
          }
        }
      } catch {
        // Ignora erros transitórios
      }
    }, 1500);

    return () => {
      if (unlistenStopped) unlistenStopped();
      if (unlistenPhotos) unlistenPhotos();
      clearInterval(pollInterval);
    };
  }, [handleProcessRemotePhoto]);

  const handleStartRemote = async (ip?: string) => {
    if (!__DESKTOP__) return;
    setIsStartingRemote(true);
    try {
      const s = await startRemoteCamera(ip);
      setRemoteSession(s);
    } finally {
      setIsStartingRemote(false);
    }
  };

  const handleStopRemote = async () => {
    if (__DESKTOP__) {
      await stopRemoteCamera();
    }
    setRemoteSession(null);
  };

  const handleChangeRemoteInterface = async (ip: string) => {
    if (!__DESKTOP__) return;
    setIsStartingRemote(true);
    try {
      const s = await startRemoteCamera(ip);
      setRemoteSession(s);
    } finally {
      setIsStartingRemote(false);
    }
  };

  const handleOpenRemoteCamera = () => {
    setRemotePanelOpen(true);
    if (!remoteSession && isDesktopUI) {
      handleStartRemote();
    }
  };

  const activeClassName = activeClassId
    ? classes.find((c) => c.id === activeClassId)?.name || 'Sem turma fixa'
    : 'Sem turma fixa';

  const isAutonomous = !activeExamId || !exam.id;
  const examTitle = exam.header?.examTitle || 'Sem título';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 screen-enter">
      <ErrorBoundary
        fallbackTitle="Erro ao carregar o Corretor Óptico (OMR)"
        onReset={() => {
          if (activeExamId) {
            onNavigate({ type: 'exam_step', examId: activeExamId, step: 'criar' });
          } else {
            onNavigate({ type: 'exams' });
          }
        }}
      >
        {isDesktopUI ? (
          <div className="space-y-6">
            {/* Painel Unificado: Sessão de Correção */}
            <Surface className="p-4 sm:p-5 space-y-4">
              {/* Header: Título + Senha */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-title font-display font-bold text-slate-900 leading-tight">
                    Sessão de Correção · Corretor Óptico em 2 Passos
                  </h2>
                  <span className="text-meta text-slate-500">
                    {isAutonomous
                      ? 'Identificação automática de prova, versão e gabarito via QR Code em cada folha.'
                      : 'As leituras registradas serão computadas para esta avaliação.'}
                  </span>
                </div>
              </div>

              {/* Senha mestra / de leitura */}
              <div className="flex items-center gap-2 bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-2 shrink-0">
                <KeyRound className="w-4 h-4 text-amber-700 dark:text-amber-300 shrink-0" />
                <div className="flex items-center gap-1.5">
                  <label className="text-meta font-bold text-amber-900 dark:text-amber-200 hidden sm:inline">
                    {isAutonomous ? 'Senha QR:' : 'Senha:'}
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showTeacherPassword ? 'text' : 'password'}
                      placeholder="Senha da prova"
                      value={teacherPassword}
                      onChange={(e) => updateTeacherPassword(e.target.value)}
                      className="px-2 pr-7 py-1 text-meta border border-amber-300 dark:border-amber-500/40 rounded font-mono font-bold bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 w-32 sm:w-36"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTeacherPassword((prev) => !prev)}
                      className="absolute right-1 text-slate-400 hover:text-slate-600 p-0.5"
                      title={showTeacherPassword ? 'Ocultar senha' : 'Exibir senha'}
                      aria-label={showTeacherPassword ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      {showTeacherPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Linha 1: Context Chips (Prova / Turma / Versão Travada) */}
            <div className="flex items-center justify-between flex-wrap gap-2.5 pt-1 text-meta">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Prova Context Chip */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 font-semibold text-slate-800">
                  <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="font-bold text-slate-900 truncate max-w-[200px]" title={examTitle}>
                    {isAutonomous ? 'Modo Autônomo' : examTitle}
                  </span>
                  {isAutonomous ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNavigate({ type: 'exams' })}
                      className="h-6 px-1.5 text-meta text-indigo-700"
                    >
                      Vincular
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => selectActiveExam(null)}
                        className="h-6 px-1.5 text-meta text-slate-600"
                        title="Ativar modo autônomo sem prova fixa"
                      >
                        Autônomo
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onNavigate({ type: 'exams' })}
                        className="h-6 px-1.5 text-meta text-indigo-700"
                      >
                        Trocar
                      </Button>
                    </>
                  )}
                </div>

                {/* Turma Context Chip */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 font-semibold text-slate-800">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  {classes.length === 0 ? (
                    <>
                      <span>{activeClassName}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onNavigate({ type: 'classes' })}
                        className="h-6 px-1.5 text-meta text-indigo-700"
                      >
                        + Criar
                      </Button>
                    </>
                  ) : (
                    <Select
                      variant="inline"
                      value={activeClassId || ''}
                      onChange={(val) => setActiveClassId(val || null)}
                      options={[
                        { value: '', label: 'Sem turma fixa' },
                        ...classes.map((c) => ({ value: c.id, label: c.name })),
                      ]}
                      size="sm"
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigate({ type: 'classes' })}
                    className="h-6 px-1.5 text-meta text-slate-600"
                  >
                    Gerenciar
                  </Button>
                </div>

                {/* Versão Travada Context Chip */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 font-semibold text-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  {activePayload ? (
                    <span className="flex items-center gap-1 text-emerald-800 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Versão {activePayload.version}
                    </span>
                  ) : (
                    <span className="text-slate-600">Versão: Auto QR</span>
                  )}

                  {versions.length > 0 && (
                    <div className="flex items-center gap-1 ml-1">
                      {versions.map((v, idx) => (
                        <button
                          key={v?.versionLetter || idx}
                          type="button"
                          onClick={() => handleSelectExamVersion(v)}
                          className={`w-5 h-5 rounded text-[10px] font-bold transition flex items-center justify-center ${
                            activePayload?.version === v?.versionLetter
                              ? 'bg-emerald-600 text-on-accent'
                              : 'bg-white border border-slate-200 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/15'
                          }`}
                        >
                          {v?.versionLetter || '?'}
                        </button>
                      ))}
                    </div>
                  )}

                  {activePayload && (
                    <button
                      type="button"
                      onClick={() => setActivePayload(null)}
                      className="text-meta text-slate-500 hover:text-rose-600 ml-1 flex items-center gap-0.5"
                      title="Destravar versão para auto-detecção"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Linha 2: Modo Segmented + Status Câmera Remota */}
            <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-slate-100">
              <div className="w-full sm:w-auto">
                <Segmented
                  options={SCANNER_MODE_OPTIONS}
                  value={scannerMode}
                  onChange={(val) => setScannerMode(val as 'single' | 'batch')}
                  layoutId="scanner-mode-pill"
                />
              </div>

              {/* Status da Câmera do Celular com pulse ring */}
              <div className="flex items-center gap-2">
                {remoteSession ? (
                  <button
                    type="button"
                    onClick={handleOpenRemoteCamera}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-meta font-bold transition hover:bg-emerald-100 dark:hover:bg-emerald-500/20 cursor-pointer"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
                    </span>
                    <Smartphone className="w-4 h-4" />
                    <span>Celular Conectado (porta {remoteSession.port})</span>
                  </button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleOpenRemoteCamera}
                    icon={<Smartphone className="w-4 h-4 text-slate-500" />}
                    title="Parear câmera do celular para fotografar provas"
                  >
                    Câmera do Celular
                  </Button>
                )}
              </div>
            </div>
          </Surface>

          {/* Área Principal de Correção: Individual ou Em Lote */}
          <div className="max-w-4xl mx-auto">
            {scannerMode === 'single' ? (
              <PhotoUploader
                teacherPassword={teacherPassword}
                candidatePasswords={candidatePasswords}
                activePayload={activePayload}
                onLockPayload={handleLockPayload}
                onGraded={handlePhotoGraded}
                availableVersions={versions}
                onSelectExamVersion={handleSelectExamVersion}
                onOpenRemoteCamera={handleOpenRemoteCamera}
                isRemoteConnected={Boolean(remoteSession)}
                incomingRemotePhoto={incomingRemotePhoto}
              />
            ) : (
              <BatchGrader
                teacherPassword={teacherPassword}
                candidatePasswords={candidatePasswords}
                activePayload={activePayload}
                availableVersions={versions}
                onSaveRecords={handleBatchSaveRecords}
                onLockPayload={handleLockPayload}
                classes={classes}
                activeClassId={activeClassId}
                onSelectActiveClass={setActiveClassId}
                records={records}
                onOpenClassManager={() => onNavigate({ type: 'classes' })}
                onAddStudentToClass={handleAddStudentToClass}
                onOpenRemoteCamera={handleOpenRemoteCamera}
                onRunningChange={setIsBatchProcessing}
                incomingRemotePhoto={incomingRemotePhoto}
                remoteReceivedCount={remoteReceivedCount}
              />
            )}
          </div>

          {/* Modal da Câmera Remota */}
          <RemoteCameraPanel
            isOpen={remotePanelOpen}
            onClose={() => setRemotePanelOpen(false)}
            session={remoteSession}
            isStarting={isStartingRemote}
            receivedCount={remoteReceivedCount}
            availableInterfaces={availableInterfaces}
            onStart={handleStartRemote}
            onStop={handleStopRemote}
            onChangeInterface={handleChangeRemoteInterface}
          />
        </div>
      ) : (
        <div className="max-w-3xl mx-auto my-6 sm:my-10 space-y-8">
          {/* Cartão Principal de Apresentação e Download */}
          <Surface className="p-6 sm:p-10 text-center relative overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300 mx-auto mb-4 shadow-2xs">
              <Monitor className="w-8 h-8" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider mb-3">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" />
              Disponível para Download no GitHub
            </div>

            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Corretor Óptico (OMR) no GabariTeX Desktop
            </h2>

            <p className="text-sm text-slate-600 mt-3 leading-relaxed max-w-xl mx-auto">
              Para alcançar leitura óptica de alta precisão com processamento em tempo real, detecção por marcadores fiduciais e calibração de perspectiva via <strong>OpenCV nativo</strong>, o corretor automatizado é executado pelo aplicativo desktop oficial.
            </p>

            {/* Botões de Ação: Baixar Release e Continuar na Web */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="https://github.com/Eduardo-Furlan/GabariTeX/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-on-accent text-sm font-bold shadow-md hover:shadow-lg transition-all"
              >
                <Monitor className="w-4 h-4" />
                <span>Baixar GabariTeX Desktop (GitHub Releases)</span>
              </a>

              <Button
                variant="secondary"
                onClick={() => onNavigate({ type: 'exams' })}
                className="w-full sm:w-auto px-5 py-3 rounded-xl text-sm font-semibold"
              >
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Continuar na Versão Web</span>
              </Button>
            </div>

            <p className="text-[11px] text-slate-600 mt-3">
              Binários disponíveis para <strong>Linux (.deb, .AppImage, .rpm)</strong> e <strong>Windows (.exe, .msi)</strong>.
            </p>
          </Surface>

          {/* Grid de Benefícios do Aplicativo Desktop */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Surface className="p-5 shadow-2xs">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300 mb-3">
                <Camera className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Processamento OpenCV
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Correção óptica sub-milimétrica com correção de inclinação e perspectiva mesmo em fotos tiradas com iluminação imperfeita.
              </p>
            </Surface>

            <Surface className="p-5 shadow-2xs">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-300 mb-3">
                <Smartphone className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Câmera Sem Fio
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Conecte seu smartphone via Wi-Fi local escaneando um QR Code. Tire fotos das provas no celular e receba a nota instantaneamente no computador.
              </p>
            </Surface>

            <Surface className="p-5 shadow-2xs">
              <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-300 mb-3">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Segurança AES-256
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                O gabarito oficial viaja criptografado dentro do próprio cartão-resposta. Nenhum banco de dados remoto ou conexão à internet é exigida.
              </p>
            </Surface>
          </div>

          {/* Aviso de Compatibilidade Total Web <-> Desktop */}
          <Surface tone="inset" className="p-4 sm:p-5 text-xs text-slate-600 leading-relaxed flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-300 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800">100% de Compatibilidade entre Web e Desktop:</strong> Você pode elaborar avaliações, formatar equações em LaTeX, embaralhar versões e imprimir cadernos e folhas A4 diretamente pelo navegador. Todos os dados e turmas podem ser exportados como arquivo de perfil (.zip) e abertos sem perdas no aplicativo desktop.
            </div>
          </Surface>
        </div>
      )}
      </ErrorBoundary>
    </div>
  );
};
