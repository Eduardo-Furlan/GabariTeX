import React, { useState, useRef } from 'react';
import {
  MoreVertical,
  Pencil,
  Copy,
  ArrowRightLeft,
  Archive,
  ArchiveRestore,
  Trash2,
  CheckCircle2,
  FileText,
  Layers,
} from 'lucide-react';
import { BankQuestion, BankTag } from '../../types/bank';
import { TagBadge } from './TagBadge';
import { MathView } from '../MathView';
import { Popover } from '../ui/Popover';
import { cn } from '../ui/cn';

export interface QuestionCardProps {
  question: BankQuestion;
  tagsById: Map<string, BankTag>;
  usageCount?: number;
  selected?: boolean;
  onToggleSelect?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onMove?: () => void;
  onArchiveToggle?: () => void;
  onDelete?: () => void;
  className?: string;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  tagsById,
  usageCount = 0,
  selected = false,
  onToggleSelect,
  onEdit,
  onDuplicate,
  onMove,
  onArchiveToggle,
  onDelete,
  className,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const isObjective = question.type === 'objective';
  const optionCount = isObjective ? question.options?.length ?? 0 : 0;
  const linesCount = !isObjective ? question.linesForAnswer ?? 5 : 0;

  return (
    <article
      className={cn(
        'group relative flex flex-col gap-2 p-3.5 rounded-xl border transition',
        selected
          ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-500/40 shadow-xs'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs',
        question.archived && 'opacity-65 bg-slate-50/70',
        className
      )}
      aria-label={`Questão: ${question.prompt.slice(0, 40)}`}
    >
      {/* Top row: Checkbox, Prompt Preview, Actions */}
      <div className="flex items-start gap-3">
        {onToggleSelect && (
          <label className="mt-0.5 inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              className="sr-only"
              aria-label="Selecionar questão"
            />
            <span
              className={cn(
                'w-4 h-4 rounded border flex items-center justify-center transition',
                selected
                  ? 'bg-indigo-600 border-indigo-600 text-on-accent'
                  : 'border-slate-300 bg-white hover:border-indigo-400'
              )}
            >
              {selected && (
                <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                  <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                </svg>
              )}
            </span>
          </label>
        )}

        {/* Prompt Preview */}
        <div className="flex-1 min-w-0">
          <div className="text-body font-medium text-slate-800 line-clamp-3 overflow-hidden select-text">
            <MathView content={question.prompt} />
          </div>
        </div>

        {/* Overflow Menu */}
        <div className="relative shrink-0">
          <button
            ref={menuBtnRef}
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Opções da questão"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          <Popover
            open={menuOpen}
            onOpenChange={setMenuOpen}
            anchorRef={menuBtnRef}
            align="end"
            className="w-44 p-1 bg-white border border-slate-200 rounded-xl shadow-overlay text-xs"
          >
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition text-left"
              >
                <Pencil className="w-3.5 h-3.5 text-slate-500" />
                <span>Editar</span>
              </button>
            )}

            {onDuplicate && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDuplicate();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition text-left"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Duplicar</span>
              </button>
            )}

            {onMove && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onMove();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition text-left"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
                <span>Mover para...</span>
              </button>
            )}

            {onArchiveToggle && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onArchiveToggle();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition text-left"
              >
                {question.archived ? (
                  <>
                    <ArchiveRestore className="w-3.5 h-3.5 text-slate-500" />
                    <span>Desarquivar</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-3.5 h-3.5 text-slate-500" />
                    <span>Arquivar</span>
                  </>
                )}
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition text-left"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Excluir</span>
              </button>
            )}
          </Popover>
        </div>
      </div>

      {/* Tags row */}
      {question.tagIds && question.tagIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pl-7">
          {question.tagIds.map((tid) => {
            const tag = tagsById.get(tid);
            if (!tag) return null;
            return <TagBadge key={tid} name={tag.name} color={tag.color} />;
          })}
        </div>
      )}

      {/* Meta Footer: Type, Options/Lines, Points, Usage, Archived */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 pl-7 text-[11px] text-slate-500">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
            {isObjective ? (
              <>
                <Layers className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                <span>{`Objetiva (${optionCount} alt.)`}</span>
              </>
            ) : (
              <>
                <FileText className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                <span>{`Dissertativa (${linesCount} lin.)`}</span>
              </>
            )}
          </span>

          <span className="text-slate-300">•</span>

          <span className="font-semibold text-slate-600 tabular-nums">
            {question.points === 1 ? '1 pt' : `${question.points} pts`}
          </span>

          {question.archived && (
            <>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                Arquivada
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border',
              usageCount > 0
                ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                : 'bg-slate-50 text-slate-400 border-slate-200'
            )}
            title={
              usageCount > 0
                ? `Utilizada em ${usageCount} ${usageCount === 1 ? 'prova' : 'provas'}`
                : 'Nunca utilizada em provas geradas ou salvas'
            }
          >
            {usageCount > 0 && <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />}
            <span>
              {usageCount === 0
                ? 'Nunca usada'
                : `Usada em ${usageCount} ${usageCount === 1 ? 'prova' : 'provas'}`}
            </span>
          </span>
        </div>
      </div>
    </article>
  );
};
