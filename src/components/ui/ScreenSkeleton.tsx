import React from 'react';
import { Skeleton } from './Skeleton';
import { cn } from './cn';

export const ScreenSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      role="status"
      aria-label="Carregando tela..."
      className={cn('max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6', className)}
    >
      {/* Title bar placeholder */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 sm:w-64" />
          <Skeleton className="h-4 w-32 sm:w-40" />
        </div>
        <Skeleton className="h-10 w-28 sm:w-36 rounded-lg" />
      </div>

      {/* 3 card blocks placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="p-5 rounded-card border border-slate-200 bg-white space-y-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="pt-2 flex justify-between items-center">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
        <div className="p-5 rounded-card border border-slate-200 bg-white space-y-4">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="pt-2 flex justify-between items-center">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
        <div className="p-5 rounded-card border border-slate-200 bg-white space-y-4 md:col-span-2 lg:col-span-1">
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
          <div className="pt-2 flex justify-between items-center">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
};
