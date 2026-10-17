import React, { useState, useRef, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  Info,
  ChevronDown,
  HardDrive,
  FileCheck2,
  Smartphone,
  BookOpen,
} from 'lucide-react';
import { useProfile } from '../../context/ProfileContext';
import { ThemeToggle } from '../ThemeToggle';
import { usePwaInstall } from '../../hooks/usePwaInstall';

interface ProfileMenuProps {
  onOpenExportImport: (mode?: 'export' | 'import') => void;
}

export const ProfileMenu: React.FC<ProfileMenuProps> = ({ onOpenExportImport }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { exams, records, classes } = useProfile();
  const { canInstall, installApp } = usePwaInstall();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold shadow-sm transition active:scale-95"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Database className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" />
        <span>Perfil</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-4 py-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-800 block">Perfil do Professor</span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              {exams.length} {exams.length === 1 ? 'prova' : 'provas'} · {classes.length} {classes.length === 1 ? 'turma' : 'turmas'} · {records.length} {records.length === 1 ? 'nota' : 'notas'}
            </span>
          </div>

          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenExportImport('export');
              }}
              className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition"
            >
              <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
              <div>
                <span className="block text-slate-800">Exportar Perfil (ZIP)</span>
                <span className="text-[10px] text-slate-400 font-normal">Todas as provas, turmas e notas em um arquivo</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenExportImport('import');
              }}
              className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition"
            >
              <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
              <div>
                <span className="block text-slate-800">Importar Perfil (ZIP)</span>
                <span className="text-[10px] text-slate-400 font-normal">Restaurar ou mesclar backup de outro aparelho</span>
              </div>
            </button>

            {canInstall && (
              <button
                type="button"
                onClick={async () => {
                  setIsOpen(false);
                  await installApp();
                }}
                className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition border-t border-slate-100"
              >
                <Smartphone className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                <div>
                  <span className="block text-slate-800">Instalar Aplicativo</span>
                  <span className="text-[10px] text-slate-400 font-normal">Usar direto da tela inicial e operar offline</span>
                </div>
              </button>
            )}
          </div>

          <div className="border-t border-slate-100 px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Tema Visual:</span>
            <ThemeToggle />
          </div>

          <div className="border-t border-slate-100 py-1">
            <a
              href="https://eduardo-furlan.github.io/GabariTeX/docs/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition"
            >
              <BookOpen className="w-4 h-4 text-slate-500" />
              <span>Documentação & Ajuda</span>
            </a>

            <button
              type="button"
              onClick={() => setShowAbout(true)}
              className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition"
            >
              <Info className="w-4 h-4 text-slate-500" />
              <span>Sobre o GabariTeX</span>
            </button>
          </div>

          <div className="mt-1 pt-2 border-t border-slate-100 px-4 pb-1">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Seus dados ficam salvos localmente neste aparelho. Exporte um perfil para guardar uma cópia segura ou transferir para outro computador.
            </p>
          </div>
        </div>
      )}

      {showAbout && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300 shrink-0">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">GabariTeX</h3>
                <span className="text-xs text-slate-500">Versão {__APP_VERSION__} • Criador & Corretor Óptico</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Sistema autônomo para criação, diagramação em LaTeX e correção óptica de folhas de respostas com criptografia e processamento nativo.
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5 mb-5">
              <div className="flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                <span>Armazenamento: Banco de dados local ({exams.length} provas salvas)</span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowAbout(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-on-accent font-bold text-xs rounded-lg shadow-sm transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
