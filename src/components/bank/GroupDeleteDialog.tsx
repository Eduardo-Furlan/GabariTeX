import React, { useState, useMemo, useEffect } from 'react';
import { AlertTriangle, FolderInput, Trash2 } from 'lucide-react';
import { BankGroup, BankQuestion } from '../../types/bank';
import { DeleteGroupStrategy, descendantIds } from '../../utils/bank/tree';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { GroupPicker } from './GroupPicker';
import { cn } from '../ui/cn';

export interface GroupDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: BankGroup | null;
  groups: readonly BankGroup[];
  questions: readonly BankQuestion[];
  onConfirm: (groupId: string, strategy: DeleteGroupStrategy) => Promise<boolean>;
  onCreateGroup?: (input: { name: string; parentId: string | null }) => Promise<BankGroup | null>;
}

export const GroupDeleteDialog: React.FC<GroupDeleteDialogProps> = ({
  open,
  onOpenChange,
  group,
  groups,
  questions,
  onConfirm,
  onCreateGroup,
}) => {
  const [strategyKind, setStrategyKind] = useState<'move' | 'delete'>('move');
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default target group to parent of group
  useEffect(() => {
    if (group) {
      setTargetGroupId(group.parentId);
      setStrategyKind('move');
    }
  }, [group]);

  const { descendants, totalAffectedQuestions, subgruposCount } = useMemo(() => {
    if (!group) {
      return {
        descendants: new Set<string>(),
        totalAffectedQuestions: 0,
        subgruposCount: 0,
      };
    }

    const desc = descendantIds(groups, group.id);
    const affectedGroupIds = new Set<string>([group.id, ...desc]);
    const affected = questions.filter((q) => q.groupId && affectedGroupIds.has(q.groupId));

    return {
      descendants: desc,
      totalAffectedQuestions: affected.length,
      subgruposCount: desc.size,
    };
  }, [group, groups, questions]);

  const excludeSet = useMemo(() => {
    if (!group) return new Set<string>();
    return new Set<string>([group.id, ...descendants]);
  }, [group, descendants]);

  if (!group) return null;

  const isGroupEmpty = totalAffectedQuestions === 0 && subgruposCount === 0;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const strategy: DeleteGroupStrategy = isGroupEmpty
        ? { kind: 'delete' }
        : strategyKind === 'move'
        ? { kind: 'move', targetGroupId }
        : { kind: 'delete' };

      const ok = await onConfirm(group.id, strategy);
      if (ok) {
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Excluir Grupo"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            loading={isSubmitting}
            icon={<Trash2 className="w-4 h-4" />}
          >
            {isGroupEmpty || strategyKind === 'delete'
              ? 'Excluir Grupo'
              : 'Mover e Excluir'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {isGroupEmpty ? (
          <p className="text-body text-slate-700">
            Tem certeza que deseja excluir o grupo{' '}
            <strong className="text-slate-900 font-bold">&quot;{group.name}&quot;</strong>?
            Este grupo está vazio e não contém questões nem subgrupos.
          </p>
        ) : (
          <>
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                O grupo <strong>&quot;{group.name}&quot;</strong> contém{' '}
                <strong>
                  {totalAffectedQuestions}{' '}
                  {totalAffectedQuestions === 1 ? 'questão' : 'questões'}
                </strong>
                {subgruposCount > 0 && (
                  <>
                    {' '}
                    e{' '}
                    <strong>
                      {subgruposCount}{' '}
                      {subgruposCount === 1 ? 'subgrupo' : 'subgrupos'}
                    </strong>
                  </>
                )}
                . O que deseja fazer com esse conteúdo?
              </div>
            </div>

            <div className="space-y-3">
              {/* Opção 1: Mover */}
              <label
                className={cn(
                  'flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition',
                  strategyKind === 'move'
                    ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-500/10'
                    : 'border-slate-200 hover:bg-slate-50'
                )}
              >
                <input
                  type="radio"
                  name="delete-strategy"
                  value="move"
                  checked={strategyKind === 'move'}
                  onChange={() => setStrategyKind('move')}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FolderInput className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="text-sm font-bold text-slate-800">
                      Mover questões para outro grupo
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    As questões e eventuais subgrupos serão transferidos para o destino
                    escolhido antes de excluir este grupo.
                  </p>

                  {strategyKind === 'move' && (
                    <div className="mt-3">
                      <span className="block text-meta font-medium text-slate-600 mb-1">
                        Grupo de destino:
                      </span>
                      <GroupPicker
                        groups={groups}
                        value={targetGroupId}
                        onChange={setTargetGroupId}
                        excludeGroupIds={excludeSet}
                        allowRoot={true}
                        rootLabel="Sem Grupo (Nível Superior)"
                        onCreateGroup={onCreateGroup}
                      />
                    </div>
                  )}
                </div>
              </label>

              {/* Opção 2: Excluir tudo */}
              <label
                className={cn(
                  'flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition',
                  strategyKind === 'delete'
                    ? 'border-rose-600 bg-rose-50/40 dark:bg-rose-500/10'
                    : 'border-slate-200 hover:bg-slate-50'
                )}
              >
                <input
                  type="radio"
                  name="delete-strategy"
                  value="delete"
                  checked={strategyKind === 'delete'}
                  onChange={() => setStrategyKind('delete')}
                  className="mt-1 text-rose-600 focus:ring-rose-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span className="text-sm font-bold text-rose-700 dark:text-rose-300">
                      Excluir permanentemente grupo e todas as questões
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Todas as {totalAffectedQuestions} questões contidas neste grupo e
                    seus subgrupos serão apagadas do seu banco de questões. Esta ação não
                    pode ser desfeita.
                  </p>
                </div>
              </label>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
