import React, { useRef } from 'react';
import * as m from 'motion/react-m';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../theme/useTheme';
import { ThemePreference } from '../theme/theme';
import { cn } from './ui/cn';

interface ThemeOption {
  value: ThemePreference;
  label: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  inactiveColor: string;
}

const OPTIONS: ThemeOption[] = [
  {
    value: 'light',
    label: 'Claro',
    title: 'Tema claro',
    icon: Sun,
    inactiveColor: 'text-amber-500',
  },
  {
    value: 'dark',
    label: 'Escuro',
    title: 'Tema escuro',
    icon: Moon,
    inactiveColor: 'text-indigo-400',
  },
  {
    value: 'system',
    label: 'Sistema',
    title: 'Seguir o tema do sistema',
    icon: Monitor,
    inactiveColor: 'text-slate-500',
  },
];

export const ThemeSelector: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { preference, setTheme } = useTheme();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (index + 1) % OPTIONS.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (index - 1 + OPTIONS.length) % OPTIONS.length;
    }

    if (nextIndex !== -1) {
      const nextOption = OPTIONS[nextIndex];
      setTheme(nextOption.value);
      buttonRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Tema visual"
      className={cn(
        'grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 select-none',
        className
      )}
    >
      {OPTIONS.map((opt, index) => {
        const isSelected = preference === opt.value;
        const Icon = opt.icon;

        return (
          <button
            key={opt.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            title={opt.title}
            onClick={() => setTheme(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              'relative min-h-[34px] px-2 py-1 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              isSelected
                ? 'text-slate-900 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            {isSelected && (
              <m.span
                layoutId="theme-selector-pill"
                className="absolute inset-0 rounded-md bg-white shadow-2xs border border-slate-200/60"
                transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }}
                aria-hidden="true"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Icon
                className={cn(
                  'w-3.5 h-3.5 shrink-0',
                  isSelected ? 'text-indigo-600 dark:text-indigo-400' : opt.inactiveColor
                )}
              />
              <span>{opt.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};
