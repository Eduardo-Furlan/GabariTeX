import React, { useState, useRef } from 'react';
import {
  Database,
  Download,
  Upload,
  Info,
  ChevronDown,
  HardDrive,
  Smartphone,
  BookOpen,
} from 'lucide-react';
import { useProfile } from '../../context/ProfileContext';
import { ThemeSelector } from '../ThemeSelector';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { DOCS_URL } from '../../config/links';
import { openExternal } from '../../platform/external';
import { Popover } from '../ui/Popover';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';

interface ProfileMenuProps {
  onOpenExportImport: (mode?: 'export' | 'import') => void;
}

export const ProfileMenu: React.FC<ProfileMenuProps> = ({ onOpenExportImport }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { exams, records, classes } = useProfile();
  const { canInstall, installApp } = usePwaInstall();

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-semibold shadow-2xs transition-all duration-[90ms] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 coarse:min-h-[44px]',
          isOpen && 'border-slate-300 bg-slate-100'
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Database className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
        <span>Perfil</span>
        <ChevronDown
          className={cn(
            'w-3 h-3 text-slate-400 transition-transform duration-150',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      <Popover
        open={isOpen}
        onOpenChange={setIsOpen}
        anchorRef={buttonRef}
        align="end"
        className="w-72 py-2"
      >
        <div className="px-4 py-2 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-900 block">Perfil do Professor</span>
          <span className="text-meta text-slate-500 block mt-0.5">
            {exams.length} {exams.length === 1 ? 'prova' : 'provas'} · {classes.length}{' '}
            {classes.length === 1 ? 'turma' : 'turmas'} · {records.length}{' '}
            {records.length === 1 ? 'nota' : 'notas'}
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
            <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <div>
              <span className="block text-slate-800">Exportar Perfil (ZIP)</span>
              <span className="text-meta text-slate-400 font-normal">
                Todas as provas, turmas e notas em um arquivo
              </span>
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
            <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <div>
              <span className="block text-slate-800">Importar Perfil (ZIP)</span>
              <span className="text-meta text-slate-400 font-normal">
                Restaurar ou mesclar backup de outro aparelho
              </span>
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
              <Smartphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <div>
                <span className="block text-slate-800">Instalar Aplicativo</span>
                <span className="text-meta text-slate-400 font-normal">
                  Usar direto da tela inicial e operar offline
                </span>
              </div>
            </button>
          )}
        </div>

        <div className="border-t border-slate-100 px-4 py-3">
          <span className="text-xs font-medium text-slate-600 block mb-2">Tema Visual:</span>
          <ThemeSelector />
        </div>

        <div className="border-t border-slate-100 py-1">
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              setIsOpen(false);
              if (typeof __DESKTOP__ !== 'undefined' && __DESKTOP__) {
                e.preventDefault();
                void openExternal(DOCS_URL).catch(() => {});
              }
            }}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition"
          >
            <BookOpen className="w-4 h-4 text-slate-500" />
            <span>Documentação & Ajuda</span>
          </a>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setShowAbout(true);
            }}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition"
          >
            <Info className="w-4 h-4 text-slate-500" />
            <span>Sobre o GabariTeX</span>
          </button>
        </div>

        <div className="mt-1 pt-2 border-t border-slate-100 px-4 pb-1">
          <p className="text-meta text-slate-500 leading-relaxed">
            Seus dados ficam salvos localmente neste aparelho. Exporte um perfil para guardar uma
            cópia segura ou transferir para outro computador.
          </p>
        </div>
      </Popover>

      <Modal
        open={showAbout}
        onOpenChange={setShowAbout}
        title="Sobre o GabariTeX"
        size="sm"
        footer={
          <Button variant="primary" onClick={() => setShowAbout(false)}>
            Fechar
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <circle cx="10" cy="13" r="2" fill="currentColor" />
                <path d="m9 17 2 2 4-4" />
              </svg>
            </div>
            <div>
              <h4 className="font-display text-title font-bold text-slate-900 leading-tight">
                GabariTeX
              </h4>
              <span className="text-meta text-slate-500">
                Versão {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'} • Criador & Corretor Óptico
              </span>
            </div>
          </div>

          <p className="text-body text-slate-600 leading-relaxed">
            Sistema autônomo para criação, diagramação em LaTeX e correção óptica de folhas de respostas com criptografia e processamento nativo.
          </p>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1.5">
            <div className="flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
              <span>Armazenamento: Banco de dados local ({exams.length} provas salvas)</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
