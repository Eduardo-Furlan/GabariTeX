import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, CheckCircle2, X } from 'lucide-react';

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
        // Verifica atualizações a cada 1 hora se a página permanecer aberta
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
      className="no-print fixed bottom-16 md:bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
    >
      {/* Toast discreto de Offline Ready */}
      {offlineToastVisible && (
        <div className="pointer-events-auto flex items-center justify-between gap-3 p-3.5 bg-white rounded-xl shadow-lg border border-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">Pronto para uso offline</p>
              <p className="text-[11px] text-slate-500">O GabariTeX funcionará mesmo sem internet.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setOfflineToastVisible(false);
              setOfflineReady(false);
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Faixa fixa discreta de Nova Versão */}
      {needRefresh && (
        <div className="pointer-events-auto p-4 bg-white rounded-2xl shadow-xl border border-indigo-200 dark:border-indigo-500/30 animate-in fade-in slide-in-from-bottom-3 duration-200 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Nova versão disponível</h4>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Atualize com um toque para aplicar melhorias.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNeedRefresh(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Lembrar mais tarde"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setNeedRefresh(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Depois
            </button>
            <button
              type="button"
              onClick={handleUpdate}
              className="px-3.5 py-1.5 text-xs font-semibold text-on-accent bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const UpdatePrompt: React.FC<UpdatePromptProps> = (props) => {
  if (typeof __DESKTOP__ !== 'undefined' && __DESKTOP__) {
    return null;
  }
  return <UpdatePromptInner {...props} />;
};

