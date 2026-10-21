import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  X,
  Filter,
  CheckSquare,
  Square,
  Tags,
  Folder,
  Plus,
} from 'lucide-react';
import { BankGroup, BankQuestion, BankTag, QuestionType } from '../../types/bank';
import { GroupSelection } from './GroupTree';
import { QuestionCard } from './QuestionCard';
import { TagBadge } from './TagBadge';
import { Select } from '../ui/Select';
import { useWindowedList } from './useWindowedList';
import { descendantIds, pathOf } from '../../utils/bank/tree';
import { cn } from '../ui/cn';

export type BankSortOption = 'recent' | 'prompt_asc' | 'most_used' | 'least_used';

export interface QuestionListProps {
  questions: BankQuestion[];
  groups: BankGroup[];
  tags: BankTag[];
  usageCounts: Map<string, number>;
  selectedGroup: GroupSelection;
  selectedQuestionIds: Set<string>;
  onToggleSelectQuestion: (id: string) => void;
  onSelectAllQuestions: (ids: string[]) => void;
  onClearQuestionSelection: () => void;
  onEditQuestion: (question: BankQuestion) => void;
  onDuplicateQuestion: (question: BankQuestion) => void;
  onMoveQuestion: (question: BankQuestion) => void;
  onArchiveToggleQuestion: (question: BankQuestion) => void;
  onDeleteQuestion: (question: BankQuestion) => void;
  onOpenTagManager?: () => void;
  onNewQuestion?: () => void;
  className?: string;
}

export const QuestionList: React.FC<QuestionListProps> = ({
  questions,
  groups,
  tags,
  usageCounts,
  selectedGroup,
  selectedQuestionIds,
  onToggleSelectQuestion,
  onSelectAllQuestions,
  onClearQuestionSelection,
  onEditQuestion,
  onDuplicateQuestion,
  onMoveQuestion,
  onArchiveToggleQuestion,
  onDeleteQuestion,
  onOpenTagManager,
  onNewQuestion,
  className,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [includeSubgroups, setIncludeSubgroups] = useState(true);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [matchAllTags, setMatchAllTags] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | QuestionType>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<BankSortOption>('recent');

  const containerRef = useRef<HTMLDivElement>(null);

  const tagsById = useMemo(() => {
    return new Map<string, BankTag>(tags.map((t) => [t.id, t]));
  }, [tags]);

  // Current group scope label and IDs
  const { groupScopeIds, groupBreadcrumbs } = useMemo(() => {
    if (selectedGroup.kind === 'all') {
      return { groupScopeIds: null, groupBreadcrumbs: 'Todas as Questões' };
    }
    if (selectedGroup.kind === 'orphan') {
      return { groupScopeIds: new Set<string | null>([null]), groupBreadcrumbs: 'Sem Grupo' };
    }

    const currentGroup = groups.find((g) => g.id === selectedGroup.groupId);
    if (!currentGroup) {
      return { groupScopeIds: null, groupBreadcrumbs: 'Grupo' };
    }

    const breadcrumbs = pathOf(groups, currentGroup.id);

    if (!includeSubgroups) {
      return {
        groupScopeIds: new Set<string | null>([currentGroup.id]),
        groupBreadcrumbs: breadcrumbs,
      };
    }

    const descendants = descendantIds(groups, currentGroup.id);
    descendants.add(currentGroup.id);
    return {
      groupScopeIds: descendants as Set<string | null>,
      groupBreadcrumbs: breadcrumbs,
    };
  }, [selectedGroup, groups, includeSubgroups]);

  // Questions filtered strictly by group scope (used for tag count calculation)
  const groupScopeQuestions = useMemo(() => {
    if (!groupScopeIds) return questions;
    return questions.filter((q) => groupScopeIds.has(q.groupId ?? null));
  }, [questions, groupScopeIds]);

  // Calculate tag counts within group scope
  const tagCountsInScope = useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of groupScopeQuestions) {
      if (q.tagIds) {
        for (const tid of q.tagIds) {
          counts.set(tid, (counts.get(tid) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [groupScopeQuestions]);

  // Filter and sort questions
  const filteredQuestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return groupScopeQuestions
      .filter((q) => {
        // Archived toggle
        if (!showArchived && q.archived) return false;

        // Type filter
        if (typeFilter !== 'all' && q.type !== typeFilter) return false;

        // Tag filter
        if (selectedTagIds.size > 0) {
          const qTags = q.tagIds ?? [];
          if (matchAllTags) {
            for (const reqTag of selectedTagIds) {
              if (!qTags.includes(reqTag)) return false;
            }
          } else {
            let hasAny = false;
            for (const reqTag of selectedTagIds) {
              if (qTags.includes(reqTag)) {
                hasAny = true;
                break;
              }
            }
            if (!hasAny) return false;
          }
        }

        // Search query
        if (query.length > 0) {
          const promptLower = q.prompt.toLowerCase();
          if (!promptLower.includes(query)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'prompt_asc':
            return a.prompt.localeCompare(b.prompt, 'pt-BR');
          case 'most_used': {
            const countA = usageCounts.get(a.id) ?? 0;
            const countB = usageCounts.get(b.id) ?? 0;
            return countB - countA;
          }
          case 'least_used': {
            const countA = usageCounts.get(a.id) ?? 0;
            const countB = usageCounts.get(b.id) ?? 0;
            return countA - countB;
          }
          case 'recent':
          default:
            return b.updatedAt.localeCompare(a.updatedAt);
        }
      });
  }, [
    groupScopeQuestions,
    searchQuery,
    showArchived,
    typeFilter,
    selectedTagIds,
    matchAllTags,
    sortBy,
    usageCounts,
  ]);

  const { visibleItems, totalHeight, offsetY } = useWindowedList(filteredQuestions, containerRef, {
    estimatedItemHeight: 120,
    threshold: 25,
  });

  const allFilteredSelected =
    filteredQuestions.length > 0 &&
    filteredQuestions.every((q) => selectedQuestionIds.has(q.id));

  const someFilteredSelected =
    !allFilteredSelected && filteredQuestions.some((q) => selectedQuestionIds.has(q.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      onClearQuestionSelection();
    } else {
      onSelectAllQuestions(filteredQuestions.map((q) => q.id));
    }
  };

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  return (
    <div className={cn('flex flex-col flex-1 min-w-0 gap-3', className)}>
      {/* Top Search & Filter Bar */}
      <div className="flex flex-col gap-2.5 p-3 rounded-xl border border-slate-200 bg-white">
        {/* Search Row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar no enunciado da questão..."
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              aria-label="Buscar no enunciado da questão"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                aria-label="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {onNewQuestion && (
            <button
              type="button"
              onClick={onNewQuestion}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-on-accent text-sm font-semibold shadow-xs transition shrink-0 flex items-center gap-1.5"
            >
              <span>Nova Questão</span>
            </button>
          )}
        </div>

        {/* Group Scope & Subgroups Toggle */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs border-t border-slate-100 pt-2">
          <div className="flex items-center gap-1.5 min-w-0 text-slate-600">
            <Folder className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="font-semibold text-slate-900 truncate" title={groupBreadcrumbs}>
              {groupBreadcrumbs}
            </span>
          </div>

          {selectedGroup.kind === 'group' && (
            <label className="inline-flex items-center gap-1.5 text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeSubgroups}
                onChange={(e) => setIncludeSubgroups(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Incluir subgrupos</span>
            </label>
          )}
        </div>

        {/* Tag Filters */}
        {tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
            <span className="text-meta font-bold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1">
              <Tags className="w-3 h-3" />
              <span>Etiquetas:</span>
            </span>

            {tags.map((tag) => {
              const count = tagCountsInScope.get(tag.id) ?? 0;
              const isSelected = selectedTagIds.has(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTagFilter(tag.id)}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-full"
                >
                  <TagBadge
                    name={tag.name}
                    color={tag.color}
                    count={count}
                    selected={isSelected}
                  />
                </button>
              );
            })}

            {selectedTagIds.size > 1 && (
              <button
                type="button"
                onClick={() => setMatchAllTags(!matchAllTags)}
                className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                title={
                  matchAllTags
                    ? 'Modo: E (questões devem conter todas as etiquetas selecionadas)'
                    : 'Modo: OU (questões com qualquer uma das etiquetas selecionadas)'
                }
              >
                {matchAllTags ? 'Modo: E (todas)' : 'Modo: OU (qualquer)'}
              </button>
            )}

            {onOpenTagManager && (
              <button
                type="button"
                onClick={onOpenTagManager}
                className="text-meta font-medium text-indigo-600 hover:underline ml-auto"
              >
                Gerenciar etiquetas
              </button>
            )}
          </div>
        )}

        {/* Type Filter, Archived Toggle & Sort Selector */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Type Filter Buttons */}
            <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={cn(
                  'px-2 py-1 rounded-md text-xs font-medium transition',
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
                  'px-2 py-1 rounded-md text-xs font-medium transition',
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
                  'px-2 py-1 rounded-md text-xs font-medium transition',
                  typeFilter === 'subjective'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Dissertativas
              </button>
            </div>

            {/* Archived Toggle */}
            <label className="inline-flex items-center gap-1.5 text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Mostrar arquivadas</span>
            </label>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-meta text-slate-500">Ordenar:</span>
            <Select<BankSortOption>
              size="sm"
              value={sortBy}
              onChange={(val) => setSortBy(val)}
              options={[
                { value: 'recent', label: 'Mais recentes' },
                { value: 'prompt_asc', label: 'Alfabética (A-Z)' },
                { value: 'most_used', label: 'Mais usadas' },
                { value: 'least_used', label: 'Menos usadas' },
              ]}
              className="w-36"
            />
          </div>
        </div>
      </div>

      {/* Selection & Count Header */}
      {filteredQuestions.length > 0 && (
        <div className="flex items-center justify-between px-1 text-xs text-slate-600 select-none">
          <label className="inline-flex items-center gap-2 cursor-pointer font-medium hover:text-slate-900 transition">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="p-0.5 rounded text-indigo-600 hover:bg-slate-100 transition focus-visible:outline-none"
              aria-label={allFilteredSelected ? 'Desmarcar todas' : 'Selecionar todas'}
            >
              {allFilteredSelected ? (
                <CheckSquare className="w-4 h-4 fill-current text-indigo-600 dark:text-indigo-400" />
              ) : someFilteredSelected ? (
                <span className="w-4 h-4 rounded border-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400 leading-none">
                  -
                </span>
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
            </button>
            <span>
              {allFilteredSelected
                ? 'Todas selecionadas'
                : selectedQuestionIds.size > 0
                ? `${selectedQuestionIds.size} selecionada(s)`
                : 'Selecionar todas'}
            </span>
          </label>

          <span className="tabular-nums font-medium text-slate-500">
            Exibindo {filteredQuestions.length} de {questions.length}{' '}
            {questions.length === 1 ? 'questão' : 'questões'}
          </span>
        </div>
      )}

      {/* Question Cards List */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto max-h-[calc(100vh-320px)] rounded-xl pr-1"
      >
        {filteredQuestions.length === 0 ? (
          groupScopeQuestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white">
              <Folder className="w-8 h-8 text-slate-400 mb-2" />
              <h3 className="font-semibold text-slate-800 text-sm">
                {selectedGroup.kind === 'group'
                  ? 'Nenhuma questão neste grupo'
                  : selectedGroup.kind === 'orphan'
                  ? 'Nenhuma questão sem grupo'
                  : 'Nenhuma questão no banco'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                {selectedGroup.kind === 'group'
                  ? 'Adicione questões a este grupo para começar a estruturar seu acervo.'
                  : 'Cadastre questões para começar a preencher este acervo.'}
              </p>
              {onNewQuestion && (
                <button
                  type="button"
                  onClick={onNewQuestion}
                  className="mt-4 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-on-accent text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova Questão</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white">
              <Filter className="w-8 h-8 text-slate-400 mb-2" />
              <h3 className="font-semibold text-slate-800 text-sm">
                Nenhuma questão encontrada
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Nenhuma questão corresponde aos filtros ou grupo selecionado. Tente alterar os termos
                de busca ou desativar filtros.
              </p>
            </div>
          )
        ) : (
          <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
            <div
              style={{
                transform: `translateY(${offsetY}px)`,
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
              }}
              className="flex flex-col gap-2.5"
            >
              {visibleItems.map(({ item }) => (
                <QuestionCard
                  key={item.id}
                  question={item}
                  tagsById={tagsById}
                  usageCount={usageCounts.get(item.id) ?? 0}
                  selected={selectedQuestionIds.has(item.id)}
                  onToggleSelect={() => onToggleSelectQuestion(item.id)}
                  onEdit={() => onEditQuestion(item)}
                  onDuplicate={() => onDuplicateQuestion(item)}
                  onMove={() => onMoveQuestion(item)}
                  onArchiveToggle={() => onArchiveToggleQuestion(item)}
                  onDelete={() => onDeleteQuestion(item)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
