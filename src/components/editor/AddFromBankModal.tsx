import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Check,
  Tags,
  Filter,
  X,
  Layers,
  FileText,
} from 'lucide-react';
import { BankTag, QuestionType } from '../../types/bank';
import { Question } from '../../types/exam';
import { useBank } from '../../context/BankContext';
import { toExamQuestion } from '../../utils/bank/questions';
import { descendantIds, pathOf } from '../../utils/bank/tree';
import { MAX_QUESTIONS } from '../../utils/examLimits';
import { Modal } from '../ui/Modal';
import { MathView } from '../MathView';
import { TagBadge } from '../bank/TagBadge';
import { Select } from '../ui/Select';
import { cn } from '../ui/cn';

export interface AddFromBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentQuestions: readonly Question[];
  onImport: (questionsToImport: Question[]) => number;
}

export const AddFromBankModal: React.FC<AddFromBankModalProps> = ({
  isOpen,
  onClose,
  currentQuestions,
  onImport,
}) => {
  const {
    ensureLoaded,
    groups,
    tags,
    questions,
  } = useBank();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null | 'all'>('all');
  const [includeSubgroups, setIncludeSubgroups] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<'all' | QuestionType>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedBankIds, setSelectedBankIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      ensureLoaded();
      setSelectedGroupId('all');
      setIncludeSubgroups(true);
      setSearchQuery('');
      setSelectedTagIds(new Set());
      setTypeFilter('all');
      setShowArchived(false);
      setSelectedBankIds(new Set());
    }
  }, [isOpen, ensureLoaded]);

  // Set of bank question IDs already referenced in the open exam
  const existingSourceIds = useMemo(() => {
    const set = new Set<string>();
    for (const q of currentQuestions) {
      if (q.sourceQuestionId) {
        set.add(q.sourceQuestionId);
      }
    }
    return set;
  }, [currentQuestions]);

  const availableSlots = Math.max(0, MAX_QUESTIONS - currentQuestions.length);

  const tagsById = useMemo(() => {
    return new Map<string, BankTag>(tags.map((t) => [t.id, t]));
  }, [tags]);

  // Group scope matching
  const groupScopeIds = useMemo(() => {
    if (selectedGroupId === 'all') return null;
    if (selectedGroupId === null) return new Set<string | null>([null]);

    if (!includeSubgroups) {
      return new Set<string | null>([selectedGroupId]);
    }

    const descendants = descendantIds(groups, selectedGroupId);
    descendants.add(selectedGroupId);
    return descendants as Set<string | null>;
  }, [selectedGroupId, groups, includeSubgroups]);

  // Filtered bank questions
  const filteredQuestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return questions.filter((q) => {
      // Group scope
      if (groupScopeIds && !groupScopeIds.has(q.groupId ?? null)) {
        return false;
      }

      // Archived
      if (!showArchived && q.archived) {
        return false;
      }

      // Type
      if (typeFilter !== 'all' && q.type !== typeFilter) {
        return false;
      }

      // Tags (must have all selected tags)
      if (selectedTagIds.size > 0) {
        const qTags = q.tagIds ?? [];
        for (const reqTag of selectedTagIds) {
          if (!qTags.includes(reqTag)) return false;
        }
      }

      // Search
      if (query.length > 0) {
        if (!q.prompt.toLowerCase().includes(query)) return false;
      }

      return true;
    });
  }, [questions, groupScopeIds, showArchived, typeFilter, selectedTagIds, searchQuery]);

  const toggleSelectQuestion = (id: string) => {
    setSelectedBankIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size < availableSlots) {
          next.add(id);
        }
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const selectable = filteredQuestions.filter(
      (q) => !selectedBankIds.has(q.id)
    );
    const slotsRemaining = availableSlots - selectedBankIds.size;
    if (slotsRemaining <= 0) return;

    const toAdd = selectable.slice(0, slotsRemaining).map((q) => q.id);
    setSelectedBankIds((prev) => new Set([...prev, ...toAdd]));
  };

  const handleClearSelection = () => {
    setSelectedBankIds(new Set());
  };

  const handleConfirmImport = () => {
    if (selectedBankIds.size === 0) return;

    const chosenBankQuestions = questions.filter((q) => selectedBankIds.has(q.id));
    const examQuestions: Question[] = chosenBankQuestions.map((bq) => toExamQuestion(bq));

    onImport(examQuestions);
    onClose();
  };

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  const groupOptions = useMemo(() => {
    const opts = [
      { value: 'all', label: 'Todos os Grupos' },
      { value: '__orphan__', label: 'Sem Grupo (Raiz)' },
    ];
    for (const g of groups) {
      opts.push({
        value: g.id,
        label: pathOf(groups, g.id),
      });
    }
    return opts;
  }, [groups]);

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Adicionar Questões do Banco"
      description="Selecione questões do seu banco para inseri-las diretamente nesta prova."
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full flex-wrap gap-2">
          <div className="text-xs text-slate-600">
            <span className="font-semibold tabular-nums text-slate-900">
              {selectedBankIds.size}
            </span>{' '}
            {selectedBankIds.size === 1 ? 'questão selecionada' : 'questões selecionadas'}
            <span className="mx-1.5 text-slate-300">•</span>
            <span>
              Restam{' '}
              <strong className="text-slate-900 tabular-nums">
                {Math.max(0, availableSlots - selectedBankIds.size)}
              </strong>{' '}
              vagas na prova
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-medium transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={selectedBankIds.size === 0}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-on-accent text-sm font-semibold shadow-xs disabled:opacity-50 transition"
            >
              Adicionar à Prova ({selectedBankIds.size})
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3 py-1">
        {/* Search & Group Filter Bar */}
        <div className="flex flex-col gap-2.5 p-3 rounded-xl border border-slate-200 bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar no enunciado..."
                className="w-full pl-9 pr-7 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Group Selector */}
            <div className="flex items-center gap-2">
              <Select
                size="sm"
                value={
                  selectedGroupId === 'all'
                    ? 'all'
                    : selectedGroupId === null
                    ? '__orphan__'
                    : selectedGroupId
                }
                onChange={(val) => {
                  if (val === 'all') setSelectedGroupId('all');
                  else if (val === '__orphan__') setSelectedGroupId(null);
                  else setSelectedGroupId(val);
                }}
                options={groupOptions}
                className="flex-1"
              />

              {typeof selectedGroupId === 'string' && selectedGroupId !== 'all' && (
                <label className="inline-flex items-center gap-1 text-[11px] text-slate-600 shrink-0 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeSubgroups}
                    onChange={(e) => setIncludeSubgroups(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Subgrupos</span>
                </label>
              )}
            </div>
          </div>

          {/* Tags Filter Row */}
          {tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100 text-xs">
              <span className="text-meta font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Tags className="w-3 h-3" />
                <span>Etiquetas:</span>
              </span>
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTagFilter(tag.id)}
                  className="focus-visible:outline-none rounded-full"
                >
                  <TagBadge
                    name={tag.name}
                    color={tag.color}
                    selected={selectedTagIds.has(tag.id)}
                  />
                </button>
              ))}
            </div>
          )}

          {/* Type Filter & Archived Toggle */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-100 text-xs">
            <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-medium transition',
                  typeFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('objective')}
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-medium transition',
                  typeFilter === 'objective'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Objetivas
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('subjective')}
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-medium transition',
                  typeFilter === 'subjective'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Dissertativas
              </button>
            </div>

            <label className="inline-flex items-center gap-1.5 text-slate-600 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Mostrar arquivadas</span>
            </label>
          </div>
        </div>

        {/* Selection actions & counter */}
        <div className="flex items-center justify-between px-1 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              disabled={selectedBankIds.size >= availableSlots}
              className="text-indigo-600 hover:underline font-medium disabled:opacity-50"
            >
              Selecionar filtradas
            </button>
            {selectedBankIds.size > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-slate-500 hover:text-slate-700"
                >
                  Limpar seleção
                </button>
              </>
            )}
          </div>

          <span className="tabular-nums">
            {filteredQuestions.length}{' '}
            {filteredQuestions.length === 1 ? 'questão encontrada' : 'questões encontradas'}
          </span>
        </div>

        {/* Question Items List */}
        <div className="flex flex-col gap-2 max-h-[46vh] overflow-y-auto pr-1">
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <Filter className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-slate-700">
                Nenhuma questão encontrada no banco
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Altere os termos de busca ou filtros de grupo/etiqueta.
              </p>
            </div>
          ) : (
            filteredQuestions.map((q) => {
              const isSelected = selectedBankIds.has(q.id);
              const isAlreadyInExam = existingSourceIds.has(q.id);
              const isLimitReached = !isSelected && selectedBankIds.size >= availableSlots;

              return (
                <div
                  key={q.id}
                  onClick={() => {
                    if (!isLimitReached) {
                      toggleSelectQuestion(q.id);
                    }
                  }}
                  className={cn(
                    'p-3 rounded-xl border text-xs transition flex items-start gap-3 select-none',
                    isSelected
                      ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 cursor-pointer shadow-xs'
                      : isLimitReached
                      ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 cursor-pointer'
                  )}
                >
                  {/* Checkbox indicator */}
                  <div
                    className={cn(
                      'mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition',
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-on-accent'
                        : 'border-slate-300 bg-white'
                    )}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                  </div>

                  {/* Question details */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-800 flex items-center gap-1">
                          {q.type === 'objective' ? (
                            <>
                              <Layers className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                              <span>Objetiva ({q.options?.length ?? 0} alt.)</span>
                            </>
                          ) : (
                            <>
                              <FileText className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                              <span>Dissertativa ({q.linesForAnswer ?? 5} lin.)</span>
                            </>
                          )}
                        </span>

                        {isAlreadyInExam && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                            Já na Prova
                          </span>
                        )}

                        {q.archived && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            Arquivada
                          </span>
                        )}
                      </div>

                      <span className="font-semibold text-slate-600 tabular-nums text-meta">
                        {q.points === 1 ? '1 pt' : `${q.points} pts`}
                      </span>
                    </div>

                    <div className="text-slate-700 line-clamp-2">
                      <MathView content={q.prompt} />
                    </div>

                    {q.tagIds && q.tagIds.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap pt-0.5">
                        {q.tagIds.map((tid) => {
                          const tag = tagsById.get(tid);
                          if (!tag) return null;
                          return (
                            <TagBadge
                              key={tid}
                              name={tag.name}
                              color={tag.color}
                              className="text-[10px] py-0 px-1.5"
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
