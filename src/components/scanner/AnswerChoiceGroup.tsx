import React from 'react';
import { ManualChoice } from '../../utils/grading';
import { OptionLabel } from '../../types/exam';

interface AnswerChoiceGroupProps {
  value: ManualChoice;
  onChange: (choice: ManualChoice) => void;
  options?: OptionLabel[];
  size?: 'sm' | 'md';
  disabled?: boolean;
}

const DEFAULT_OPTIONS: OptionLabel[] = ['A', 'B', 'C', 'D', 'E'];

export const AnswerChoiceGroup: React.FC<AnswerChoiceGroupProps> = ({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  size = 'md',
  disabled = false,
}) => {
  const isSm = size === 'sm';

  const letterBtnClass = (opt: OptionLabel) => {
    const isSelected = value === opt;
    if (isSelected) {
      return 'bg-indigo-600 text-on-accent font-bold shadow-sm';
    }
    return 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 font-semibold';
  };

  const blankBtnClass = () => {
    const isSelected = value === 'BLANK';
    if (isSelected) {
      return 'bg-amber-600 text-on-accent font-bold shadow-sm';
    }
    return 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700';
  };

  const invalidBtnClass = () => {
    const isSelected = value === 'INVALID';
    if (isSelected) {
      return 'bg-purple-600 text-on-accent font-bold shadow-sm';
    }
    return 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700';
  };

  return (
    <div
      role="radiogroup"
      aria-label="Opções de resposta"
      className="inline-flex items-center gap-1 flex-wrap"
    >
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="radio"
          aria-checked={value === opt}
          disabled={disabled}
          onClick={() => onChange(opt)}
          className={`rounded transition text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 shrink-0 ${
            isSm
              ? 'w-6 h-6 text-xs'
              : 'min-w-[32px] sm:min-w-[36px] h-8 sm:h-9 text-xs sm:text-sm font-semibold'
          } ${letterBtnClass(opt)}`}
        >
          {opt}
        </button>
      ))}

      <button
        type="button"
        role="radio"
        aria-checked={value === 'BLANK'}
        disabled={disabled}
        onClick={() => onChange('BLANK')}
        title="Marcar como Em Branco"
        className={`rounded transition text-center focus:outline-none focus:ring-1 focus:ring-amber-500 shrink-0 ${
          isSm
            ? 'px-1.5 h-6 text-[10px]'
            : 'px-2.5 h-8 sm:h-9 text-xs font-medium'
        } ${blankBtnClass()}`}
      >
        Branco
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={value === 'INVALID'}
        disabled={disabled}
        onClick={() => onChange('INVALID')}
        title="Marcar como Rasura ou Dupla Marcação"
        className={`rounded transition text-center focus:outline-none focus:ring-1 focus:ring-purple-500 shrink-0 ${
          isSm
            ? 'px-1.5 h-6 text-[10px]'
            : 'px-2.5 h-8 sm:h-9 text-xs font-medium'
        } ${invalidBtnClass()}`}
      >
        Inválida
      </button>
    </div>
  );
};

