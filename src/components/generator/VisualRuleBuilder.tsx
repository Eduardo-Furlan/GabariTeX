import React, { useMemo } from 'react';
import {
  AlertTriangle,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
  X,
} from 'lucide-react';
import {
  Blueprint,
  RuleBlock,
  QuotaLine,
  SourceExpr,
  BankGroup,
  BankTag,
  BankQuestion,
  QuestionType,
} from '../../types/bank';
import {
  analyzeBlueprint,
  describeFailure,
} from '../../utils/bank/solver';
import { pathOf } from '../../utils/bank/tree';
import { generateBankId } from '../../utils/bank/ids';
import { isVisuallyRepresentable } from '../../utils/bank/blueprint';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { TagBadge } from '../bank/TagBadge';

export interface VisualRuleBuilderProps {
  blueprint: Blueprint;
  onChange: (bp: Blueprint) => void;
  groups: BankGroup[];
  tags: BankTag[];
  questions: BankQuestion[];
  excludeQuestionIds?: ReadonlySet<string>;
}

export interface VisualSourceState {
  op: 'or' | 'and' | 'xor';
  groups: Array<{ groupId: string; descendants: boolean }>;
  exceptGroupIds: string[];
}

export function sourceExprToVisual(source: SourceExpr): VisualSourceState {
  let base: SourceExpr = source;
  const exceptGroupIds: string[] = [];

  if (source.kind === 'except') {
    base = source.base;
    if (source.excluded.kind === 'group') {
      exceptGroupIds.push(source.excluded.groupId);
    } else if (source.excluded.kind === 'or') {
      for (const op of source.excluded.operands) {
        if (op.kind === 'group') exceptGroupIds.push(op.groupId);
      }
    }
  }

  let op: 'or' | 'and' | 'xor' = 'or';
  const groups: Array<{ groupId: string; descendants: boolean }> = [];

  if (base.kind === 'all') {
    // Empty groups means all
  } else if (base.kind === 'group') {
    groups.push({ groupId: base.groupId, descendants: base.descendants });
  } else if (base.kind === 'or' || base.kind === 'and' || base.kind === 'xor') {
    op = base.kind;
    for (const operand of base.operands) {
      if (operand.kind === 'group') {
        groups.push({ groupId: operand.groupId, descendants: operand.descendants });
      }
    }
  }

  return { op, groups, exceptGroupIds };
}

export function visualToSourceExpr(state: VisualSourceState): SourceExpr {
  let base: SourceExpr;
  if (state.groups.length === 0) {
    base = { kind: 'all' };
  } else if (state.groups.length === 1) {
    base = {
      kind: 'group',
      groupId: state.groups[0].groupId,
      descendants: state.groups[0].descendants,
    };
  } else {
    base = {
      kind: state.op,
      operands: state.groups.map((g) => ({
        kind: 'group',
        groupId: g.groupId,
        descendants: g.descendants,
      })),
    };
  }

  if (state.exceptGroupIds.length === 0) {
    return base;
  }

  const excluded: SourceExpr =
    state.exceptGroupIds.length === 1
      ? { kind: 'group', groupId: state.exceptGroupIds[0], descendants: false }
      : {
          kind: 'or',
          operands: state.exceptGroupIds.map((gid) => ({
            kind: 'group',
            groupId: gid,
            descendants: false,
          })),
        };

  return {
    kind: 'except',
    base,
    excluded,
  };
}

export const VisualRuleBuilder: React.FC<VisualRuleBuilderProps> = ({
  blueprint,
  onChange,
  groups,
  tags,
  questions,
  excludeQuestionIds,
}) => {
  const groupsById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  // Live availability analysis
  const analysis = useMemo(() => {
    return analyzeBlueprint({
      groups,
      tags,
      questions,
      blueprint,
      excludeQuestionIds,
    });
  }, [groups, tags, questions, blueprint, excludeQuestionIds]);

  // Update whole blocks array
  const updateBlocks = (nextBlocks: RuleBlock[]) => {
    onChange({
      ...blueprint,
      blocks: nextBlocks,
      updatedAt: new Date().toISOString(),
    });
  };

  // Block management
  const handleAddBlock = () => {
    const newBlock: RuleBlock = {
      id: generateBankId(),
      source: { kind: 'all' },
      quotas: [
        {
          id: generateBankId(),
          count: 1,
          filter: { tagIds: [], notTagIds: [] },
        },
      ],
    };
    updateBlocks([...blueprint.blocks, newBlock]);
  };

  const handleDeleteBlock = (blockIdx: number) => {
    if (blueprint.blocks.length <= 1) return;
    const next = blueprint.blocks.filter((_, idx) => idx !== blockIdx);
    updateBlocks(next);
  };

  const handleMoveBlock = (blockIdx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? blockIdx - 1 : blockIdx + 1;
    if (targetIdx < 0 || targetIdx >= blueprint.blocks.length) return;
    const next = [...blueprint.blocks];
    const temp = next[blockIdx];
    next[blockIdx] = next[targetIdx];
    next[targetIdx] = temp;
    updateBlocks(next);
  };

  const handleUpdateBlockPoints = (blockIdx: number, points?: number) => {
    const next = [...blueprint.blocks];
    next[blockIdx] = { ...next[blockIdx], points };
    updateBlocks(next);
  };

  // Quota lines management
  const handleAddLine = (blockIdx: number) => {
    const next = [...blueprint.blocks];
    const b = next[blockIdx];
    const newLine: QuotaLine = {
      id: generateBankId(),
      count: 1,
      filter: { tagIds: [], notTagIds: [] },
    };
    next[blockIdx] = { ...b, quotas: [...b.quotas, newLine] };
    updateBlocks(next);
  };

  const handleDeleteLine = (blockIdx: number, lineIdx: number) => {
    const next = [...blueprint.blocks];
    const b = next[blockIdx];
    if (b.quotas.length <= 1) return;
    next[blockIdx] = {
      ...b,
      quotas: b.quotas.filter((_, idx) => idx !== lineIdx),
    };
    updateBlocks(next);
  };

  const handleUpdateLine = (blockIdx: number, lineIdx: number, patch: Partial<QuotaLine>) => {
    const next = [...blueprint.blocks];
    const b = next[blockIdx];
    const updatedQuotas = [...b.quotas];
    updatedQuotas[lineIdx] = { ...updatedQuotas[lineIdx], ...patch };
    next[blockIdx] = { ...b, quotas: updatedQuotas };
    updateBlocks(next);
  };

  // Source updates
  const handleUpdateVisualSource = (
    blockIdx: number,
    updater: (current: VisualSourceState) => VisualSourceState
  ) => {
    const next = [...blueprint.blocks];
    const b = next[blockIdx];
    const currentVisual = sourceExprToVisual(b.source);
    const updatedVisual = updater(currentVisual);
    next[blockIdx] = {
      ...b,
      source: visualToSourceExpr(updatedVisual),
    };
    updateBlocks(next);
  };

  // Available groups for selection sorted by path
  const sortedGroups = useMemo(() => {
    const list = [...groups];
    list.sort((a, b) => pathOf(groups, a.id).localeCompare(pathOf(groups, b.id), 'pt-BR'));
    return list;
  }, [groups]);

  return (
    <div className="space-y-6">
      {/* Top Failure Banners (e.g. Joint Shortfalls, Over Limit) */}
      {analysis.failures.length > 0 && (
        <div className="space-y-2">
          {analysis.failures.map((failure, idx) => {
            const desc = describeFailure(failure, { blueprint, groupsById, tagsById });
            return (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <span>{desc}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Blocks List */}
      <div className="space-y-4">
        {blueprint.blocks.map((block, blockIdx) => {
          const isRepresentable = isVisuallyRepresentable(block);
          const visualSource = sourceExprToVisual(block.source);
          const selectedGroupIds = new Set(visualSource.groups.map((g) => g.groupId));
          const exceptGroupIds = new Set(visualSource.exceptGroupIds);

          return (
            <div
              key={block.id}
              className="p-5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-4"
            >
              {/* Block Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Bloco {blockIdx + 1}</span>
                  </span>
                  <span className="text-xs text-slate-500">
                    ({block.quotas.reduce((sum, q) => sum + q.count, 0)} questões)
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Block Points */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-slate-600 whitespace-nowrap">
                      Pontos do bloco:
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.5"
                      placeholder="Padrão"
                      value={block.points ?? ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        handleUpdateBlockPoints(
                          blockIdx,
                          !isNaN(val) && val > 0 ? val : undefined
                        );
                      }}
                      className="w-18 h-8 px-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Move Up/Down */}
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ChevronUp className="w-3.5 h-3.5" />}
                      disabled={blockIdx === 0}
                      onClick={() => handleMoveBlock(blockIdx, 'up')}
                      title="Mover bloco para cima"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ChevronDown className="w-3.5 h-3.5" />}
                      disabled={blockIdx === blueprint.blocks.length - 1}
                      onClick={() => handleMoveBlock(blockIdx, 'down')}
                      title="Mover bloco para baixo"
                    />
                  </div>

                  {/* Delete Block */}
                  {blueprint.blocks.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      onClick={() => handleDeleteBlock(blockIdx)}
                      title="Excluir este bloco"
                    />
                  )}
                </div>
              </div>

              {!isRepresentable && (
                <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    Este bloco possui regras taxonômicas com operadores aninhados. As alterações
                    feitas abaixo simplificarão a regra para a forma visual padrão.
                  </span>
                </div>
              )}

              {/* Source (Origem) Controls */}
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-xs font-semibold text-slate-700">Origem:</span>

                  {/* Operator Selector */}
                  <Select<'or' | 'and' | 'xor'>
                    size="sm"
                    value={visualSource.op}
                    onChange={(val) => {
                      handleUpdateVisualSource(blockIdx, (curr) => ({ ...curr, op: val }));
                    }}
                    options={[
                      { value: 'or', label: 'Sortear de qualquer um (OU)' },
                      { value: 'and', label: 'Garantir ao menos uma de cada (E)' },
                      { value: 'xor', label: 'Usar apenas um, sorteado (XOU)' },
                    ]}
                  />

                  {/* Add Group Select */}
                  <Select<string>
                    size="sm"
                    value=""
                    placeholder="+ Adicionar Grupo"
                    onChange={(gid) => {
                      if (!gid) return;
                      handleUpdateVisualSource(blockIdx, (curr) => ({
                        ...curr,
                        groups: [...curr.groups, { groupId: gid, descendants: true }],
                      }));
                    }}
                    options={sortedGroups
                      .filter((g) => !selectedGroupIds.has(g.id))
                      .map((g) => ({
                        value: g.id,
                        label: pathOf(groups, g.id),
                      }))}
                  />
                </div>

                {/* Groups Selected Chips */}
                <div className="flex flex-wrap items-center gap-2">
                  {visualSource.groups.length === 0 ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600">
                      Todo o Banco de Questões
                    </span>
                  ) : (
                    visualSource.groups.map((item, gIdx) => {
                      const grp = groupsById.get(item.groupId);
                      const label = grp ? pathOf(groups, grp.id) : 'Grupo removido';
                      return (
                        <div
                          key={item.groupId}
                          className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-800 shadow-2xs"
                        >
                          <span className={grp ? '' : 'text-rose-600 font-semibold'}>{label}</span>

                          {/* Subgroups toggle */}
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateVisualSource(blockIdx, (curr) => {
                                const nextGroups = [...curr.groups];
                                nextGroups[gIdx] = {
                                  ...nextGroups[gIdx],
                                  descendants: !nextGroups[gIdx].descendants,
                                };
                                return { ...curr, groups: nextGroups };
                              });
                            }}
                            className={`px-1.5 py-0.5 rounded text-2xs font-semibold transition ${
                              item.descendants
                                ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30'
                                : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                            }`}
                            title="Alternar inclusão de subgrupos taxonômicos"
                          >
                            {item.descendants ? '+ Subgrupos' : 'Apenas este'}
                          </button>

                          {/* Remove group */}
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateVisualSource(blockIdx, (curr) => ({
                                ...curr,
                                groups: curr.groups.filter((_, idx) => idx !== gIdx),
                              }));
                            }}
                            className="p-0.5 text-slate-400 hover:text-slate-700 rounded"
                            title="Remover grupo"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Except (Exceto) Groups */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
                  <span className="text-xs font-semibold text-slate-700">Exceto:</span>

                  {visualSource.exceptGroupIds.map((gid) => {
                    const grp = groupsById.get(gid);
                    const label = grp ? pathOf(groups, grp.id) : 'Grupo removido';
                    return (
                      <div
                        key={gid}
                        className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-0.5 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300"
                      >
                        <span>{label}</span>
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateVisualSource(blockIdx, (curr) => ({
                              ...curr,
                              exceptGroupIds: curr.exceptGroupIds.filter((id) => id !== gid),
                            }));
                          }}
                          className="p-0.5 text-rose-500 hover:text-rose-700 rounded"
                          title="Remover exceção"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}

                  <Select<string>
                    size="sm"
                    value=""
                    placeholder="+ Grupo a Excluir"
                    onChange={(gid) => {
                      if (!gid) return;
                      handleUpdateVisualSource(blockIdx, (curr) => ({
                        ...curr,
                        exceptGroupIds: [...curr.exceptGroupIds, gid],
                      }));
                    }}
                    options={sortedGroups
                      .filter((g) => !exceptGroupIds.has(g.id))
                      .map((g) => ({
                        value: g.id,
                        label: pathOf(groups, g.id),
                      }))}
                  />
                </div>
              </div>

              {/* Quota Lines */}
              <div className="space-y-3">
                <span className="text-xs font-semibold text-slate-700 block">
                  Linhas de Cota:
                </span>

                <div className="space-y-2">
                  {block.quotas.map((line, lineIdx) => {
                    const available = analysis.lineAvailability.get(line.id) ?? 0;
                    const isShortfall = available < line.count;

                    return (
                      <div
                        key={line.id}
                        className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl"
                      >
                        {/* Count & Filters */}
                        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                          {/* Count input */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <input
                              type="number"
                              min="1"
                              max="40"
                              value={line.count}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                handleUpdateLine(blockIdx, lineIdx, {
                                  count: isNaN(val) ? 1 : Math.max(1, Math.min(40, val)),
                                });
                              }}
                              className="w-14 h-8 px-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-slate-500">
                              {line.count === 1 ? 'questão' : 'questões'}
                            </span>
                          </div>

                          {/* Included Tags */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {line.filter.tagIds.map((tid) => {
                              const tag = tagsById.get(tid);
                              return (
                                <TagBadge
                                  key={tid}
                                  name={tag ? tag.name : 'Etiqueta removida'}
                                  color={tag?.color}
                                  onRemove={() => {
                                    handleUpdateLine(blockIdx, lineIdx, {
                                      filter: {
                                        ...line.filter,
                                        tagIds: line.filter.tagIds.filter((id) => id !== tid),
                                      },
                                    });
                                  }}
                                />
                              );
                            })}

                            {/* Add Tag Select */}
                            <Select<string>
                              size="sm"
                              value=""
                              placeholder="+ Etiqueta"
                              onChange={(tid) => {
                                if (!tid) return;
                                handleUpdateLine(blockIdx, lineIdx, {
                                  filter: {
                                    ...line.filter,
                                    tagIds: [...line.filter.tagIds, tid],
                                  },
                                });
                              }}
                              options={tags
                                .filter(
                                  (t) =>
                                    !line.filter.tagIds.includes(t.id) &&
                                    !line.filter.notTagIds.includes(t.id)
                                )
                                .map((t) => ({
                                  value: t.id,
                                  label: t.name,
                                }))}
                            />
                          </div>

                          {/* Excluded Tags (Sem Etiqueta) */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {line.filter.notTagIds.map((tid) => {
                              const tag = tagsById.get(tid);
                              return (
                                <span
                                  key={tid}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30"
                                >
                                  <span>sem {tag ? tag.name : 'removida'}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleUpdateLine(blockIdx, lineIdx, {
                                        filter: {
                                          ...line.filter,
                                          notTagIds: line.filter.notTagIds.filter((id) => id !== tid),
                                        },
                                      });
                                    }}
                                    className="p-0.5 text-rose-500 hover:text-rose-700 rounded"
                                    title="Remover exclusão de etiqueta"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              );
                            })}

                            {/* Add Not-Tag Select */}
                            <Select<string>
                              size="sm"
                              value=""
                              placeholder="+ Sem Etiqueta"
                              onChange={(tid) => {
                                if (!tid) return;
                                handleUpdateLine(blockIdx, lineIdx, {
                                  filter: {
                                    ...line.filter,
                                    notTagIds: [...line.filter.notTagIds, tid],
                                  },
                                });
                              }}
                              options={tags
                                .filter(
                                  (t) =>
                                    !line.filter.tagIds.includes(t.id) &&
                                    !line.filter.notTagIds.includes(t.id)
                                )
                                .map((t) => ({
                                  value: t.id,
                                  label: t.name,
                                }))}
                            />
                          </div>

                          {/* Type Select */}
                          <Select<string>
                            size="sm"
                            value={line.filter.type || ''}
                            onChange={(val) => {
                              handleUpdateLine(blockIdx, lineIdx, {
                                filter: {
                                  ...line.filter,
                                  type: (val as QuestionType) || undefined,
                                },
                              });
                            }}
                            options={[
                              { value: '', label: 'Qualquer tipo' },
                              { value: 'objective', label: 'Objetiva' },
                              { value: 'subjective', label: 'Discursiva' },
                            ]}
                          />

                          {/* Points override */}
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="number"
                              min="0.1"
                              step="0.5"
                              placeholder="pts"
                              value={line.points ?? ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                handleUpdateLine(blockIdx, lineIdx, {
                                  points: !isNaN(val) && val > 0 ? val : undefined,
                                });
                              }}
                              className="w-14 h-8 px-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <span className="text-2xs text-slate-500">pts</span>
                          </div>
                        </div>

                        {/* Availability and Actions */}
                        <div className="flex items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                          {isShortfall ? (
                            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 shrink-0">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>{`${available} disponíveis (insuficiente)`}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500 shrink-0">
                              {`${available} disponíveis`}
                            </span>
                          )}

                          {block.quotas.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Trash2 className="w-3.5 h-3.5" />}
                              className="text-slate-400 hover:text-rose-600"
                              onClick={() => handleDeleteLine(blockIdx, lineIdx)}
                              title="Remover linha"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Line Button */}
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => handleAddLine(blockIdx)}
                >
                  Adicionar Linha
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Block Button */}
      <div className="flex justify-start">
        <Button
          variant="secondary"
          size="md"
          icon={<Plus className="w-4 h-4" />}
          onClick={handleAddBlock}
        >
          Adicionar Bloco
        </Button>
      </div>
    </div>
  );
};
