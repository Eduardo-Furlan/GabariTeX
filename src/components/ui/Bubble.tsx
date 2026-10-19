import React from 'react';
import { cn } from './cn';

export type BubbleState = 'empty' | 'filled' | 'correct' | 'wrong' | 'review';
export type BubbleSize = 'sm' | 'md' | 'lg';

export interface BubbleProps extends React.HTMLAttributes<HTMLSpanElement> {
  state?: BubbleState;
  size?: BubbleSize;
  label?: string;
}

export const Bubble: React.FC<BubbleProps> = ({
  state = 'empty',
  size = 'md',
  label,
  className,
  children,
  ...props
}) => {
  const sizeClasses = {
    sm: 'w-[18px] h-[18px] text-[10px]',
    md: 'w-6 h-6 text-xs',
    lg: 'w-8 h-8 text-sm',
  }[size];

  const stateClasses = {
    empty: 'border-2 border-slate-300 text-slate-700 bg-transparent',
    filled: 'border-2 border-indigo-600 bg-indigo-600 text-on-accent shadow-xs',
    correct: 'border-2 border-emerald-600 bg-emerald-600 text-on-accent shadow-xs',
    wrong: 'border-2 border-rose-600 bg-rose-600 text-on-accent shadow-xs',
    review: 'border-2 border-amber-500 bg-amber-500 text-on-accent shadow-xs',
  }[state];

  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={!label}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-bold select-none shrink-0 transition-all duration-[140ms]',
        sizeClasses,
        stateClasses,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
