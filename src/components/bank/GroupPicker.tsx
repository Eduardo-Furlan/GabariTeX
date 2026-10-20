import React, { useMemo } from 'react';
import { BankGroup } from '../../types/bank';
import { pathOf } from '../../utils/bank/tree';
import { Select, SelectOption } from '../ui/Select';

export interface GroupPickerProps {
  groups: readonly BankGroup[];
  value: string | null;
  onChange: (groupId: string | null) => void;
  excludeGroupIds?: ReadonlySet<string>;
  allowRoot?: boolean;
  rootLabel?: string;
  disabled?: boolean;
  className?: string;
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
}) => {
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
};
