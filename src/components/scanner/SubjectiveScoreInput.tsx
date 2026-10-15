import React, { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';

export interface SubjectiveScoreInputProps {
  questionNumber: number;
  maxPoints: number;
  pointsEarned: number | null;
  onChange: (score: number | null) => void;
  onMaxPointsChange?: (newMax: number) => void;
  disabled?: boolean;
}

export const SubjectiveScoreInput: React.FC<SubjectiveScoreInputProps> = ({
  questionNumber,
  maxPoints,
  pointsEarned,
  onChange,
  onMaxPointsChange,
  disabled = false,
}) => {
  const formatValue = (val: number | null): string => {
    if (val === null || val === undefined) return '';
    return String(val).replace('.', ',');
  };

  const [textValue, setTextValue] = useState<string>(() => formatValue(pointsEarned));
  const [isEditingMax, setIsEditingMax] = useState<boolean>(false);
  const [maxTextValue, setMaxTextValue] = useState<string>(() => formatValue(maxPoints));

  useEffect(() => {
    setTextValue(formatValue(pointsEarned));
  }, [pointsEarned]);

  useEffect(() => {
    setMaxTextValue(formatValue(maxPoints));
  }, [maxPoints]);

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
    setTextValue(formatValue(pointsEarned));
  };

  const handleMaxBlur = () => {
    setIsEditingMax(false);
    const parsed = parseFloat(maxTextValue.trim().replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0 && onMaxPointsChange) {
      const rounded = Number(parsed.toFixed(2));
      onMaxPointsChange(rounded);
    } else {
      setMaxTextValue(formatValue(maxPoints));
    }
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
    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 bg-white text-xs">
      <div className="flex items-center gap-2">
        <span className="font-bold text-slate-800 text-sm">
          Q{questionNumber}
        </span>

        {isEditingMax ? (
          <div className="flex items-center gap-1">
            <span className="text-slate-500 text-[11px]">(máx:</span>
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              className="w-12 px-1 py-0.5 font-mono text-[11px] text-center border border-indigo-400 rounded bg-slate-50 text-slate-800"
              value={maxTextValue}
              onChange={(e) => setMaxTextValue(e.target.value)}
              onBlur={handleMaxBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleMaxBlur()}
            />
            <span className="text-slate-500 text-[11px]">)</span>
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onMaxPointsChange && setIsEditingMax(true)}
            className={`flex items-center gap-1 font-medium text-[11px] transition ${
              onMaxPointsChange
                ? 'text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer'
                : 'text-slate-500 cursor-default'
            }`}
            title={onMaxPointsChange ? 'Clique para ajustar a pontuação máxima desta dissertativa' : undefined}
          >
            <span>(máx {formattedMax})</span>
            {onMaxPointsChange && <Pencil className="w-2.5 h-2.5 opacity-60" />}
          </button>
        )}

        {isPending ? (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70">
            Pendente
          </span>
        ) : (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70">
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
          className="w-16 px-2 py-1 text-center font-mono font-bold text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 disabled:opacity-50"
        />

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={disabled}
            onClick={handleSetZero}
            title="Atribuir nota 0"
            className="px-2 py-1 text-[11px] font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={handleSetMax}
            title={`Atribuir nota máxima (${formattedMax})`}
            className="px-2 py-1 text-[11px] font-semibold rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/70 dark:hover:bg-indigo-900/80 dark:text-indigo-300 dark:border-indigo-800/70 transition disabled:opacity-50"
          >
            Máx
          </button>
          {!isPending && (
            <button
              type="button"
              disabled={disabled}
              onClick={handleClear}
              title="Deixar pendente (em branco)"
              className="px-1.5 py-1 text-[10px] font-medium rounded text-slate-400 hover:text-slate-600 transition disabled:opacity-50"
            >
              Limpar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
