import React from 'react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from './cn';

export interface AlertProps {
  tone?: 'info' | 'warn' | 'danger' | 'success';
  title?: string;
  action?: React.ReactNode;
  onClose?: () => void;
  className?: string;
  children: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = ({
  tone = 'info',
  title,
  action,
  onClose,
  className,
  children,
}) => {
  const isError = tone === 'danger';

  const toneClasses = {
    info: 'border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-500/10 text-indigo-900 dark:text-indigo-200',
    warn: 'border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200',
    danger: 'border-rose-200 dark:border-rose-500/30 bg-rose-50/70 dark:bg-rose-500/10 text-rose-900 dark:text-rose-200',
    success: 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
  }[tone];

  const iconClasses = {
    info: 'text-indigo-600 dark:text-indigo-400',
    warn: 'text-amber-600 dark:text-amber-400',
    danger: 'text-rose-600 dark:text-rose-400',
    success: 'text-emerald-600 dark:text-emerald-400',
  }[tone];

  const Icon = {
    info: Info,
    warn: AlertTriangle,
    danger: AlertCircle,
    success: CheckCircle2,
  }[tone];

  return (
    <AnimatePresence>
      <m.div
        role={isError ? 'alert' : 'status'}
        className={cn('flex items-start gap-3 p-3.5 rounded-card border text-sm', toneClasses, className)}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.16 }}
      >
        <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', iconClasses)} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          {title && <p className="font-semibold leading-snug mb-0.5">{title}</p>}
          <div className="text-body leading-relaxed">{children}</div>
          {action && <div className="mt-2">{action}</div>}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition focus-visible:outline-none"
            aria-label="Fechar alerta"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </m.div>
    </AnimatePresence>
  );
};
