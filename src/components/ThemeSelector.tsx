import React, { useRef } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../theme/useTheme';
import { ThemePreference } from '../theme/theme';

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
      className={`grid grid-cols-3 gap-1.5 ${className}`}
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
            className={`min-h-[36px] px-2 py-1.5 rounded-lg border text-xs flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isSelected
                ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30 font-bold shadow-sm'
                : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Icon
              className={`w-3.5 h-3.5 shrink-0 ${
                isSelected ? 'text-current' : opt.inactiveColor
              }`}
            />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};

