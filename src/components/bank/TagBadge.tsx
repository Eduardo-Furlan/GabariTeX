import React from 'react';
import { TagColor } from '../../types/bank';
import { cn } from '../ui/cn';

export interface TagBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  color?: TagColor;
  count?: number;
  selected?: boolean;
  onRemove?: () => void;
}

export function getTagColorClasses(color: TagColor = 'slate', selected: boolean = false): {
  badge: string;
  dot: string;
} {
  switch (color) {
    case 'red':
      return {
        badge: selected
          ? 'bg-rose-600 text-on-accent border-rose-600'
          : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30',
        dot: selected ? 'bg-on-accent' : 'bg-rose-500',
      };
    case 'amber':
      return {
        badge: selected
          ? 'bg-amber-600 text-on-accent border-amber-600'
          : 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
        dot: selected ? 'bg-on-accent' : 'bg-amber-500',
      };
    case 'green':
      return {
        badge: selected
          ? 'bg-emerald-600 text-on-accent border-emerald-600'
          : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
        dot: selected ? 'bg-on-accent' : 'bg-emerald-500',
      };
    case 'teal':
      return {
        badge: selected
          ? 'bg-teal-600 text-on-accent border-teal-600'
          : 'bg-teal-50 dark:bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-500/30',
        dot: selected ? 'bg-on-accent' : 'bg-teal-500',
      };
    case 'blue':
      return {
        badge: selected
          ? 'bg-indigo-600 text-on-accent border-indigo-600'
          : 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30',
        dot: selected ? 'bg-on-accent' : 'bg-indigo-500',
      };
    case 'violet':
      return {
        badge: selected
          ? 'bg-violet-600 text-on-accent border-violet-600'
          : 'bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-500/30',
        dot: selected ? 'bg-on-accent' : 'bg-violet-500',
      };
    case 'pink':
      return {
        badge: selected
          ? 'bg-pink-600 text-on-accent border-pink-600'
          : 'bg-pink-50 dark:bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-500/30',
        dot: selected ? 'bg-on-accent' : 'bg-pink-500',
      };
    case 'slate':
    default:
      return {
        badge: selected
          ? 'bg-slate-700 text-slate-100 border-slate-700'
          : 'bg-slate-100 text-slate-700 border-slate-200',
        dot: selected ? 'bg-slate-300' : 'bg-slate-400',
      };
  }
}

export const TagBadge: React.FC<TagBadgeProps> = ({
  name,
  color = 'slate',
  count,
  selected = false,
  onRemove,
  className,
  ...props
}) => {
  const { badge, dot } = getTagColorClasses(color, selected);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-meta font-medium border select-none transition',
        badge,
        className
      )}
      {...props}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} aria-hidden="true" />
      <span className="truncate max-w-[140px]">{name}</span>
      {typeof count === 'number' && (
        <span className="opacity-70 text-[10px] tabular-nums font-semibold">{`(${count})`}</span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 -mr-1 p-0.5 rounded-full hover:bg-black/10 transition"
          aria-label={`Remover etiqueta ${name}`}
        >
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
};
