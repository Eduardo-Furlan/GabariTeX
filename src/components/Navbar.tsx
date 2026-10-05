import React, { useRef, useState } from 'react';
import {
  FileEdit,
  Shuffle,
  Printer,
  Camera,
  Users,
  Download,
  Upload,
  FileCheck2,
  BookOpen,
  Trash2,
  Menu,
  X,
} from 'lucide-react';

export type ActiveTab = 'editor' | 'versions' | 'print' | 'scanner' | 'gradebook';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
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
  onLoadSample,
  onClearExam,
  gradedCount,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

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
        {/* Barra Superior */}
        <div className="flex items-center justify-between min-h-[3.75rem] py-2">
          {/* Logo e Título */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
              <FileCheck2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-extrabold text-slate-900 text-sm sm:text-base lg:text-lg leading-tight truncate">
                Gerador & Corretor de Provas
              </h1>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium hidden sm:block truncate">
                Avaliações de Matemática, LaTeX, Gabarito Criptografado & Leitura Óptica
              </p>
            </div>
          </div>

          {/* Botão de Menu para Telas Menores (< lg) */}
          <div className="flex lg:hidden items-center gap-2">
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
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition"
              aria-label="Abrir menu de ações da prova"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              <span>Ações</span>
            </button>
          </div>

          {/* Ações Desktop (>= lg) */}
          <div className="hidden lg:flex items-center gap-2">
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
              <span>Importar JSON</span>
            </button>

            <button
              type="button"
              onClick={onExportJson}
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition"
              title="Salvar prova e banco de questões em arquivo JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar JSON</span>
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
              <span>Limpar Prova</span>
            </button>
          </div>
        </div>

        {/* Menu Retrátil Mobile (< lg) */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-slate-100 flex flex-col gap-2 bg-slate-50/90 -mx-4 px-4 sm:-mx-6 sm:px-6">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium shadow-sm transition"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                <span>Importar JSON</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onExportJson();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium shadow-sm transition"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span>Exportar JSON</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onLoadSample();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition"
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>Exemplo Matemática</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClearExam();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Prova</span>
              </button>
            </div>
          </div>
        )}

        {/* Abas de Navegação (Scroll horizontal suave) */}
        <nav className="flex space-x-1 sm:space-x-3 border-t border-slate-100 overflow-x-auto py-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`shrink-0 flex items-center gap-1.5 sm:gap-2 py-2 px-2.5 sm:px-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition ${
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
