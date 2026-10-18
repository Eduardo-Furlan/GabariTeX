import React from 'react';
import { cn } from './cn';

export interface BubbleLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  'aria-label'?: string;
}

export const BubbleLoader: React.FC<BubbleLoaderProps> = ({
  size = 'md',
  className,
  'aria-label': ariaLabel = 'Carregando...',
}) => {
  const dotSize = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  }[size];

  const delays = ['0ms', '140ms', '280ms', '420ms', '560ms'];

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      className={cn('inline-flex items-center gap-2', className)}
    >
      {delays.map((delay, i) => (
        <span
          key={i}
          style={{ animationDelay: delay }}
          className={cn(
            'rounded-full bg-indigo-600 dark:bg-indigo-400 shrink-0 [animation:bubble-loader_1.2s_infinite_ease-in-out]',
            dotSize
          )}
          aria-hidden="true"
        />
      ))}
    </div>
  );
};
