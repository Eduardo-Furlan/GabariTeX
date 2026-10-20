import React, { useState, useEffect, useMemo } from 'react';
import { BankGroup } from '../../types/bank';
import { validateGroupName, caseInsensitiveKey } from '../../utils/bank/names';
import { depthOf, MAX_GROUP_DEPTH } from '../../utils/bank/tree';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { GroupPicker } from './GroupPicker';

export interface GroupCreateRenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'rename';
  group?: BankGroup | null;
  defaultParentId?: string | null;
  groups: readonly BankGroup[];
  onSave: (name: string, parentId: string | null) => Promise<boolean>;
}

export const GroupCreateRenameDialog: React.FC<GroupCreateRenameDialogProps> = ({
  open,
  onOpenChange,
  mode,
  group,
  defaultParentId = null,
  groups,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | null>(defaultParentId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      if (mode === 'rename' && group) {
        setName(group.name);
        setParentId(group.parentId);
      } else {
        setName('');
        setParentId(defaultParentId);
      }
      setTouched(false);
      setIsSubmitting(false);
    }
  }, [open, mode, group, defaultParentId]);

  const validationError = useMemo(() => {
    const val = validateGroupName(name);
    if (!val.valid) {
      return val.error;
    }

    if (mode === 'create') {
      if (parentId !== null) {
        const parentDepth = depthOf(groups, parentId);
        if (parentDepth + 1 > MAX_GROUP_DEPTH) {
          return `Profundidade máxima de ${MAX_GROUP_DEPTH} níveis excedida.`;
        }
      }
    }

    // Sibling uniqueness check
    const nameKey = caseInsensitiveKey(val.normalized);
    const isDuplicate = groups.some(
      (g) =>
        g.parentId === parentId &&
        (mode === 'create' || g.id !== group?.id) &&
        caseInsensitiveKey(g.name) === nameKey
    );

    if (isDuplicate) {
      return `Já existe um subgrupo com o nome "${val.normalized}" neste nível.`;
    }

    return null;
  }, [name, parentId, mode, group, groups]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setTouched(true);
    if (validationError) return;

    setIsSubmitting(true);
    try {
      const ok = await onSave(name.trim(), parentId);
      if (ok) {
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = mode === 'create' ? 'Novo Grupo' : 'Renomear Grupo';

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
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
            onClick={() => handleSubmit()}
            loading={isSubmitting}
            disabled={Boolean(touched && validationError)}
          >
            {mode === 'create' ? 'Criar Grupo' : 'Salvar Alterações'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'create' && (
          <div>
            <label className="block text-meta font-medium text-slate-700 mb-1">
              Grupo pai (opcional):
            </label>
            <GroupPicker
              groups={groups}
              value={parentId}
              onChange={setParentId}
              allowRoot={true}
              rootLabel="Raiz (Nível Superior)"
            />
          </div>
        )}

        <div>
          <label className="block text-meta font-medium text-slate-700 mb-1">
            Nome do grupo:
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setTouched(true);
            }}
            placeholder="Ex: Geometria, Análise Combinatória, etc."
            maxLength={60}
            autoFocus
            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {touched && validationError && (
            <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
              {validationError}
            </p>
          )}
          <p className="mt-1 text-meta text-slate-400">
            Máximo 60 caracteres. Não pode conter barras (&quot;/&quot;).
          </p>
        </div>
      </form>
    </Modal>
  );
};
