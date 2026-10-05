import React, { useRef } from 'react';
import {
  FileEdit,
  Shuffle,
  Printer,
  Camera,
  Users,
  Download,
  Upload,
  FileCode,
  FileCheck2,
  BookOpen,
  Trash2,
} from 'lucide-react';

export type ActiveTab = 'editor' | 'versions' | 'print' | 'scanner' | 'gradebook';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  onExportLuaLatex: () => void;
  onLoadSample: () => void;
  onClearExam: () => void;
  hasQuestions: boolean;
  gradedCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onExportJson,
  onImportJson,
  onExportLuaLatex,
  onLoadSample,
  onClearExam,
  hasQuestions,
  gradedCount,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'editor', label: '1. Criar Prova', icon: <FileEdit className="w-4 h-4" /> },
    { id: 'versions', label: '2. Versões & Gabaritos', icon: <Shuffle className="w-4 h-4" /> },
    { id: 'print', label: '3. Imprimir / Salvar PDF', icon: <Printer className="w-4 h-4" /> },
    { id: 'scanner', label: '4. Corretor OMR', icon: <Camera className="w-4 h-4" /> },
    {
      id: 'gradebook',
      label: '5. Livro de Notas',
      icon: <Users className="w-4 h-4" />,
      badge: gradedCount > 0 ? gradedCount : undefined,
    },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 flex-wrap gap-2">
          {/* Logo e Título */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-slate-900 text-base sm:text-lg leading-tight">
                Gerador & Corretor de Provas
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                Avaliações de Matemática, LaTeX, Gabarito Criptografado & Leitura Óptica
              </p>
            </div>
          </div>

          {/* Ações de Importação / Exportação / LuaLaTeX */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  onImportJson(e.target.files[0]);
                }
              }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition"
              title="Carregar banco de questões de um arquivo JSON"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Importar JSON</span>
            </button>

            <button
              type="button"
              onClick={onExportJson}
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition"
              title="Salvar prova e banco de questões em arquivo JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar JSON</span>
            </button>

            <button
              type="button"
              onClick={onExportLuaLatex}
              disabled={!hasQuestions}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              title="Baixar código-fonte .tex formatado para compilação direta com LuaLaTeX"
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Código LuaLaTeX (.tex)</span>
            </button>

            <button
              type="button"
              onClick={onLoadSample}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition"
              title="Carregar exemplo completo de prova de cálculo/matemática com questões objetivas e dissertativa"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>Exemplo Matemática</span>
            </button>

            <button
              type="button"
              onClick={onClearExam}
              className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 rounded-lg text-xs font-semibold transition"
              title="Limpar todos os dados e questões da prova atual"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpar Prova</span>
            </button>
          </div>
        </div>

        {/* Abas de Navegação */}
        <nav className="flex space-x-1 sm:space-x-4 border-t border-slate-100 overflow-x-auto py-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-2 py-2 px-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition ${
                  isActive
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-1 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
