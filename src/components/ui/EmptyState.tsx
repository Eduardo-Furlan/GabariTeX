import React from 'react';
import { cn } from './cn';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  illustration?: React.ReactNode;
  title: string;
  description: string;
  actions?: React.ReactNode;
  className?: string;
}

export const BubbleGridIllustration: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg
      width="120"
      height="80"
      viewBox="0 0 120 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('text-slate-300 mx-auto', className)}
      aria-hidden="true"
    >
      <rect x="10" y="8" width="100" height="64" rx="8" fill="rgb(var(--slate-100))" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
      {/* 3 rows of bubbles */}
      {[24, 40, 56].map((y, rowIdx) => (
        <g key={y}>
          <text x="24" y={y + 4} fontSize="9" fontWeight="bold" fill="rgb(var(--slate-400))" fontFamily="system-ui">
            0{rowIdx + 1}
          </text>
          {[44, 60, 76, 92].map((x, colIdx) => {
            const isFilled = (rowIdx === 0 && colIdx === 1) || (rowIdx === 1 && colIdx === 2);
            return (
              <circle
                key={x}
                cx={x}
                cy={y}
                r={isFilled ? '5' : '4.5'}
                fill={isFilled ? 'rgb(var(--accent-600))' : 'transparent'}
                stroke={isFilled ? 'rgb(var(--accent-600))' : 'rgb(var(--slate-300))'}
                strokeWidth="1.5"
              />
            );
          })}
        </g>
      ))}
    </svg>
  );
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  illustration,
  title,
  description,
  actions,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-sheet border-2 border-dashed border-slate-200 bg-white max-w-lg mx-auto',
        className
      )}
    >
      <div className="mb-4">
        {illustration ? (
          illustration
        ) : icon ? (
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            {icon}
          </div>
        ) : (
          <BubbleGridIllustration />
        )}
      </div>

      <h3 className="font-display text-title font-semibold text-slate-900 leading-snug">
        {title}
      </h3>
      <p className="mt-1.5 text-body text-slate-500 max-w-sm leading-relaxed">
        {description}
      </p>

      {actions && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{actions}</div>}
    </div>
  );
};
