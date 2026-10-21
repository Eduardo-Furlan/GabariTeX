import React, { useState, useMemo } from 'react';
import { FolderPlus } from 'lucide-react';
import { BankGroup } from '../../types/bank';
import { pathOf } from '../../utils/bank/tree';
import { Select, SelectOption } from '../ui/Select';
import { GroupCreateRenameDialog } from './GroupCreateRenameDialog';
import { cn } from '../ui/cn';

export interface GroupPickerProps {
  groups: readonly BankGroup[];
  value: string | null;
  onChange: (groupId: string | null) => void;
  excludeGroupIds?: ReadonlySet<string>;
  allowRoot?: boolean;
  rootLabel?: string;
  disabled?: boolean;
  className?: string;
  onCreateGroup?: (input: { name: string; parentId: string | null }) => Promise<BankGroup | null>;
}

export async function handleInlineGroupCreate(
  onCreateGroup: (input: { name: string; parentId: string | null }) => Promise<BankGroup | null>,
  name: string,
  parentId: string | null,
  onChange: (groupId: string | null) => void
): Promise<boolean> {
  const res = await onCreateGroup({ name, parentId });
  if (res) {
    onChange(res.id);
    return true;
  }
  return false;
}

export const GroupPicker: React.FC<GroupPickerProps> = ({
  groups,
  value,
  onChange,
  excludeGroupIds,
  allowRoot = true,
  rootLabel = 'Raiz (Nível Superior)',
  disabled = false,
  className,
  onCreateGroup,
}) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const options = useMemo(() => {
    const list: SelectOption<string>[] = [];

    if (allowRoot) {
      list.push({
        value: '__root__',
        label: rootLabel,
      });
    }

    const available = groups.filter((g) => !excludeGroupIds?.has(g.id));

    // Sort by path
    const withPaths = available.map((g) => ({
      group: g,
      path: pathOf(groups, g.id),
    }));

    withPaths.sort((a, b) => a.path.localeCompare(b.path, 'pt-BR'));

    for (const item of withPaths) {
      list.push({
        value: item.group.id,
        label: item.path,
      });
    }

    return list;
  }, [groups, excludeGroupIds, allowRoot, rootLabel]);

  const selectValue = value === null ? '__root__' : value;

  const handleChange = (selectedVal: string) => {
    if (selectedVal === '__root__') {
      onChange(null);
    } else {
      onChange(selectedVal);
    }
  };

  if (!onCreateGroup) {
    return (
      <Select
        options={options}
        value={selectValue}
        onChange={handleChange}
        disabled={disabled}
        className={className}
        placeholder="Selecione o grupo..."
      />
    );
  }

  return (
    <>
      <div className={cn('flex items-center gap-2', className)}>
        <div className="flex-1 min-w-0">
          <Select
            options={options}
            value={selectValue}
            onChange={handleChange}
            disabled={disabled}
            placeholder="Selecione o grupo..."
          />
        </div>
        <button
          type="button"
          onClick={() => setCreateDialogOpen(true)}
          disabled={disabled}
          className="shrink-0 px-2.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
          title="Criar novo grupo"
        >
          <FolderPlus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Novo Grupo</span>
        </button>
      </div>

      <GroupCreateRenameDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        mode="create"
        groups={groups}
        onSave={async (name, parentId) => {
          return handleInlineGroupCreate(onCreateGroup, name, parentId, onChange);
        }}
      />
    </>
  );
};
