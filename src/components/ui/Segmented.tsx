import React, { useRef } from 'react';
import * as m from 'motion/react-m';
import { cn } from './cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  options: (SegmentedOption<T> | T)[];
  value: T;
  onChange: (value: T) => void;
  layoutId?: string;
  className?: string;
  size?: 'sm' | 'md';
  'aria-label'?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  layoutId = 'segmented-pill',
  className,
  size = 'md',
  'aria-label': ariaLabel,
}: SegmentedProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizedOptions: SegmentedOption<T>[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (index + 1) % normalizedOptions.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (index - 1 + normalizedOptions.length) % normalizedOptions.length;
    }

    if (nextIndex !== index) {
      const nextOpt = normalizedOptions[nextIndex];
      if (!nextOpt.disabled) {
        onChange(nextOpt.value);
        const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('button[role="radio"]');
        buttons?.[nextIndex]?.focus();
      }
    }
  };

  const sizeClasses = {
    sm: 'min-h-8 p-0.5 text-xs',
    md: 'min-h-9 p-1 text-sm',
  }[size];

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center rounded-lg bg-slate-100 border border-slate-200 select-none max-w-full overflow-x-auto scrollbar-none',
        sizeClasses,
        className
      )}
    >
      {normalizedOptions.map((opt, idx) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              'relative flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-1 font-medium rounded-md transition-colors duration-150 whitespace-nowrap shrink-0',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              isSelected
                ? 'text-slate-900 font-semibold'
                : 'text-slate-600 hover:text-slate-900',
              opt.disabled && 'opacity-40 cursor-not-allowed'
            )}
          >
            {isSelected && (
              <m.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-md bg-white shadow-2xs border border-slate-200/60"
                transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }}
                aria-hidden="true"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap">
              {opt.icon && <span className="shrink-0">{opt.icon}</span>}
              <span className="whitespace-nowrap">{opt.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
