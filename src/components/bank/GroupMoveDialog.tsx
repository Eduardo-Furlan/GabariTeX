import React, { useState, useEffect, useMemo } from 'react';
import { BankGroup } from '../../types/bank';
import { descendantIds, depthOf, MAX_GROUP_DEPTH } from '../../utils/bank/tree';
import { caseInsensitiveKey } from '../../utils/bank/names';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { GroupPicker } from './GroupPicker';

export interface GroupMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: BankGroup | null;
  groups: readonly BankGroup[];
  onMove: (groupId: string, targetParentId: string | null) => Promise<boolean>;
}

export const GroupMoveDialog: React.FC<GroupMoveDialogProps> = ({
  open,
  onOpenChange,
  group,
  groups,
  onMove,
}) => {
  const [targetParentId, setTargetParentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && group) {
      setTargetParentId(group.parentId);
      setIsSubmitting(false);
    }
  }, [open, group]);

  const excludeSet = useMemo(() => {
    if (!group) return new Set<string>();
    const desc = descendantIds(groups, group.id);
    return new Set<string>([group.id, ...desc]);
  }, [group, groups]);

  const validationError = useMemo(() => {
    if (!group) return null;
    if (targetParentId === group.parentId) {
      return null;
    }

    if (excludeSet.has(targetParentId!)) {
      return 'Não é possível mover um grupo para dentro de si mesmo ou de seus subgrupos.';
    }

    const newParentDepth = targetParentId ? depthOf(groups, targetParentId) + 1 : 0;
    const desc = descendantIds(groups, group.id);
    let maxSubtreeRelativeDepth = 0;
    for (const descId of desc) {
      const d = depthOf(groups, descId) - depthOf(groups, group.id);
      if (d > maxSubtreeRelativeDepth) maxSubtreeRelativeDepth = d;
    }
    if (newParentDepth + maxSubtreeRelativeDepth > MAX_GROUP_DEPTH) {
      return `Mover este grupo excederia o limite máximo de ${MAX_GROUP_DEPTH} níveis.`;
    }

    // Sibling uniqueness at destination
    const nameKey = caseInsensitiveKey(group.name);
    const duplicate = groups.some(
      (g) => g.id !== group.id && g.parentId === targetParentId && caseInsensitiveKey(g.name) === nameKey
    );
    if (duplicate) {
      return `Já existe um subgrupo com o nome "${group.name}" no destino escolhido.`;
    }

    return null;
  }, [group, targetParentId, groups, excludeSet]);

  if (!group) return null;

  const handleSubmit = async () => {
    if (validationError) return;
    setIsSubmitting(true);
    try {
      const ok = await onMove(group.id, targetParentId);
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
      title="Mover Grupo"
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
            variant="primary"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={Boolean(validationError) || targetParentId === group.parentId}
          >
            Mover Grupo
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-body text-slate-700">
          Selecione a nova localização do grupo{' '}
          <strong className="text-slate-900 font-bold">&quot;{group.name}&quot;</strong>:
        </p>

        <div>
          <label className="block text-meta font-medium text-slate-700 mb-1">
            Novo grupo pai:
          </label>
          <GroupPicker
            groups={groups}
            value={targetParentId}
            onChange={setTargetParentId}
            excludeGroupIds={excludeSet}
            allowRoot={true}
            rootLabel="Raiz (Nível Superior)"
          />
          {validationError && (
            <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
              {validationError}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};
