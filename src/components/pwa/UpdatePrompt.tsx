import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { RefreshCw, CheckCircle2, X } from 'lucide-react';
import { Button } from '../ui/Button';

interface UpdatePromptProps {
  isBatchProcessing?: boolean;
}

const UpdatePromptInner: React.FC<UpdatePromptProps> = ({ isBatchProcessing = false }) => {
  const [offlineToastVisible, setOfflineToastVisible] = useState(false);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        setInterval(() => {
          r.update().catch(() => {});
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('[PWA] Erro no registro do Service Worker:', error);
    },
  });

  useEffect(() => {
    if (offlineReady) {
      setOfflineToastVisible(true);
      const timer = setTimeout(() => {
        setOfflineToastVisible(false);
        setOfflineReady(false);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [offlineReady, setOfflineReady]);

  const handleUpdate = () => {
    if (isBatchProcessing) {
      const confirmDiscard = window.confirm(
        'Há uma correção em lote em processamento. Atualizar agora recarregará a página e o lote será reiniciado. Deseja continuar?'
      );
      if (!confirmDiscard) return;
    }
    updateServiceWorker(true);
  };

  if (!needRefresh && !offlineToastVisible) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Notificações do aplicativo"
      className="no-print fixed bottom-[calc(52px+env(safe-area-inset-bottom)+8px)] md:bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
    >
      <AnimatePresence>
        {/* Toast discreto de Offline Ready */}
        {offlineToastVisible && (
          <m.div
            className="pointer-events-auto flex items-center justify-between gap-3 p-3.5 bg-white rounded-card shadow-raised border border-slate-200"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">Pronto para uso offline</p>
                <p className="text-meta text-slate-500">O GabariTeX funcionará mesmo sem internet.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setOfflineToastVisible(false);
                setOfflineReady(false);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus-visible:outline-none"
              aria-label="Fechar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </m.div>
        )}

        {/* Faixa fixa de Nova Versão */}
        {needRefresh && (
          <m.div
            className="pointer-events-auto p-4 bg-white rounded-sheet shadow-overlay border border-indigo-200 dark:border-indigo-500/30 space-y-3"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-display text-sm font-bold text-slate-900">
                    Nova versão disponível
                  </h4>
                  <p className="text-meta text-slate-500 leading-tight">
                    Atualize com um toque para aplicar melhorias.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNeedRefresh(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus-visible:outline-none"
                aria-label="Lembrar mais tarde"
                title="Lembrar mais tarde"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNeedRefresh(false)}
              >
                Mais tarde
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleUpdate}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Atualizar agora
              </Button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const UpdatePrompt: React.FC<UpdatePromptProps> = (props) => {
  if (typeof window === 'undefined') return null;
  return <UpdatePromptInner {...props} />;
};
