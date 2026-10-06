import React, { useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { GradedAnswer, GradingRecord } from '../../types/exam';
import { decryptAnswerKey } from '../../utils/crypto';
import { analyzeCanvasOmr, getStandardBubbleCoordinates } from '../../utils/omrProcessor';
import { UploadCloud, AlertTriangle, Image as ImageIcon } from 'lucide-react';

interface PhotoUploaderProps {
  teacherPassword: string;
  onGraded: (record: GradingRecord) => void;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  teacherPassword,
  onGraded,
}) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessImage = async (file: File) => {
    if (!teacherPassword || !teacherPassword.trim()) {
      setErrorMessage('Por favor, informe a senha da prova antes de enviar a foto.');
      return;
    }
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

      // Leitor de QR Code com estratégias de fallback para alta resolução e documentos A4
      const qrScanner = new Html5Qrcode('hidden-qr-reader');
      let decodedText: string | null = null;

      // Tentativa 1: Escaneamento direto do arquivo original
      try {
        decodedText = await qrScanner.scanFile(file, false);
      } catch {
        // Falha normal em digitalizações de página inteira (>300 DPI)
      }

      // Função auxiliar para escanear recortes via Blob -> File
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
        throw new Error('Não foi possível detectar o QR Code na folha de respostas.');
      }

      // Descriptografa com a senha do professor
      const payload = await decryptAnswerKey(decodedText, teacherPassword);

      // Analisa bolinhas
      const totalQuestions =
        payload.totalQuestions ??
        Math.max(...Object.keys(payload.key).map(Number), 0);
      const subjectiveQuestions = payload.subjectiveQuestions ?? [];
      const columnsCount = totalQuestions <= 12 ? 1 : 2;

      const gridConfig = {
        totalQuestions,
        optionsPerQuestion: 5,
        columnsCount,
        subjectiveQuestions,
      };

      const bubbles = getStandardBubbleCoordinates(gridConfig);
      const omrDetections = analyzeCanvasOmr(canvas, bubbles, undefined, gridConfig);

      // Calcula notas
      let totalPoints = 0;
      let maxPoints = 0;
      const answers: GradedAnswer[] = [];

      const objectiveQuestionNumbers = Object.keys(payload.key)
        .map(Number)
        .sort((a, b) => a - b);

      for (const i of objectiveQuestionNumbers) {
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

      setIsProcessing(false);
      onGraded(record);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível ler o gabarito na foto.';
      setErrorMessage(msg);
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mt-4">
      <div id="hidden-qr-reader" className="hidden" />

      <div className="flex items-center gap-2 mb-3">
        <UploadCloud className="w-5 h-5 text-indigo-600" />
        <h3 className="text-base font-bold text-slate-800">Correção por Envio de Foto / Arquivo</h3>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Tirou a foto do gabarito pelo celular ou tem um scanner de mesa? Envie a imagem para correção automática.
      </p>

      <div
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
          isProcessing
            ? 'border-indigo-400 bg-indigo-50/50'
            : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30'
        }`}
      >
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

        <div className="flex flex-col items-center justify-center">
          <ImageIcon className="w-10 h-10 text-slate-400 mb-2" />
          <span className="text-sm font-semibold text-slate-700">
            {isProcessing ? 'Processando imagem e corrigindo...' : 'Clique para selecionar foto do gabarito'}
          </span>
          <span className="text-xs text-slate-400 mt-1">Formatos suportados: JPG, PNG, WEBP</span>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
