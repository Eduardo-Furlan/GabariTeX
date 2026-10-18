import React, { forwardRef } from 'react';
import { cn } from './cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ tone = 'neutral', dot = false, className, children, ...props }, ref) => {
    const toneClasses = {
      neutral:
        'bg-slate-100 text-slate-700 border-slate-200',
      accent:
        'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30',
      ok:
        'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
      warn:
        'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
      danger:
        'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30',
    }[tone];

    const dotClasses = {
      neutral: 'bg-slate-400',
      accent: 'bg-indigo-600 dark:bg-indigo-400',
      ok: 'bg-emerald-600 dark:bg-emerald-400',
      warn: 'bg-amber-600 dark:bg-amber-400',
      danger: 'bg-rose-600 dark:bg-rose-400',
    }[tone];

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-meta font-medium border select-none',
          toneClasses,
          className
        )}
        {...props}
      >
        {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotClasses)} aria-hidden="true" />}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
