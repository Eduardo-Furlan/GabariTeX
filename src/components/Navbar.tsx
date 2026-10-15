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
  Database,
  Check,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { AutosaveState } from '../hooks/useAutosave';

export type ActiveTab = 'editor' | 'versions' | 'print' | 'scanner' | 'gradebook';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  onLoadSample: () => void;
  onClearExam: () => void;
  onOpenBackup: () => void;
  hasQuestions: boolean;
  gradedCount: number;
  autosaveState?: AutosaveState;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onExportJson,
  onImportJson,
  onLoadSample,
  onClearExam,
  onOpenBackup,
  gradedCount,
  autosaveState,
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
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300 shrink-0">
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
            <ThemeToggle />
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
            {/* Indicador de Salvamento Automático */}
            {autosaveState && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                {autosaveState.status === 'saving' && (
                  <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Loader2 className="w-3 h-3 text-indigo-500 animate-spin" />
                    <span>Salvando...</span>
                  </span>
                )}
                {autosaveState.status === 'saved' && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span>
                      Salvo às{' '}
                      {autosaveState.savedAt
                        ? autosaveState.savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>
                  </span>
                )}
                {autosaveState.status === 'error' && (
                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                    <AlertTriangle className="w-3 h-3 text-rose-500" />
                    <span>Erro ao salvar</span>
                  </span>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onOpenBackup}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 rounded-lg text-xs font-bold transition shadow-sm"
              title="Gerenciar backups completos, sincronizar notas e verificar armazenamento"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Dados & Backup</span>
            </button>

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
              title="Carregar banco de questões da prova de um arquivo JSON"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importar Prova</span>
            </button>

            <button
              type="button"
              onClick={onExportJson}
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition"
              title="Salvar banco de questões da prova em arquivo JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Prova</span>
            </button>

            <button
              type="button"
              onClick={onLoadSample}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium transition"
              title="Carregar exemplo completo de prova de cálculo/matemática com questões objetivas e dissertativa"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Exemplo Matemática</span>
            </button>

            <button
              type="button"
              onClick={onClearExam}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-500 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-slate-200 rounded-lg text-xs font-semibold transition"
              title="Limpar todos os dados e questões da prova atual"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar Prova</span>
            </button>

            <ThemeToggle />
          </div>
        </div>

        {/* Menu Retrátil Mobile (< lg) */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-slate-100 flex flex-col gap-2 bg-slate-50/90 -mx-4 px-4 sm:-mx-6 sm:px-6">
            <button
              type="button"
              onClick={() => {
                onOpenBackup();
                setMobileMenuOpen(false);
              }}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-on-accent font-bold rounded-lg text-xs shadow-sm transition"
            >
              <Database className="w-4 h-4" />
              <span>Dados & Backup Completo</span>
            </button>

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
                <span>Importar Prova</span>
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
                <span>Exportar Prova</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onLoadSample();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 rounded-lg text-xs font-semibold transition"
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" />
                <span>Exemplo Matemática</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClearExam();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-lg text-xs font-semibold transition"
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
                    ? 'border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-300'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-1 px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded-full">
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
