import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ExamVersion, GradingRecord } from '../../types/exam';
import { DecryptedQrPayload } from '../../types/omr';
import { decryptAnswerKey } from '../../utils/crypto';
import { gradeCanvasWithPayload } from '../../utils/omrProcessor';
import { Camera, AlertTriangle, KeyRound, CheckCircle2, RefreshCw, QrCode } from 'lucide-react';

interface CameraScannerProps {
  teacherPassword: string;
  activePayload: DecryptedQrPayload | null;
  onLockPayload: (payload: DecryptedQrPayload) => void;
  onUnlockPayload: () => void;
  onGraded: (record: GradingRecord) => void;
  onRequestPasswordChange: () => void;
  availableVersions?: ExamVersion[];
  onSelectExamVersion?: (v: ExamVersion) => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({
  teacherPassword,
  activePayload,
  onLockPayload,
  onUnlockPayload,
  onGraded,
  onRequestPasswordChange,
  availableVersions = [],
  onSelectExamVersion,
}) => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>('Pronto para iniciar leitura');
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const qrReaderRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const isStartingRef = useRef<boolean>(false);
  const activePayloadRef = useRef<DecryptedQrPayload | null>(activePayload);

  useEffect(() => {
    activePayloadRef.current = activePayload;
  }, [activePayload]);

  const playSuccessBeep = () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch {
      // Ignora se o áudio não for permitido
    }
  };

  const cleanupScanner = async () => {
    if (qrReaderRef.current) {
      const instance = qrReaderRef.current;
      qrReaderRef.current = null;
      try {
        if (instance.isScanning) {
          await instance.stop();
        }
      } catch {
        // Ignora erro se não estava em execução
      }
      try {
        instance.clear();
      } catch {
        // Ignora erro de limpeza do DOM
      }
    }
  };

  const startScanner = async () => {
    if (isStartingRef.current || isScanning) {
      return;
    }
    isStartingRef.current = true;

    if (!teacherPassword || !teacherPassword.trim()) {
      onRequestPasswordChange();
      setErrorMessage('Por favor, informe a senha da prova antes de iniciar a câmera.');
      isStartingRef.current = false;
      return;
    }
    setErrorMessage(null);

    // Verificação de Contexto Seguro (HTTPS ou localhost)
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const isSecure = typeof window !== 'undefined' && (window.isSecureContext || isLocalhost);

    if (!isSecure) {
      setErrorMessage(
        'Acesso bloqueado por falta de HTTPS: Navegadores móveis (Chrome/Safari) impedem o acesso à câmera via conexões HTTP na rede local (ex: http://192.168.x.x). Para usar no celular, acesse via HTTPS ou utilize a opção "Upload de Foto" ao lado (que usa a câmera nativa do celular).'
      );
      isStartingRef.current = false;
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setErrorMessage(
        'A API de câmera (mediaDevices.getUserMedia) não está disponível neste navegador. Verifique se o site possui conexão HTTPS e permissões liberadas.'
      );
      isStartingRef.current = false;
      return;
    }

    setStatusText('Acessando câmera...');

    try {
      const qrConfig = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minDim = Math.min(viewfinderWidth, viewfinderHeight);
          return {
            width: Math.min(280, Math.floor(minDim * 0.75)),
            height: Math.min(280, Math.floor(minDim * 0.75)),
          };
        },
      };

      const handleDecoded = async (decodedText: string) => {
        // Na Etapa 2 (versão travada), não é necessário ler QR Code
        if (activePayloadRef.current) return;
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;
        setStatusText('QR Code lido! Decodificando gabarito...');

        try {
          const payload = await decryptAnswerKey(decodedText, teacherPassword);
          playSuccessBeep();
          onLockPayload(payload);
          setStatusText(`Versão ${payload.version} travada! Posicione a folha e clique em Capturar.`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Falha ao descriptografar QR Code';
          setErrorMessage(msg);
          setStatusText(`Erro: ${msg}`);
        } finally {
          setTimeout(() => {
            isProcessingRef.current = false;
          }, 1000);
        }
      };

      // Inicia uma nova instância limpa de Html5Qrcode garantindo que estados anteriores sejam descartados
      const tryStartCamera = async (cameraConfig: string | { facingMode: string }) => {
        await cleanupScanner();
        const instance = new Html5Qrcode('camera-scanner-view');
        qrReaderRef.current = instance;

        await instance.start(
          cameraConfig,
          qrConfig,
          handleDecoded,
          () => {}
        );
      };

      let started = false;
      let lastError: unknown = null;

      // Tentativa 1: Câmera traseira com restrição exata de 1 chave suportada pelo Html5Qrcode
      try {
        await tryStartCamera({ facingMode: 'environment' });
        started = true;
      } catch (err) {
        lastError = err;
      }

      // Tentativa 2: Seleção direta pelo ID de hardware da câmera traseira via getCameras()
      if (!started) {
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            const backCam =
              devices.find((d) => /back|rear|traseira|ambiente|environment/i.test(d.label)) ||
              devices[devices.length - 1];

            await tryStartCamera(backCam.id);
            started = true;
          }
        } catch (err) {
          lastError = err;
        }
      }

      // Tentativa 3: Qualquer câmera disponível (câmera frontal de contingência)
      if (!started) {
        try {
          await tryStartCamera({ facingMode: 'user' });
          started = true;
        } catch (err) {
          lastError = err;
          throw lastError;
        }
      }

      setIsScanning(true);
      if (activePayloadRef.current) {
        setStatusText(`Versão ${activePayloadRef.current.version} travada. Enquadre e clique em Capturar.`);
      } else {
        setStatusText('Etapa 1: Aproxime do QR Code da folha (10-20 cm)');
      }
    } catch (err: unknown) {
      let rawMsg = '';
      if (err instanceof Error) {
        rawMsg = err.message || err.name;
      } else if (typeof err === 'string') {
        rawMsg = err;
      } else if (err && typeof err === 'object' && 'message' in err) {
        rawMsg = String((err as { message: unknown }).message);
      } else {
        rawMsg = 'Erro desconhecido';
      }

      const lower = rawMsg.toLowerCase();
      let userMsg = `Não foi possível acessar a câmera: ${rawMsg}`;

      if (lower.includes('permission') || lower.includes('notallowed') || lower.includes('denied')) {
        userMsg = 'Permissão da câmera negada no navegador. Toque no ícone de opções/cadeado na barra de endereços do celular e permita o acesso à câmera.';
      } else if (lower.includes('notfound') || lower.includes('devicesnotfound')) {
        userMsg = 'Nenhuma câmera foi encontrada neste dispositivo.';
      } else if (lower.includes('notreadable') || lower.includes('trackstart') || lower.includes('in use')) {
        userMsg = 'A câmera pode estar sendo usada por outro aplicativo ou aba. Feche os outros aplicativos e tente novamente.';
      } else if (lower.includes('overconstrained')) {
        userMsg = 'A resolução da câmera não é suportada pelo aparelho. Tente a opção "Upload de Foto".';
      }

      setErrorMessage(userMsg);
      setIsScanning(false);
    } finally {
      isStartingRef.current = false;
    }
  };

  const handleCaptureFrame = () => {
    const payload = activePayloadRef.current;
    if (!payload) {
      setErrorMessage('Nenhuma versão travada. Aproxime a câmera do QR Code (Etapa 1) ou selecione a versão.');
      return;
    }
    if (isProcessingRef.current) return;

    isProcessingRef.current = true;
    setIsCapturing(true);
    setErrorMessage(null);

    try {
      const videoElem = document.querySelector('#camera-scanner-view video') as HTMLVideoElement;
      if (!videoElem || !videoElem.videoWidth || !videoElem.videoHeight) {
        throw new Error('Vídeo da câmera não está pronto para captura.');
      }

      const canvas = document.createElement('canvas');
      canvas.width = videoElem.videoWidth;
      canvas.height = videoElem.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Falha ao inicializar Canvas.');
      }
      ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);

      const record = gradeCanvasWithPayload(canvas, payload);
      playSuccessBeep();
      onGraded(record);
      setStatusText(`Folha corrigida (Nota: ${record.totalScore.toFixed(1)} pts). Posicione a próxima!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar folha de respostas.';
      setErrorMessage(msg);
      setStatusText(`Erro: ${msg}`);
    } finally {
      setIsCapturing(false);
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 500);
    }
  };

  // Atalho de teclado: barra de espaço para capturar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isScanning && activePayloadRef.current) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          handleCaptureFrame();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isScanning]);

  const stopScanner = async () => {
    await cleanupScanner();
    setIsScanning(false);
    isProcessingRef.current = false;
  };

  useEffect(() => {
    return () => {
      cleanupScanner();
    };
  }, []);

  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const isSecureOrigin = typeof window !== 'undefined' && (window.isSecureContext || isLocalhost);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
      <div>
        {!isSecureOrigin && (
          <div className="mb-4 p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <span className="font-bold text-amber-950">Aviso: Câmera bloqueada por falta de HTTPS</span>
              <p>
                Navegadores de celular (Chrome e Safari) desativam a câmera ao acessar via HTTP comum (<code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">{typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : ''}</code>).
              </p>
              <p>
                Para corrigir provas pelo celular sem configurar HTTPS, utilize a aba ao lado <strong>"Upload de Foto"</strong>, que aciona a câmera nativa do celular diretamente.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-base font-bold text-slate-800">Leitor Óptico via Câmera</h2>
              <span className="text-[11px] text-slate-500 font-medium">
                {activePayload
                  ? `Etapa 2: Correção da Folha (Versão ${activePayload.version})`
                  : 'Etapa 1: Travar Versão via QR Code ou Botão'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRequestPasswordChange}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-medium transition"
            >
              <KeyRound className="w-3.5 h-3.5" /> Senha: {teacherPassword ? '••••••' : 'Não definida'}
            </button>
          </div>
        </div>

        {/* Barra de Status da Versão / Seletor Rápido */}
        <div className="mb-4 p-3 rounded-xl border flex items-center justify-between flex-wrap gap-2 text-xs bg-slate-50 border-slate-200">
          {activePayload ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-emerald-600 text-white font-black rounded-lg flex items-center gap-1.5 shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5" /> VERSÃO {activePayload.version}
                </span>
                <span className="text-slate-600 font-medium">
                  Gabarito travado ({Object.keys(activePayload.key).length} obj.
                  {activePayload.subjectiveQuestions && activePayload.subjectiveQuestions.length > 0
                    ? ` • ${activePayload.subjectiveQuestions.length} diss.`
                    : ''}
                  )
                </span>
              </div>
              <button
                type="button"
                onClick={onUnlockPayload}
                className="flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-semibold px-2 py-1 rounded hover:bg-slate-200 transition"
              >
                <RefreshCw className="w-3 h-3" /> Trocar Versão
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full flex-wrap gap-2">
              <div className="flex items-center gap-2 text-slate-600">
                <QrCode className="w-4 h-4 text-indigo-600" />
                <span>Nenhuma versão travada. Aproxime a câmera do QR Code (Etapa 1) ou selecione:</span>
              </div>
              {availableVersions.length > 0 && onSelectExamVersion && (
                <div className="flex gap-1">
                  {availableVersions.map((v) => (
                    <button
                      key={v.versionLetter}
                      type="button"
                      onClick={() => onSelectExamVersion(v)}
                      className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-200 rounded font-bold transition"
                    >
                      {v.versionLetter}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Viewfinder da Câmera com Guias Visuais */}
        <div className="relative max-w-lg mx-auto bg-slate-950 rounded-2xl overflow-hidden min-h-[340px] flex flex-col items-center justify-center text-white">
          <div id="camera-scanner-view" className="w-full h-full" />

          {/* Desconectado */}
          {!isScanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/90 z-10">
              <Camera className="w-12 h-12 text-slate-400 mb-3" />
              <h3 className="font-semibold text-sm mb-1 text-slate-200">
                Câmera Desconectada
              </h3>
              <p className="text-xs text-slate-400 max-w-xs mb-4">
                {activePayload
                  ? `Versão ${activePayload.version} já selecionada! Inicie a câmera para posicionar as folhas dos alunos e corrigir.`
                  : 'Inicie a câmera para ler o QR Code de perto (Etapa 1) ou selecione a versão acima.'}
              </p>
              <button
                type="button"
                onClick={startScanner}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg transition"
              >
                <Camera className="w-4 h-4" />{' '}
                {activePayload ? `Iniciar Câmera (Versão ${activePayload.version})` : 'Iniciar Câmera'}
              </button>
            </div>
          )}

          {/* Guia de Enquadramento Etapa 1: QR Code Centralizado */}
          {isScanning && !activePayload && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 z-10">
              <div className="w-56 h-56 border-2 border-dashed border-indigo-400 rounded-2xl flex flex-col items-center justify-center bg-indigo-500/10 backdrop-blur-[1px]">
                <span className="text-[11px] font-bold text-white bg-black/75 px-3 py-1 rounded-full shadow text-center mx-2">
                  Etapa 1: Aproxime do QR Code (10-20 cm)
                </span>
              </div>
            </div>
          )}

          {/* Guia de Enquadramento Etapa 2: Folha Inteira */}
          {isScanning && activePayload && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 z-10">
              <div className="w-full max-w-[340px] h-full max-h-[250px] border-2 border-emerald-400/80 rounded-2xl flex flex-col items-center justify-start p-3 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                <span className="text-[11px] font-bold text-white bg-black/80 px-3 py-1 rounded-full shadow flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Enquadre a Folha (Versão {activePayload.version})
                </span>
              </div>
            </div>
          )}

          {/* Barra de Status e Parar */}
          {isScanning && (
            <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between bg-black/70 backdrop-blur-md px-4 py-2 rounded-xl text-xs">
              <span className="truncate pr-2 font-mono text-emerald-400">{statusText}</span>
              <button
                type="button"
                onClick={stopScanner}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shrink-0"
              >
                Parar
              </button>
            </div>
          )}
        </div>

        {/* Botão de Captura para Etapa 2 */}
        {isScanning && activePayload && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleCaptureFrame}
              disabled={isCapturing}
              className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-extrabold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Camera className="w-5 h-5" />
              <span>
                {isCapturing ? 'Processando e Corrigindo...' : `Capturar e Corrigir Folha (Versão ${activePayload.version})`}
              </span>
            </button>
            <span className="text-[11px] text-slate-500">
              Dica: você também pode pressionar a <strong>Barra de Espaço</strong> para capturar instantaneamente.
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700">Fluxo em 2 Passos para Papel Impresso:</p>
        <p>• <strong>Passo 1 (Travar Versão):</strong> Aproxime a câmera do QR Code no topo da folha para destravar a versão (ou escolha o botão acima).</p>
        <p>• <strong>Passo 2 (Corrigir Alunos):</strong> Afaste a câmera para enquadrar a folha sobre a mesa e clique no botão verde de captura.</p>
        <p>• <strong>Correção em Lote:</strong> A versão permanece travada para que você corrija as próximas provas do mesmo grupo sem reler o QR Code.</p>
      </div>
    </div>
  );
};
