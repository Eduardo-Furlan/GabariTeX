import React, { forwardRef } from 'react';
import { cn } from './cn';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'danger' | 'accent' | 'ghost';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      label,
      size = 'md',
      tone = 'default',
      type = 'button',
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: 'w-8 h-8 rounded-lg text-xs coarse:min-h-[44px] coarse:min-w-[44px]',
      md: 'w-9 h-9 rounded-lg text-sm coarse:min-h-[44px] coarse:min-w-[44px]',
      lg: 'w-10 h-10 rounded-lg text-base coarse:min-h-[44px] coarse:min-w-[44px]',
    }[size];

    const toneClasses = {
      default:
        'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent active:bg-slate-200',
      danger:
        'text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10 active:bg-rose-100 dark:active:bg-rose-500/20',
      accent:
        'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/15 active:bg-indigo-100',
      ghost:
        'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 active:bg-slate-100',
    }[tone];

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex items-center justify-center transition-all duration-[90ms] active:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 focus-visible:outline-none',
          sizeClasses,
          toneClasses,
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
