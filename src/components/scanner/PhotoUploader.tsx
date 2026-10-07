import React, { useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ExamVersion, GradingRecord } from '../../types/exam';
import { DecryptedQrPayload } from '../../types/omr';
import { decryptAnswerKey } from '../../utils/crypto';
import { gradeCanvasWithPayload } from '../../utils/omrProcessor';
import { UploadCloud, AlertTriangle, Image as ImageIcon, CheckCircle2, QrCode, Camera } from 'lucide-react';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleProcessImage = async (file: File) => {
    setIsProcessing(true);
    setErrorMessage(null);

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
          // Normal em digitalizações de página inteira (>300 DPI)
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
            // Falha em todas as tentativas
          }
        }

        if (!decodedText) {
          throw new Error('Não foi possível detectar o QR Code na foto. Selecione a versão acima antes de enviar a foto.');
        }

        // Descriptografa com a senha do professor
        targetPayload = await decryptAnswerKey(decodedText, teacherPassword);
        onLockPayload?.(targetPayload);
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
      <div>
        <div id="hidden-qr-reader" className="hidden" />

        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-base font-bold text-slate-800">Upload de Foto / Digitalização</h3>
              <span className="text-[11px] text-slate-500 font-medium">
                {activePayload
                  ? `Versão ${activePayload.version} ativa: o QR Code não precisa aparecer na foto`
                  : 'A foto deve conter o QR Code ou selecione a versão abaixo'}
              </span>
            </div>
          </div>
        </div>

        {/* Status da Versão no Upload */}
        <div className="mb-4 p-3 rounded-xl border flex items-center justify-between flex-wrap gap-2 text-xs bg-slate-50 border-slate-200">
          {activePayload ? (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-emerald-600 text-white font-black rounded-lg flex items-center gap-1.5 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5" /> VERSÃO {activePayload.version}
              </span>
              <span className="text-slate-600 font-medium">
                Pronto para corrigir fotos desta versão (apenas a grade de bolinhas é necessária).
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full flex-wrap gap-2">
              <div className="flex items-center gap-2 text-slate-600">
                <QrCode className="w-4 h-4 text-indigo-600" />
                <span>Selecione a versão da folha para dispensar a leitura do QR Code:</span>
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

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isProcessing}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Camera className="w-5 h-5" />
            <span>
              {isProcessing
                ? 'Processando imagem...'
                : activePayload
                ? `Tirar Foto com Câmera do Celular (Versão ${activePayload.version})`
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
              <ImageIcon className="w-7 h-7 text-slate-400 mb-1" />
              <span className="text-xs font-semibold text-slate-700">
                Ou selecionar foto salva na galeria / arquivos
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Formatos suportados: JPG, PNG, WEBP</span>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700">Dicas para foto ou digitalização:</p>
        <p>• Com a <strong>versão travada</strong>, você pode enviar fotos recortadas apenas da grade de respostas.</p>
        <p>• Assegure que as bordas da grade de bolinhas estejam visíveis e bem iluminadas.</p>
      </div>
    </div>
  );
};
