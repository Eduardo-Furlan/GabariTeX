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
    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 bg-white text-body">
      <div className="flex items-center gap-2">
        <span className="font-bold text-slate-800 text-sm">
          {`Q${questionNumber}`}
        </span>

        {isEditingMax ? (
          <div className="flex items-center gap-1">
            <span className="text-slate-500 text-meta">(máx:</span>
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              className="w-12 px-1 py-0.5 font-mono text-meta text-center border border-indigo-400 rounded bg-slate-50 text-slate-800 tabular-nums"
              value={maxTextValue}
              onChange={(e) => setMaxTextValue(e.target.value)}
              onBlur={handleMaxBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleMaxBlur()}
            />
            <span className="text-slate-500 text-meta">)</span>
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onMaxPointsChange && setIsEditingMax(true)}
            className={`flex items-center gap-1 font-medium text-meta transition ${
              onMaxPointsChange
                ? 'text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer'
                : 'text-slate-500 cursor-default'
            }`}
            title={onMaxPointsChange ? 'Clique para ajustar a pontuação máxima desta dissertativa' : undefined}
          >
            <span className="tabular-nums">{`(máx ${formattedMax})`}</span>
            {onMaxPointsChange && <Pencil className="w-2.5 h-2.5 opacity-60" />}
          </button>
        )}

        {isPending ? (
          <span className="px-1.5 py-0.5 rounded text-meta font-semibold bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
            Pendente
          </span>
        ) : (
          <span className="px-1.5 py-0.5 rounded text-meta font-semibold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
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
          className="w-16 px-2 py-1 text-center font-mono font-bold text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 tabular-nums"
        />

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={disabled}
            onClick={handleSetZero}
            title="Atribuir nota 0"
            className="px-2 py-1 text-meta font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={handleSetMax}
            title={`Atribuir nota máxima (${formattedMax})`}
            className="px-2 py-1 text-meta font-semibold rounded bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 transition disabled:opacity-50"
          >
            Máx
          </button>
          {!isPending && (
            <button
              type="button"
              disabled={disabled}
              onClick={handleClear}
              title="Deixar pendente (em branco)"
              className="px-1.5 py-1 text-meta font-medium rounded text-slate-400 hover:text-slate-600 transition disabled:opacity-50"
            >
              Limpar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
