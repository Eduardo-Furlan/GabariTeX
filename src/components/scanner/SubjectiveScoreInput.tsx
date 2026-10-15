import React, { useState, useEffect } from 'react';

export interface SubjectiveScoreInputProps {
  questionNumber: number;
  maxPoints: number;
  pointsEarned: number | null;
  onChange: (score: number | null) => void;
  disabled?: boolean;
}

export const SubjectiveScoreInput: React.FC<SubjectiveScoreInputProps> = ({
  questionNumber,
  maxPoints,
  pointsEarned,
  onChange,
  disabled = false,
}) => {
  const formatValue = (val: number | null): string => {
    if (val === null || val === undefined) return '';
    return String(val).replace('.', ',');
  };

  const [textValue, setTextValue] = useState<string>(() => formatValue(pointsEarned));

  useEffect(() => {
    setTextValue(formatValue(pointsEarned));
  }, [pointsEarned]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTextValue(raw);

    const trimmed = raw.trim();
    if (trimmed === '') {
      onChange(null);
      return;
    }

    const normalized = trimmed.replace(',', '.');
    const parsed = parseFloat(normalized);
    if (!isNaN(parsed) && isFinite(parsed)) {
      const clamped = Math.min(maxPoints, Math.max(0, parsed));
      const rounded = Number(clamped.toFixed(2));
      onChange(rounded);
    }
  };

  const handleBlur = () => {
    // Ao perder o foco, normaliza o valor exibido
    setTextValue(formatValue(pointsEarned));
  };

  const handleSetZero = () => {
    setTextValue('0');
    onChange(0);
  };

  const handleSetMax = () => {
    const maxFormatted = formatValue(maxPoints);
    setTextValue(maxFormatted);
    onChange(maxPoints);
  };

  const handleClear = () => {
    setTextValue('');
    onChange(null);
  };

  const formattedMax = String(maxPoints).replace('.', ',');
  const isPending = pointsEarned === null;

  return (
    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-xs">
      <div className="flex items-center gap-2">
        <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
          Q{questionNumber}
        </span>
        <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">
          (máx {formattedMax})
        </span>
        {isPending ? (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Pendente
          </span>
        ) : (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Lançada
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <input
          type="text"
          inputMode="decimal"
          placeholder="Nota"
          disabled={disabled}
          value={textValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          className="w-16 px-2 py-1 text-center font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 disabled:opacity-50"
        />

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={disabled}
            onClick={handleSetZero}
            title="Atribuir nota 0"
            className="px-2 py-1 text-[11px] font-semibold rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={handleSetMax}
            title={`Atribuir nota máxima (${formattedMax})`}
            className="px-2 py-1 text-[11px] font-semibold rounded bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition disabled:opacity-50"
          >
            Máx
          </button>
          {!isPending && (
            <button
              type="button"
              disabled={disabled}
              onClick={handleClear}
              title="Deixar pendente (em branco)"
              className="px-1.5 py-1 text-[10px] font-medium rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition disabled:opacity-50"
            >
              Limpar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
