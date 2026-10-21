import React, { useState, useMemo, useCallback } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  FolderPlus,
  ArrowRightLeft,
  Layers,
  HelpCircle,
  Share2,
  Upload,
} from 'lucide-react';
import { BankGroup } from '../../types/bank';
import {
  BankGroupNode,
  buildGroupTree,
} from '../../utils/bank/tree';
import { useBank } from '../../context/BankContext';
import { GroupCreateRenameDialog } from './GroupCreateRenameDialog';
import { GroupMoveDialog } from './GroupMoveDialog';
import { GroupDeleteDialog } from './GroupDeleteDialog';
import { BankImportModal } from './BankImportModal';
import { buildBankShareZip } from '../../utils/bank/shareZip';
import { saveFile } from '../../platform/files';
import { toast } from '../ui/toastStore';
import { cn } from '../ui/cn';

export type GroupSelection =
  | { kind: 'all' }
  | { kind: 'group'; groupId: string }
  | { kind: 'orphan' };

export interface GroupTreeProps {
  selected: GroupSelection;
  onSelect: (selection: GroupSelection) => void;
  className?: string;
  onRequestCreateGroup?: (parentId?: string | null) => void;
}

export function areGroupSelectionsEqual(a: GroupSelection, b: GroupSelection): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'group' && b.kind === 'group') {
    return a.groupId === b.groupId;
  }
  return true;
}

export const GroupTree: React.FC<GroupTreeProps> = ({
  selected,
  onSelect,
  className,
  onRequestCreateGroup,
}) => {
  const {
    groups,
    tags,
    questions,
    blueprints,
    questionCountByGroup,
    createGroup,
    renameGroup,
    moveGroup,
    deleteGroup,
  } = useBank();

  // Expanded group IDs state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);

  const [renameTarget, setRenameTarget] = useState<BankGroup | null>(null);
  const [moveTarget, setMoveTarget] = useState<BankGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BankGroup | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importParentGroupId, setImportParentGroupId] = useState<string | null>(null);

  // Toggle expand
  const toggleExpand = useCallback((groupId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const totalQuestions = questions.length;
  const orphanCount = questionCountByGroup.get(null)?.own ?? 0;

  // Build hierarchical tree
  const treeNodes = useMemo(() => buildGroupTree(groups), [groups]);

  // Handlers for dialogs
  const handleOpenCreate = (parentId: string | null = null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (onRequestCreateGroup) {
      onRequestCreateGroup(parentId);
      if (parentId) {
        setExpandedIds((prev) => new Set([...prev, parentId]));
      }
      return;
    }
    setCreateParentId(parentId);
    setCreateDialogOpen(true);
    if (parentId) {
      setExpandedIds((prev) => new Set([...prev, parentId]));
    }
  };

  const handleOpenRename = (group: BankGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameTarget(group);
  };

  const handleOpenMove = (group: BankGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    setMoveTarget(group);
  };

  const handleOpenDelete = (group: BankGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(group);
  };

  const handleExportGroup = async (group: BankGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const bankData = { groups, tags, questions, blueprints };
      const zipBytes = await buildBankShareZip(bankData, group.id);
      const d = new Date();
      const yyyy = String(d.getFullYear());
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const slug =
        group.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || 'grupo';
      const filename = `gabaritex-banco-${slug}-${yyyy}-${mm}-${dd}.gabaritex-bank.zip`;

      const res = await saveFile({
        suggestedName: filename,
        mime: 'application/zip',
        data: zipBytes,
      });
      if (res.status === 'saved') {
        toast.success(`Grupo "${group.name}" exportado com sucesso.`);
      }
    } catch (err) {
      toast.error(
        `Falha ao exportar grupo: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  // Render a node recursively
  const renderNode = (node: BankGroupNode, depth = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selected.kind === 'group' && selected.groupId === node.id;
    const countInfo = questionCountByGroup.get(node.id);
    const count = countInfo?.total ?? 0;

    return (
      <div key={node.id} className="flex flex-col select-none">
        <div
          role="treeitem"
          aria-selected={isSelected}
          aria-expanded={hasChildren ? isExpanded : undefined}
          tabIndex={0}
          onClick={() => onSelect({ kind: 'group', groupId: node.id })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect({ kind: 'group', groupId: node.id });
            } else if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
              e.preventDefault();
              toggleExpand(node.id);
            } else if (e.key === 'ArrowLeft' && hasChildren && isExpanded) {
              e.preventDefault();
              toggleExpand(node.id);
            }
          }}
          className={cn(
            'group relative flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-medium cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
            isSelected
              ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold'
              : 'text-slate-700 hover:bg-slate-100'
          )}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(node.id, e)}
                className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition"
                aria-label={isExpanded ? 'Recolher subgrupos' : 'Expandir subgrupos'}
              >
                <ChevronRight
                  className={cn(
                    'w-3.5 h-3.5 transition-transform duration-150',
                    isExpanded && 'rotate-90'
                  )}
                />
              </button>
            ) : (
              <span className="w-4 h-4 inline-block shrink-0" aria-hidden="true" />
            )}

            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
            ) : (
              <Folder className="w-3.5 h-3.5 shrink-0 text-slate-400 group-hover:text-slate-600" />
            )}

            <span className="truncate">{node.name}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Quick Actions (visible on hover or focus) */}
            <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex items-center gap-0.5 transition">
              <button
                type="button"
                onClick={(e) => handleOpenCreate(node.id, e)}
                title="Novo subgrupo"
                className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-200 transition"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => handleOpenRename(node, e)}
                title="Renomear grupo"
                className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-200 transition"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => handleOpenMove(node, e)}
                title="Mover grupo"
                className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-200 transition"
              >
                <ArrowRightLeft className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => handleExportGroup(node, e)}
                title="Exportar grupo (.gabaritex-bank.zip)"
                className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-200 transition"
              >
                <Share2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => handleOpenDelete(node, e)}
                title="Excluir grupo"
                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            {/* Question count */}
            <span
              className={cn(
                'min-w-5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-center tabular-nums transition',
                isSelected
                  ? 'bg-indigo-200/60 dark:bg-indigo-500/30 text-indigo-800 dark:text-indigo-200'
                  : 'bg-slate-100 text-slate-500'
              )}
            >
              {count}
            </span>
          </div>
        </div>

        {/* Render children if expanded */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        'w-full md:w-64 flex flex-col rounded-xl border border-slate-200 bg-white p-2 select-none shrink-0',
        className
      )}
      aria-label="Árvore de Grupos"
    >
      {/* Header com botões Importar e Novo Grupo Raiz */}
      <div className="flex items-center justify-between px-2 py-1.5 mb-1 border-b border-slate-100">
        <span className="text-meta font-bold uppercase tracking-wider text-slate-500">
          Grupos
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setImportParentGroupId(null);
              setImportModalOpen(true);
            }}
            title="Importar Questões (.gabaritex-bank.zip)"
            className="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition"
          >
            <Upload className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleOpenCreate(null)}
            title="Novo Grupo Raiz"
            className="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div role="tree" className="flex flex-col gap-0.5 overflow-y-auto max-h-[calc(100vh-240px)]">
        {/* Todas as questões */}
        <div
          role="treeitem"
          aria-selected={selected.kind === 'all'}
          tabIndex={0}
          onClick={() => onSelect({ kind: 'all' })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect({ kind: 'all' });
            }
          }}
          className={cn(
            'flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-medium cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
            selected.kind === 'all'
              ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold'
              : 'text-slate-700 hover:bg-slate-100'
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="truncate">Todas as Questões</span>
          </div>
          <span
            className={cn(
              'min-w-5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-center tabular-nums',
              selected.kind === 'all'
                ? 'bg-indigo-200/60 dark:bg-indigo-500/30 text-indigo-800 dark:text-indigo-200'
                : 'bg-slate-100 text-slate-500'
            )}
          >
            {totalQuestions}
          </span>
        </div>

        {/* Tree hierarchy */}
        {treeNodes.map((node) => renderNode(node, 0))}

        {/* Sem Grupo (Orphan questions) */}
        <div
          role="treeitem"
          aria-selected={selected.kind === 'orphan'}
          tabIndex={0}
          onClick={() => onSelect({ kind: 'orphan' })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect({ kind: 'orphan' });
            }
          }}
          className={cn(
            'flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-medium cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 mt-1 pt-1.5 border-t border-slate-100',
            selected.kind === 'orphan'
              ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold'
              : 'text-slate-700 hover:bg-slate-100'
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">Sem Grupo</span>
          </div>
          <span
            className={cn(
              'min-w-5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-center tabular-nums',
              selected.kind === 'orphan'
                ? 'bg-indigo-200/60 dark:bg-indigo-500/30 text-indigo-800 dark:text-indigo-200'
                : 'bg-slate-100 text-slate-500'
            )}
          >
            {orphanCount}
          </span>
        </div>
      </div>

      {/* Dialogs */}
      {!onRequestCreateGroup && (
        <GroupCreateRenameDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          mode="create"
          defaultParentId={createParentId}
          groups={groups}
          onSave={async (name, parentId) => {
            const res = await createGroup({ name, parentId });
            return Boolean(res);
          }}
        />
      )}

      <GroupCreateRenameDialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        mode="rename"
        group={renameTarget}
        groups={groups}
        onSave={async (name) => {
          if (!renameTarget) return false;
          return renameGroup(renameTarget.id, name);
        }}
      />

      <GroupMoveDialog
        open={Boolean(moveTarget)}
        onOpenChange={(open) => !open && setMoveTarget(null)}
        group={moveTarget}
        groups={groups}
        onCreateGroup={createGroup}
        onMove={async (id, targetParentId) => {
          return moveGroup(id, targetParentId);
        }}
      />

      <GroupDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        group={deleteTarget}
        groups={groups}
        questions={questions}
        onCreateGroup={createGroup}
        onConfirm={async (id, strategy) => {
          return deleteGroup(id, strategy);
        }}
      />

      <BankImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        defaultParentGroupId={importParentGroupId}
      />
    </aside>
  );
};
