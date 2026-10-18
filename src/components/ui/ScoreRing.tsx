import React from 'react';
import { cn } from './cn';

export interface ScoreRingProps {
  percent: number;
  tone?: 'accent' | 'ok' | 'warn' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  strokeWidth?: number;
  className?: string;
  children?: React.ReactNode;
}

export const ScoreRing: React.FC<ScoreRingProps> = ({
  percent,
  tone = 'accent',
  size = 'md',
  strokeWidth,
  className,
  children,
}) => {
  const pixelSize = {
    sm: 48,
    md: 72,
    lg: 96,
  }[size];

  const stroke = strokeWidth ?? (size === 'sm' ? 4 : size === 'md' ? 6 : 8);
  const radius = (pixelSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clampedPercent / 100) * circumference;

  const strokeColors = {
    accent: 'text-indigo-600 dark:text-indigo-400',
    ok: 'text-emerald-600 dark:text-emerald-400',
    warn: 'text-amber-500 dark:text-amber-400',
    danger: 'text-rose-600 dark:text-rose-400',
  }[tone];

  return (
    <div
      className={cn('relative inline-flex items-center justify-center select-none', className)}
      style={{ width: pixelSize, height: pixelSize }}
    >
      <svg
        width={pixelSize}
        height={pixelSize}
        className="-rotate-90 transform"
        aria-hidden="true"
      >
        <circle
          cx={pixelSize / 2}
          cy={pixelSize / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="transparent"
          className="text-slate-200"
        />
        <circle
          cx={pixelSize / 2}
          cy={pixelSize / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          className={cn('transition-[stroke-dashoffset] duration-[700ms] ease-out', strokeColors)}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
};
