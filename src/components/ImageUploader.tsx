import React, { useRef } from 'react';
import { X, Image as ImageIcon } from 'lucide-react';

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

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      onImageChange(result, imageCaption || '');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="mt-3">
      {imageUrl ? (
        <div className="relative border border-slate-200 rounded-lg p-3 bg-slate-50 inline-block max-w-md">
          <button
            type="button"
            onClick={() => onImageChange(undefined, undefined)}
            className="absolute top-2 right-2 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition"
            title="Remover imagem"
          >
            <X className="w-4 h-4" />
          </button>
          <img
            src={imageUrl}
            alt="Figura da questão"
            className="max-h-48 rounded object-contain mx-auto"
          />
          <input
            type="text"
            placeholder="Legenda da figura (ex: Figura 1: Esboço da curva)"
            value={imageCaption || ''}
            onChange={(e) => onImageChange(imageUrl, e.target.value)}
            className="mt-2 w-full text-xs px-2 py-1 border border-slate-300 rounded bg-white"
          />
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-lg p-4 text-center cursor-pointer bg-slate-50 hover:bg-indigo-50/30 transition"
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
            <ImageIcon className="w-6 h-6 text-slate-400 mb-1" />
            <span className="text-xs font-medium">Adicionar Imagem / Gráfico (opcional)</span>
            <span className="text-[11px] text-slate-400">Clique ou arraste um arquivo de imagem</span>
          </div>
        </div>
      )}
    </div>
  );
};
