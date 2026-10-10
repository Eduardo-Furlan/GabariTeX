import React, { useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ExamVersion, GradingRecord } from '../../types/exam';
import { DecryptedQrPayload } from '../../types/omr';
import { decryptAnswerKey } from '../../utils/crypto';
import { gradeCanvasWithPayload, detectOmrGrid, GridConfig } from '../../utils/omrProcessor';
import { AlertTriangle, Image as ImageIcon, CheckCircle2, QrCode, Camera, Check, Sparkles } from 'lucide-react';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleProcessImage = async (file: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // Carrega imagem em um canvas para leitura das bolinhas e análise
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

      // Se a versão ainda não estiver travada, busca o QR Code na imagem
      if (!targetPayload) {
        if (!teacherPassword || !teacherPassword.trim()) {
          throw new Error('Por favor, informe a senha da prova para descriptografar o QR Code.');
        }

        const qrScanner = new Html5Qrcode('hidden-qr-reader');
        let decodedText: string | null = null;

        // Tentativa 1: Escaneamento direto do arquivo original
        try {
          decodedText = await qrScanner.scanFile(file, false);
        } catch {
          // Normal em digitalizações de página inteira
        }

        const scanCanvas = async (subCanvas: HTMLCanvasElement): Promise<string> => {
          const blob = await new Promise<Blob | null>((resolve) =>
            subCanvas.toBlob(resolve, 'image/png')
          );
          if (!blob) throw new Error('Falha ao gerar blob do canvas');
          const cropFile = new File([blob], 'qr-crop.png', { type: 'image/png' });
          return await qrScanner.scanFile(cropFile, false);
        };

        // Tentativa 2: Recorte do quadrante superior direito (onde o QR Code fica na folha A4)
        if (!decodedText) {
          try {
            const cropX = Math.floor(canvas.width * 0.45);
            const cropY = 0;
            const cropW = canvas.width - cropX;
            const cropH = Math.floor(canvas.height * 0.35);

            const scale = Math.min(1, 1000 / Math.max(cropW, cropH));
            const targetW = Math.max(250, Math.floor(cropW * scale));
            const targetH = Math.max(250, Math.floor(cropH * scale));

            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = targetW;
            cropCanvas.height = targetH;
            const cropCtx = cropCanvas.getContext('2d');
            if (cropCtx) {
              cropCtx.imageSmoothingEnabled = false;
              cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
              decodedText = await scanCanvas(cropCanvas);
            }
          } catch {
            // Continua para próxima tentativa
          }
        }

        // Tentativa 3: Faixa superior inteira normalizada
        if (!decodedText) {
          try {
            const topH = Math.floor(canvas.height * 0.4);
            const scale = Math.min(1, 1200 / canvas.width);
            const targetW = Math.floor(canvas.width * scale);
            const targetH = Math.floor(topH * scale);

            const topCanvas = document.createElement('canvas');
            topCanvas.width = targetW;
            topCanvas.height = targetH;
            const topCtx = topCanvas.getContext('2d');
            if (topCtx) {
              topCtx.imageSmoothingEnabled = false;
              topCtx.drawImage(canvas, 0, 0, canvas.width, topH, 0, 0, targetW, targetH);
              decodedText = await scanCanvas(topCanvas);
            }
          } catch {
            // Continua para próxima tentativa
          }
        }

        // Tentativa 4: Imagem inteira redimensionada para resolução ideal para o ZXing (~1600px)
        if (!decodedText) {
          try {
            const maxDim = 1600;
            const scale = Math.min(1, maxDim / Math.max(canvas.width, canvas.height));
            const targetW = Math.floor(canvas.width * scale);
            const targetH = Math.floor(canvas.height * scale);

            const downCanvas = document.createElement('canvas');
            downCanvas.width = targetW;
            downCanvas.height = targetH;
            const downCtx = downCanvas.getContext('2d');
            if (downCtx) {
              downCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, targetW, targetH);
              decodedText = await scanCanvas(downCanvas);
            }
          } catch {
            // Falha
          }
        }

        if (!decodedText) {
          throw new Error('Não foi possível detectar o QR Code nesta foto. Selecione a versão da prova nos botões acima ou tire uma foto de perto do QR Code.');
        }

        // Descriptografa com a senha do professor
        targetPayload = await decryptAnswerKey(decodedText, teacherPassword);
        onLockPayload?.(targetPayload);

        // Se a foto foi apenas um close-up do QR Code (sem a grade de respostas),
        // trava a versão e orienta a fotografar o gabarito.
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
            `Versão ${targetPayload.version} detectada e travada com sucesso! Agora tire a foto da grade de respostas para corrigir.`
          );
          return;
        }
      }

      // Analisa e corrige as bolinhas usando o gabarito
      const record = gradeCanvasWithPayload(canvas, targetPayload);
      setIsProcessing(false);
      onGraded(record);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível ler o gabarito na foto.';
      setErrorMessage(msg);
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
      <div>
        <div id="hidden-qr-reader" className="hidden" />

        <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Leitor Óptico via Câmera do Celular / Foto</h3>
              <p className="text-xs text-slate-500 font-medium">
                Utiliza o aplicativo nativo de câmera com foco automático perfeito e alta nitidez
              </p>
            </div>
          </div>
        </div>

        {/* Status e Seletor do Passo 1 */}
        <div className="mb-5 p-4 rounded-xl border flex items-center justify-between flex-wrap gap-3 text-xs bg-slate-50/80 border-slate-200">
          {activePayload ? (
            <div className="flex items-center justify-between w-full flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1 bg-emerald-600 text-white font-black rounded-lg flex items-center gap-1.5 shadow-sm text-xs">
                  <CheckCircle2 className="w-4 h-4" /> VERSÃO {activePayload.version} TRAVADA
                </span>
                <span className="text-slate-700 font-medium text-xs">
                  Pronto! Agora enquadre e fotografe apenas a grade de respostas.
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
                <span>Passo 1: Selecione a versão da prova ou tire uma foto de perto do QR Code:</span>
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

        {/* Botões de Ação */}
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
                ? 'Processando imagem...'
                : activePayload
                ? `Tirar Foto do Gabarito (Versão ${activePayload.version})`
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
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Como obter máxima precisão na leitura:
        </p>
        <p>• Com a <strong>versão travada</strong>, aproxime a câmera da caixa do gabarito até enquadrar toda a grade de respostas.</p>
        <p>• O algoritmo com auto-alinhamento compensa pequenas inclinações, mas evite sombras fortes e reflexos diretos de luz sobre o papel.</p>
      </div>
    </div>
  );
};
