import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      loading = false,
      icon,
      iconRight,
      disabled,
      type = 'button',
      className,
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center font-medium select-none focus-visible:outline-none transition-all duration-[90ms] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100';

    const sizeClasses = {
      sm: 'h-8 px-2.5 text-xs gap-1.5 rounded-lg coarse:min-h-[44px]',
      md: 'h-9 px-3.5 text-sm gap-2 rounded-lg coarse:min-h-[44px]',
      lg: 'h-11 px-5 text-base gap-2.5 rounded-lg coarse:min-h-[44px]',
    }[size];

    const variantClasses = {
      primary:
        'bg-indigo-600 hover:bg-indigo-700 text-on-accent shadow-xs active:bg-indigo-800',
      secondary:
        'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs active:bg-slate-200',
      ghost:
        'text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200',
      danger:
        'bg-rose-600 hover:bg-rose-700 text-on-accent shadow-xs active:bg-rose-800',
      soft:
        'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/25',
    }[variant];

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading ? 'true' : undefined}
        className={cn(baseClasses, sizeClasses, variantClasses, className)}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
        ) : (
          icon && <span className="shrink-0" aria-hidden="true">{icon}</span>
        )}
        {children && <span>{children}</span>}
        {!loading && iconRight && (
          <span className="shrink-0" aria-hidden="true">{iconRight}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
