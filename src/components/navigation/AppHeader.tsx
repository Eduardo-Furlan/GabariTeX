import React, { useState } from 'react';
import {
  FileCheck2,
  BookOpen,
  Users,
  Menu,
  X,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Download,
  Upload,
} from 'lucide-react';
import { Route } from '../../router/hashRouter';
import { useProfile } from '../../context/ProfileContext';
import { ProfileMenu } from './ProfileMenu';
import { ThemeToggle } from '../ThemeToggle';

interface AppHeaderProps {
  currentRoute: Route;
  onNavigate: (route: Route) => void;
  onOpenExportImport: (mode?: 'export' | 'import') => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentRoute,
  onNavigate,
  onOpenExportImport,
}) => {
  const { autosaveState, activeExamId } = useProfile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isExamsActive = currentRoute.type === 'exams';
  const isClassesActive = currentRoute.type === 'classes';

  const handleLogoClick = () => {
    if (activeExamId) {
      onNavigate({ type: 'exam_step', examId: activeExamId, step: 'criar' });
    } else {
      onNavigate({ type: 'exams' });
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Logo & Marca */}
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={handleLogoClick}
            className="flex items-center gap-2.5 text-slate-900 group focus:outline-none"
            title="Ir para o início"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-on-accent shadow-sm group-hover:scale-105 transition-transform">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div className="text-left">
              <span className="font-black text-base tracking-tight text-slate-900 block leading-none">
                Gabari<span className="text-indigo-600 dark:text-indigo-300">TeX</span>
              </span>
              <span className="text-[10px] text-slate-600 tracking-wider font-semibold uppercase hidden sm:block">
                Avaliações & OMR
              </span>
            </div>
          </button>

          {/* Áreas principais (Desktop - Nível 1) */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              type="button"
              onClick={() => onNavigate({ type: 'exams' })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                isExamsActive
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Provas</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate({ type: 'classes' })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                isClassesActive
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Turmas</span>
            </button>
          </nav>
        </div>

        {/* Lado Direito: Autosave, Tema, Perfil (Desktop) e Hambúrguer (Mobile) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Indicador de Salvamento Automático */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
              autosaveState.status === 'saving'
                ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 animate-pulse'
                : autosaveState.status === 'error'
                ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}
            title={
              autosaveState.status === 'saving'
                ? 'Salvando alterações...'
                : autosaveState.status === 'error'
                ? 'Falha ao salvar no banco local!'
                : 'Todas as alterações salvas automaticamente'
            }
          >
            {autosaveState.status === 'saving' ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-indigo-600 dark:text-indigo-300" />
                <span>Salvando...</span>
              </>
            ) : autosaveState.status === 'error' ? (
              <>
                <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-300" />
                <span>Erro ao salvar</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-300" />
                <span>Salvo</span>
              </>
            )}
          </div>

          {/* Tema Visual (Desktop) */}
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          {/* Menu Perfil (Desktop) */}
          <div className="hidden md:block">
            <ProfileMenu onOpenExportImport={onOpenExportImport} />
          </div>

          {/* Botão Hambúrguer (Mobile) */}
          <div className="flex md:hidden items-center gap-1.5">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
              aria-label="Abrir menu de navegação"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Menu Drawer Mobile */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 shadow-lg animate-in slide-in-from-top-2 duration-150">
          <div className="space-y-1 pb-3 border-b border-slate-200">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigate({ type: 'exams' });
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-left transition ${
                isExamsActive
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Provas (Biblioteca)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigate({ type: 'classes' });
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-left transition ${
                isClassesActive
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Turmas & Alunos</span>
            </button>
          </div>

          <div className="pt-3 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-600 px-3 tracking-wider block mb-1">
              Perfil & Backup
            </span>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenExportImport('export');
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 text-left"
            >
              <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
              <span>Exportar Perfil (ZIP)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenExportImport('import');
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 text-left"
            >
              <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
              <span>Importar Perfil (ZIP)</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
