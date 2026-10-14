import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../theme/useTheme';

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
      className={`inline-flex items-center justify-center p-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}
      aria-label={getLabel()}
      title={getLabel()}
    >
      {preference === 'light' && <Sun className="w-4 h-4 text-amber-500" />}
      {preference === 'dark' && <Moon className="w-4 h-4 text-indigo-400" />}
      {preference === 'system' && <Monitor className="w-4 h-4 text-slate-500" />}
      <span className="sr-only">{getLabel()}</span>
    </button>
  );
};

