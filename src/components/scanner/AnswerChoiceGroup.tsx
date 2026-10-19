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

  return (
    <div
      role="radiogroup"
      aria-label="Opções de resposta"
      className="inline-flex items-center gap-1.5 flex-wrap"
    >
      {options.map((opt) => {
        const isSelected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={`rounded-full transition flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 shrink-0 select-none ${
              isSm
                ? 'w-7 h-7 text-xs coarse:w-9 coarse:h-9'
                : 'w-8 sm:w-9 h-8 sm:h-9 text-xs sm:text-sm font-bold coarse:w-11 coarse:h-11'
            } ${
              isSelected
                ? 'bg-indigo-600 text-on-accent shadow-xs scale-105'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200'
            } disabled:opacity-50 disabled:pointer-events-none`}
            title={`Alternativa ${opt}`}
          >
            <span className="relative z-10 font-bold">{opt}</span>
          </button>
        );
      })}

      <button
        type="button"
        role="radio"
        aria-checked={value === 'BLANK'}
        disabled={disabled}
        onClick={() => onChange('BLANK')}
        title="Marcar como Em Branco"
        className={`rounded-lg transition flex items-center justify-center font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 shrink-0 ${
          isSm
            ? 'px-2 h-7 text-[10px] coarse:h-9'
            : 'px-2.5 h-8 sm:h-9 text-xs coarse:h-11'
        } ${
          value === 'BLANK'
            ? 'bg-amber-600 text-on-accent font-bold shadow-xs'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200'
        } disabled:opacity-50 disabled:pointer-events-none`}
      >
        <span>Branco</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={value === 'INVALID'}
        disabled={disabled}
        onClick={() => onChange('INVALID')}
        title="Marcar como Rasura ou Dupla Marcação"
        className={`rounded-lg transition flex items-center justify-center font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 shrink-0 ${
          isSm
            ? 'px-2 h-7 text-[10px] coarse:h-9'
            : 'px-2.5 h-8 sm:h-9 text-xs coarse:h-11'
        } ${
          value === 'INVALID'
            ? 'bg-purple-600 text-on-accent font-bold shadow-xs'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200'
        } disabled:opacity-50 disabled:pointer-events-none`}
      >
        <span>Rasura</span>
      </button>
    </div>
  );
};
