import React, { forwardRef } from 'react';
import { cn } from './cn';

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'default' | 'raised' | 'inset' | 'accent';
  rail?: boolean;
  as?: React.ElementType;
}

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  (
    {
      tone = 'default',
      rail = false,
      as: Component = 'div',
      className,
      children,
      ...props
    },
    ref
  ) => {
    const toneClasses = {
      default: 'bg-white border-slate-200 shadow-2xs',
      raised: 'bg-white border-slate-200 shadow-raised',
      inset: 'bg-slate-50 border-slate-200 shadow-inner',
      accent: 'bg-indigo-50/50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30',
    }[tone];

    return (
      <Component
        ref={ref}
        className={cn(
          'relative rounded-card border transition',
          toneClasses,
          rail && 'border-l-[3px] border-l-indigo-600 dark:border-l-indigo-400',
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Surface.displayName = 'Surface';
