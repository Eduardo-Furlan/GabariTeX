import React, { useState } from 'react';
import * as m from 'motion/react-m';
import {
  BookOpen,
  Users,
  Camera,
  Menu,
  X,
  Loader2,
  AlertTriangle,
  Download,
  Upload,
} from 'lucide-react';
import { Route } from '../../router/hashRouter';
import { useProfile } from '../../context/ProfileContext';
import { ProfileMenu } from './ProfileMenu';
import { ThemeToggle } from '../ThemeToggle';
import { cn } from '../ui/cn';

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
  const isScannerActive =
    currentRoute.type === 'scanner' ||
    (currentRoute.type === 'exam_step' && currentRoute.step === 'corrigir');

  const handleLogoClick = () => {
    if (activeExamId) {
      onNavigate({ type: 'exam_step', examId: activeExamId, step: 'criar' });
    } else {
      onNavigate({ type: 'exams' });
    }
  };

  return (
    <header className="h-[52px] flex items-center justify-between px-4 sm:px-6">
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
        {/* Logo & Marca */}
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={handleLogoClick}
            className="flex items-center gap-2.5 text-slate-900 group focus-visible:outline-none"
            title="Ir para o início"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-on-accent flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              {/* Folha Óptica brand mark */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <circle cx="10" cy="14" r="2.5" fill="currentColor" />
                <path d="m14 13 2 2 3-3" strokeWidth="2.5" />
              </svg>
            </div>
            <div className="text-left">
              <span className="font-display font-bold text-base tracking-tight text-slate-900 block leading-none">
                Gabari<span className="text-indigo-600 dark:text-indigo-400">TeX</span>
              </span>
              <span className="text-meta text-slate-500 font-medium hidden sm:block mt-0.5 leading-none">
                Correção óptica de avaliações
              </span>
            </div>
          </button>

          {/* Áreas principais (Desktop - Nível 1) */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Navegação principal">
            <button
              type="button"
              onClick={() => onNavigate({ type: 'exams' })}
              className={cn(
                'relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition focus-visible:outline-none',
                isExamsActive
                  ? 'text-indigo-700 dark:text-indigo-300 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              {isExamsActive && (
                <m.span
                  layoutId="header-nav-pill"
                  className="absolute inset-0 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 shadow-2xs -z-0"
                  transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }}
                  aria-hidden="true"
                />
              )}
              <BookOpen className="w-3.5 h-3.5 relative z-10" />
              <span className="relative z-10">Provas</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate({ type: 'classes' })}
              className={cn(
                'relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition focus-visible:outline-none',
                isClassesActive
                  ? 'text-indigo-700 dark:text-indigo-300 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              {isClassesActive && (
                <m.span
                  layoutId="header-nav-pill"
                  className="absolute inset-0 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 shadow-2xs -z-0"
                  transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }}
                  aria-hidden="true"
                />
              )}
              <Users className="w-3.5 h-3.5 relative z-10" />
              <span className="relative z-10">Turmas</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate({ type: 'scanner' })}
              className={cn(
                'relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition focus-visible:outline-none',
                isScannerActive
                  ? 'text-indigo-700 dark:text-indigo-300 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              {isScannerActive && (
                <m.span
                  layoutId="header-nav-pill"
                  className="absolute inset-0 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 shadow-2xs -z-0"
                  transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }}
                  aria-hidden="true"
                />
              )}
              <Camera className="w-3.5 h-3.5 relative z-10" />
              <span className="relative z-10">Corretor</span>
            </button>
          </nav>
        </div>

        {/* Lado Direito: Autosave, Tema, Perfil (Desktop) e Hambúrguer (Mobile) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Indicador de Salvamento Automático */}
          <div
            role="status"
            aria-live="polite"
            className={cn(
              'hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-meta font-medium border transition-colors duration-150',
              autosaveState.status === 'saving'
                ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30'
                : autosaveState.status === 'error'
                ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            )}
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
                <Loader2 className="w-3 h-3 animate-spin text-indigo-600 dark:text-indigo-400" />
                <span>Salvando...</span>
              </>
            ) : autosaveState.status === 'error' ? (
              <>
                <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                <span>Erro ao salvar</span>
              </>
            ) : (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-emerald-600 dark:text-emerald-400 animate-draw-check"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
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
              className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition focus-visible:outline-none"
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
        <div className="md:hidden absolute top-[52px] left-0 right-0 border-b border-slate-200 bg-white px-4 py-3 shadow-lg z-40 space-y-3">
          <div className="space-y-1 pb-3 border-b border-slate-200">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigate({ type: 'exams' });
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-left transition',
                isExamsActive
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                  : 'text-slate-700 hover:bg-slate-100'
              )}
            >
              <BookOpen className="w-4 h-4" />
              <span>Provas</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigate({ type: 'classes' });
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-left transition',
                isClassesActive
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                  : 'text-slate-700 hover:bg-slate-100'
              )}
            >
              <Users className="w-4 h-4" />
              <span>Turmas</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigate({ type: 'scanner' });
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-left transition',
                isScannerActive
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                  : 'text-slate-700 hover:bg-slate-100'
              )}
            >
              <Camera className="w-4 h-4" />
              <span>Corretor</span>
            </button>
          </div>

          <div className="pt-1 space-y-1">
            <span className="text-meta font-bold text-slate-500 px-3 block mb-1">
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
              <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
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
              <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Importar Perfil (ZIP)</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
