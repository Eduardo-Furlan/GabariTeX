import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../theme/useTheme';
import { cn } from './ui/cn';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { preference, setTheme } = useTheme();

  const handleToggle = () => {
    if (preference === 'light') {
      setTheme('dark');
    } else if (preference === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const getLabel = () => {
    switch (preference) {
      case 'light':
        return 'Tema Claro (mudar para Escuro)';
      case 'dark':
        return 'Tema Escuro (mudar para Sistema)';
      case 'system':
      default:
        return 'Tema do Sistema (mudar para Claro)';
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        'relative inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 shadow-2xs coarse:min-h-[44px] coarse:min-w-[44px]',
        className
      )}
      aria-label={getLabel()}
      title={getLabel()}
    >
      <div className="relative w-4 h-4 overflow-hidden flex items-center justify-center">
        <Sun
          className={cn(
            'w-4 h-4 text-amber-500 absolute transition-all duration-[220ms] ease-out',
            preference === 'light'
              ? 'opacity-100 rotate-0 scale-100'
              : 'opacity-0 -rotate-90 scale-75 pointer-events-none'
          )}
          aria-hidden="true"
        />
        <Moon
          className={cn(
            'w-4 h-4 text-indigo-400 absolute transition-all duration-[220ms] ease-out',
            preference === 'dark'
              ? 'opacity-100 rotate-0 scale-100'
              : 'opacity-0 90 scale-75 pointer-events-none'
          )}
          aria-hidden="true"
        />
        <Monitor
          className={cn(
            'w-4 h-4 text-slate-500 absolute transition-all duration-[220ms] ease-out',
            preference === 'system'
              ? 'opacity-100 rotate-0 scale-100'
              : 'opacity-0 scale-75 pointer-events-none'
          )}
          aria-hidden="true"
        />
      </div>
      <span className="sr-only">{getLabel()}</span>
    </button>
  );
};
