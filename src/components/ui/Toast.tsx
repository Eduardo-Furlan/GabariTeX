import React, { useSyncExternalStore } from 'react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import {
  subscribeToasts,
  getToastsSnapshot,
  getToastsServerSnapshot,
  dismissToast,
  ToastItem,
} from './toastStore';
import { cn } from './cn';

export const ToastHost: React.FC = () => {
  const toasts = useSyncExternalStore(
    subscribeToasts,
    getToastsSnapshot,
    getToastsServerSnapshot
  );

  return (
    <aside
      aria-label="Notificações"
      className="no-print fixed z-50 pointer-events-none flex flex-col gap-2 p-4 right-0 sm:right-4 bottom-[calc(52px+env(safe-area-inset-bottom))] sm:bottom-4 max-w-sm w-full"
    >
      <div role="status" aria-live="polite" className="sr-only">
        {toasts.map((t) => `${t.title ? `${t.title}: ` : ''}${t.message}`).join('. ')}
      </div>

      <AnimatePresence>
        {toasts.map((t) => (
          <SingleToast key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </aside>
  );
};

const SingleToast: React.FC<{ toast: ToastItem }> = ({ toast }) => {
  const isError = toast.type === 'error';

  const toneClasses = {
    success: 'border-emerald-200 dark:border-emerald-500/30 bg-white text-slate-800 shadow-raised',
    error: 'border-rose-300 dark:border-rose-500/40 bg-white text-slate-800 shadow-raised',
    info: 'border-indigo-200 dark:border-indigo-500/30 bg-white text-slate-800 shadow-raised',
  }[toast.type];

  const iconClasses = {
    success: 'text-emerald-600 dark:text-emerald-400',
    error: 'text-rose-600 dark:text-rose-400',
    info: 'text-indigo-600 dark:text-indigo-400',
  }[toast.type];

  const Icon = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
  }[toast.type];

  return (
    <m.div
      role={isError ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto flex items-start gap-3 p-3.5 rounded-card border text-sm transition',
        toneClasses
      )}
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', iconClasses)} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="font-semibold text-slate-900 leading-snug">{toast.title}</p>
        )}
        <p className="text-body text-slate-600 leading-snug">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        className="shrink-0 p-1 -mr-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition focus-visible:outline-none"
        aria-label="Dispensar notificação"
      >
        <X className="w-4 h-4" />
      </button>
    </m.div>
  );
};
