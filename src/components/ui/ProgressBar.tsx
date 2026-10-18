import React from 'react';
import { cn } from './cn';

export interface ProgressBarProps {
  value?: number; // 0 to 100
  max?: number;
  tone?: 'accent' | 'neutral' | 'ok' | 'warn' | 'danger';
  indeterminate?: boolean;
  className?: string;
  'aria-label'?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value = 0,
  max = 100,
  tone = 'accent',
  indeterminate = false,
  className,
  'aria-label': ariaLabel,
}) => {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));

  const toneClasses = {
    accent: 'bg-indigo-600 dark:bg-indigo-400',
    neutral: 'bg-slate-600',
    ok: 'bg-emerald-600 dark:bg-emerald-400',
    warn: 'bg-amber-500 dark:bg-amber-400',
    danger: 'bg-rose-600 dark:bg-rose-400',
  }[tone];

  return (
    <div
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={ariaLabel}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-200 select-none', className)}
    >
      <div
        className={cn(
          'h-full w-full rounded-full origin-left transition-transform duration-[600ms] ease-out',
          toneClasses,
          indeterminate && 'animate-shimmer origin-left'
        )}
        style={{
          transform: indeterminate ? undefined : `scaleX(${percent / 100})`,
        }}
      />
    </div>
  );
};
