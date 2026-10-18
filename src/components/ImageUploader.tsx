import React, { useRef, useState } from 'react';
import { X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { downscaleImage } from '../utils/image';
import { cn } from './ui/cn';

interface ImageUploaderProps {
  imageUrl?: string;
  imageCaption?: string;
  onImageChange: (url?: string, caption?: string) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  imageUrl,
  imageCaption,
  onImageChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem.');
      return;
    }

    try {
      setIsProcessing(true);
      const dataUrl = await downscaleImage(file, 1200, 0.85);
      onImageChange(dataUrl, imageCaption || '');
    } catch (err) {
      console.error('Erro ao redimensionar imagem', err);
      // Fallback para FileReader padrão se o canvas falhar
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        onImageChange(result, imageCaption || '');
      };
      reader.readAsDataURL(file);
    } finally {
      setIsProcessing(false);
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="mt-3">
      {imageUrl ? (
        <div className="relative border border-slate-200 rounded-card p-3 bg-slate-50 inline-block max-w-md transition-opacity duration-200">
          <button
            type="button"
            onClick={() => onImageChange(undefined, undefined)}
            className="absolute top-2 right-2 p-1 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 rounded-full hover:bg-rose-200 dark:hover:bg-rose-500/30 transition focus-visible:outline-none"
            title="Remover imagem"
            aria-label="Remover imagem"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
            <img
              src={imageUrl}
              alt="Figura da questão"
              className="max-h-48 rounded object-contain mx-auto transition-transform duration-200"
            />
          </div>
          <input
            type="text"
            placeholder="Legenda da figura (ex: Figura 1: Esboço da curva)"
            value={imageCaption || ''}
            onChange={(e) => onImageChange(imageUrl, e.target.value)}
            className="mt-2 w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-card p-4 text-center cursor-pointer transition duration-150',
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10 scale-[1.01]'
              : 'border-slate-300 hover:border-indigo-400 dark:hover:border-indigo-500/50 bg-slate-50 hover:bg-indigo-50/30 dark:hover:bg-indigo-500/10'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
              }
            }}
          />
          <div className="flex flex-col items-center justify-center text-slate-500">
            {isProcessing ? (
              <>
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mb-1" />
                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  Otimizando e comprimindo imagem...
                </span>
              </>
            ) : (
              <>
                <ImageIcon
                  className={cn(
                    'w-6 h-6 mb-1 transition-colors',
                    isDragging ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                  )}
                />
                <span className="text-xs font-medium text-slate-700">
                  Adicionar Imagem / Gráfico (opcional)
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  Clique ou arraste um arquivo de imagem
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
