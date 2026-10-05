import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { GradedAnswer, GradingRecord } from '../../types/exam';
import { decryptAnswerKey } from '../../utils/crypto';
import { analyzeCanvasOmr, getStandardBubbleCoordinates } from '../../utils/omrProcessor';
import { Camera, AlertTriangle, KeyRound } from 'lucide-react';

interface CameraScannerProps {
  teacherPassword: string;
  onGraded: (record: GradingRecord) => void;
  onRequestPasswordChange: () => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({
  teacherPassword,
  onGraded,
  onRequestPasswordChange,
}) => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>('Pronto para iniciar leitura');
  const qrReaderRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  const playSuccessBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

  const startScanner = async () => {
    if (!teacherPassword || !teacherPassword.trim()) {
      onRequestPasswordChange();
      setErrorMessage('Por favor, informe a senha da prova antes de iniciar a câmera.');
      return;
    }
    setErrorMessage(null);
    setStatusText('Acessando câmera...');
    try {
      const html5QrCode = new Html5Qrcode('camera-scanner-view');
      qrReaderRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 280, height: 280 },
        },
        async (decodedText) => {
          if (isProcessingRef.current) return;
          isProcessingRef.current = true;
          setStatusText('QR Code detectado! Descriptografando e corrigindo...');

          try {
            // 1. Descriptografa com a senha do professor
            const payload = await decryptAnswerKey(decodedText, teacherPassword);

            // 2. Captura frame de vídeo para Canvas para análise OMR das bolinhas
            const videoElem = document.querySelector('#camera-scanner-view video') as HTMLVideoElement;
            const canvas = document.createElement('canvas');
            if (videoElem && videoElem.videoWidth) {
              canvas.width = videoElem.videoWidth;
              canvas.height = videoElem.videoHeight;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);
              }
            }

            // 3. Obtém coordenadas padrão das bolinhas
            const objectiveCount = Object.keys(payload.key).length;
            const bubbles = getStandardBubbleCoordinates({
              totalQuestions: objectiveCount,
              optionsPerQuestion: 5,
              columnsCount: objectiveCount <= 10 ? 1 : 2,
            });

            // 4. Executa amostragem OMR
            const omrDetections = analyzeCanvasOmr(canvas, bubbles);

            // 5. Calcula nota comparando com o gabarito oficial da versão
            let totalPoints = 0;
            let maxPoints = 0;
            const answers: GradedAnswer[] = [];

            for (let i = 1; i <= objectiveCount; i++) {
              const correctOpt = payload.key[i] || 'A';
              const qPoint = payload.points?.[i] ?? 1.0;
              maxPoints += qPoint;

              const detected = omrDetections.find((d) => d.questionNumber === i);
              const marked = detected?.detectedMark || null;
              const isCorrect = marked === correctOpt;
              const pointsEarned = isCorrect ? qPoint : 0;
              totalPoints += pointsEarned;

              answers.push({
                questionNumber: i,
                markedOption: marked,
                correctOption: correctOpt,
                isCorrect,
                status:
                  detected?.status === 'multiple'
                    ? 'multiple'
                    : marked === null
                    ? 'blank'
                    : isCorrect
                    ? 'correct'
                    : 'wrong',
                pointsEarned,
                maxPoints: qPoint,
              });
            }

            const percentage = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0;

            const record: GradingRecord = {
              id: `rec-${Date.now()}`,
              timestamp: Date.now(),
              studentName: '',
              studentId: '',
              versionLetter: payload.version,
              totalScore: totalPoints,
              maxScore: maxPoints,
              percentage,
              answers,
            };

            playSuccessBeep();
            stopScanner();
            onGraded(record);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Falha na leitura';
            setErrorMessage(msg);
            setStatusText(`Erro: ${msg}`);
            setTimeout(() => {
              isProcessingRef.current = false;
            }, 2500);
          }
        },
        () => {
          // Callback de frame intermediário sem QR code
        }
      );

      setIsScanning(true);
      setStatusText('Aponte a câmera para o QR Code e o gabarito');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível acessar a câmera.';
      setErrorMessage(msg);
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (qrReaderRef.current && isScanning) {
      try {
        await qrReaderRef.current.stop();
        qrReaderRef.current.clear();
      } catch {
        // Ignora erro de parada
      }
      qrReaderRef.current = null;
      setIsScanning(false);
      isProcessingRef.current = false;
    }
  };

  useEffect(() => {
    return () => {
      if (qrReaderRef.current) {
        qrReaderRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-800">Leitor Óptico via Câmera</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRequestPasswordChange}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-medium transition"
          >
            <KeyRound className="w-3.5 h-3.5" /> Senha Atual: {teacherPassword ? '••••••' : 'Não definida'}
          </button>
        </div>
      </div>

      <div className="relative max-w-lg mx-auto bg-slate-950 rounded-2xl overflow-hidden min-h-[340px] flex flex-col items-center justify-center text-white">
        <div id="camera-scanner-view" className="w-full h-full" />

        {!isScanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/90 z-10">
            <Camera className="w-12 h-12 text-slate-400 mb-3" />
            <h3 className="font-semibold text-sm mb-1 text-slate-200">
              Câmera Desconectada
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mb-4">
              Clique no botão abaixo para abrir a câmera do celular ou notebook e iniciar a correção em tempo real.
            </p>
            <button
              type="button"
              onClick={startScanner}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg transition"
            >
              <Camera className="w-4 h-4" /> Iniciar Câmera
            </button>
          </div>
        )}

        {isScanning && (
          <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl text-xs">
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

      {errorMessage && (
        <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700">Dicas para leitura perfeita:</p>
        <p>• Mantenha o papel plano sobre a mesa e sob boa iluminação.</p>
        <p>• Aponte a câmera de modo que o QR Code e as bolinhas fiquem nítidos na tela.</p>
        <p>• O sistema lê o QR Code, decifra o gabarito com sua senha e pontua as bolinhas automaticamente.</p>
      </div>
    </div>
  );
};
