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
  Users,
  Smartphone,
  QrCode,
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

interface ScannerScreenProps {
  onNavigate: (route: Route) => void;
}

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

  const isPreviewModeFromUrl =
    typeof window !== 'undefined' &&
    (window.location.search.includes('preview=1') ||
      window.location.search.includes('corretor=1') ||
      window.location.hash.includes('preview=1') ||
      window.location.hash.includes('corretor=1'));

  const [forceBrowserScanner, setForceBrowserScanner] = useState<boolean>(isPreviewModeFromUrl);
  const isDesktopUI = Boolean(__DESKTOP__ || forceBrowserScanner);

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
    setIsStartingRemote(true);
    try {
      if (__DESKTOP__) {
        const s = await startRemoteCamera(ip);
        setRemoteSession(s);
      } else {
        // Modo preview no navegador (permite interagir e tirar screenshots da Câmera Remota no Firefox/Chrome)
        const mockSession: RemoteSessionInfo = {
          url: `http://${ip || '192.168.1.105'}:47831/#token=EXEMPLO1`,
          ip: ip || '192.168.1.105',
          port: 47831,
          token: 'EXEMPLO1',
          interfaces: [
            { name: 'wlan0 (Wi-Fi Local)', ip: '192.168.1.105' },
            { name: 'eth0 (Rede Cabeada)', ip: '192.168.1.50' },
          ],
        };
        setRemoteSession(mockSession);
        setAvailableInterfaces(mockSession.interfaces);
      }
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
    setIsStartingRemote(true);
    try {
      if (__DESKTOP__) {
        const s = await startRemoteCamera(ip);
        setRemoteSession(s);
      } else {
        setRemoteSession((prev) =>
          prev
            ? {
                ...prev,
                ip,
                url: `http://${ip}:${prev.port}/#token=${prev.token}`,
              }
            : null
        );
      }
    } finally {
      setIsStartingRemote(false);
    }
  };

  const handleOpenRemoteCamera = () => {
    setRemotePanelOpen(true);
    if (!remoteSession) {
      handleStartRemote();
    }
  };

  const activeClassName = activeClassId
    ? classes.find((c) => c.id === activeClassId)?.name || 'Sem turma fixa'
    : 'Sem turma fixa';

  const isAutonomous = !activeExamId || !exam.id;
  const examTitle = exam.header?.examTitle || 'Sem título';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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
            {/* Faixa fixa / Banner de Contexto do Corretor (Plano 10 §2.6) */}
            <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-on-accent shrink-0">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                    <span>Corrigindo:</span>
                    <span className="font-extrabold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" /> {isAutonomous ? 'Modo Autônomo (Auto QR)' : examTitle}
                    </span>
                    <span>·</span>
                    <span className="text-slate-700 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" /> {activeClassName}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 block">
                    {isAutonomous
                      ? 'Identificação automática de prova, versão e gabarito via QR Code em cada folha.'
                      : 'As leituras registradas serão computadas para esta avaliação.'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={handleOpenRemoteCamera}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition ${
                    remoteSession
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-on-accent border-indigo-700 shadow-xs'
                  }`}
                  title="Parear câmera do celular para fotografar provas"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  {remoteSession ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Celular Conectado
                    </span>
                  ) : (
                    'Câmera do Celular'
                  )}
                </button>
                {isAutonomous ? (
                  <button
                    type="button"
                    onClick={() => onNavigate({ type: 'exams' })}
                    className="px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:underline bg-white rounded-lg border border-indigo-200 dark:border-indigo-500/30"
                  >
                    Vincular a uma Prova
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => selectActiveExam(null)}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:underline bg-white rounded-lg border border-slate-200"
                      title="Ativar modo autônomo sem prova fixa"
                    >
                      Modo Autônomo
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate({ type: 'exams' })}
                      className="px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:underline bg-white rounded-lg border border-indigo-200 dark:border-indigo-500/30"
                    >
                      Trocar Prova
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => onNavigate({ type: 'classes' })}
                  className="px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:underline bg-white rounded-lg border border-indigo-200 dark:border-indigo-500/30"
                >
                  Trocar Turma
                </button>
              </div>
            </div>

            {/* Banner de Acesso Rápido: Usar Celular como Câmera Sem Fio (Plano 13) */}
            <div className="bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 dark:from-indigo-950/20 dark:via-sky-950/20 dark:to-emerald-950/20 border border-indigo-200/80 dark:border-indigo-500/30 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-on-accent shrink-0 shadow-xs">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-800">
                      Usar Celular como Câmera Sem Fio
                    </h3>
                    {remoteSession ? (
                      <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Servidor Ativo (porta {remoteSession.port})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300">
                        Wi-Fi Local
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                    Fotografe gabaritos diretamente com a câmera do seu smartphone. As fotos são transferidas e corrigidas instantaneamente na sua tela pelo Wi-Fi, sem instalar nenhum aplicativo no celular.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenRemoteCamera}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-on-accent shadow-xs flex items-center gap-2 shrink-0 transition cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                {remoteSession ? 'Ver QR Code / Conexão' : 'Conectar Celular via QR Code'}
              </button>
            </div>

            {/* Banner de Operação Autônoma e Senha da Prova */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">
                      Corretor Óptico em 2 Passos
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 max-w-2xl leading-relaxed">
                      O gabarito oficial está criptografado no QR Code de cada folha. Para correção em papel físico, use o fluxo em 2 passos: primeiro trave a versão (lendo o QR Code de perto ou selecionando-o abaixo), depois enquadre a folha e corrija em lote.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-amber-50/60 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 rounded-xl p-2.5 w-full sm:w-auto">
                  <KeyRound className="w-4 h-4 text-amber-700 dark:text-amber-300 shrink-0" />
                  <div>
                    <label className="block text-[10px] font-bold text-amber-900 dark:text-amber-200 uppercase">
                      {isAutonomous ? 'Senha para Leitura dos QR Codes:' : 'Senha Mestra desta Prova:'}
                    </label>
                    <div className="relative flex items-center mt-0.5">
                      <input
                        type={showTeacherPassword ? 'text' : 'password'}
                        placeholder={isAutonomous ? 'Senha da prova ou perfil' : 'Senha da prova'}
                        value={teacherPassword}
                        onChange={(e) => updateTeacherPassword(e.target.value)}
                        className="px-2.5 pr-8 py-1 text-xs border border-amber-300 dark:border-amber-500/40 rounded font-mono font-bold bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 w-full sm:w-44"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTeacherPassword((prev) => !prev)}
                        className="absolute right-1 text-slate-400 hover:text-slate-600 p-1"
                        title={showTeacherPassword ? 'Ocultar senha' : 'Exibir senha'}
                        aria-label={showTeacherPassword ? 'Ocultar senha' : 'Exibir senha'}
                      >
                        {showTeacherPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seletor / Status da Versão Travada */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Versão Travada para Correção:</span>
                  {activePayload ? (
                    <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs rounded-lg flex items-center gap-1.5 border border-emerald-300 dark:border-emerald-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" /> VERSÃO {activePayload.version}
                      {activePayload.examId && (
                        <span className="text-[10px] font-mono opacity-80">
                          ({activePayload.examId.slice(0, 8)})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 font-medium text-xs rounded-lg">
                      {isAutonomous
                        ? 'Auto-identificação (lendo QR Code de cada folha)'
                        : 'Nenhuma (Selecione abaixo ou tire foto com QR Code)'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {versions.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 font-medium">Travar:</span>
                      {versions.map((v, idx) => (
                        <button
                          key={v?.versionLetter || idx}
                          type="button"
                          onClick={() => handleSelectExamVersion(v)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                            activePayload?.version === v?.versionLetter
                              ? 'bg-emerald-600 text-on-accent shadow-sm'
                              : 'bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-600 hover:text-on-accent text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30'
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
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-slate-100 rounded-lg transition"
                    >
                      <RefreshCw className="w-3 h-3" /> Destravar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Seletor de Turma Ativa para Correção */}
            <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Turma Ativa para Correção:
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Notas corrigidas serão vinculadas automaticamente a esta turma.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {classes.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => onNavigate({ type: 'classes' })}
                    className="px-3 py-1.5 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 rounded-lg transition"
                  >
                    + Criar Primeira Turma
                  </button>
                ) : (
                  <>
                    <select
                      value={activeClassId || ''}
                      onChange={(e) => setActiveClassId(e.target.value || null)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">Sem turma fixa (escolher na folha)</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.students?.length ?? 0} alunos)
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => onNavigate({ type: 'classes' })}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                    >
                      Gerenciar Turmas
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Seletor de Modo: Individual vs Em Lote */}
            <div className="flex items-center justify-center">
              <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setScannerMode('single')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition ${
                    scannerMode === 'single'
                      ? 'bg-white text-indigo-700 dark:text-indigo-300 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  Foto Individual
                </button>
                <button
                  type="button"
                  onClick={() => setScannerMode('batch')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition ${
                    scannerMode === 'batch'
                      ? 'bg-white text-indigo-700 dark:text-indigo-300 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Files className="w-4 h-4" />
                  Em Lote
                </button>
              </div>
            </div>

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

            {isDesktopUI && (
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
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto my-6 sm:my-10 space-y-8 animate-in fade-in duration-200">
            {/* Cartão Principal de Apresentação e Download */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-10 text-center relative overflow-hidden">
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

              {/* Botões de Ação: Baixar Release, Continuar na Web e Preview */}
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

                <button
                  type="button"
                  onClick={() => setForceBrowserScanner(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-indigo-300 dark:border-indigo-500/30 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-sm font-semibold transition shadow-2xs"
                >
                  <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Abrir Corretor no Navegador (Preview)</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate({ type: 'exams' })}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition"
                >
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span>Continuar na Versão Web</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-600 mt-3">
                Binários disponíveis para <strong>Linux (.deb, .AppImage, .rpm)</strong> e <strong>Windows (.exe, .msi)</strong>.
              </p>
            </div>

            {/* Grid de Benefícios do Aplicativo Desktop */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300 mb-3">
                  <Camera className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Processamento OpenCV
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Correção óptica sub-milimétrica com correção de inclinação e perspectiva mesmo em fotos tiradas com iluminação imperfeita.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-300 mb-3">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Câmera Sem Fio
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Conecte seu smartphone via Wi-Fi local escaneando um QR Code. Tire fotos das provas no celular e receba a nota instantaneamente no computador.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-300 mb-3">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Segurança AES-256
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  O gabarito oficial viaja criptografado dentro do próprio cartão-resposta. Nenhum banco de dados remoto ou conexão à internet é exigida.
                </p>
              </div>
            </div>

            {/* Aviso de Compatibilidade Total Web <-> Desktop */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 text-xs text-slate-600 leading-relaxed flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-300 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-800">100% de Compatibilidade entre Web e Desktop:</strong> Você pode elaborar avaliações, formatar equações em LaTeX, embaralhar versões e imprimir cadernos e folhas A4 diretamente pelo navegador. Todos os dados e turmas podem ser exportados como arquivo de perfil (.zip) e abertos sem perdas no aplicativo desktop.
              </div>
            </div>
          </div>
        )}
      </ErrorBoundary>
    </div>
  );
};

