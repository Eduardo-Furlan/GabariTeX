import React from 'react';
import { cn } from './cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        'rounded-lg bg-slate-200/80 animate-shimmer select-none',
        className
      )}
      aria-hidden="true"
      {...props}
    />
  );
};
