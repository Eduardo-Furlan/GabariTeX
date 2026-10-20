import React, { useState } from 'react';
import {
  ArrowRightLeft,
  Tags,
  Archive,
  ArchiveRestore,
  Trash2,
  X,
} from 'lucide-react';
import { BankGroup, BankQuestion, BankTag } from '../../types/bank';
import { GroupPicker } from './GroupPicker';
import { TagBadge } from './TagBadge';
import { Modal } from '../ui/Modal';
import { cn } from '../ui/cn';

export interface BulkActionsBarProps {
  selectedQuestionIds: Set<string>;
  questions: BankQuestion[];
  groups: BankGroup[];
  tags: BankTag[];
  onClearSelection: () => void;
  onMoveQuestions: (questionIds: string[], targetGroupId: string | null) => Promise<boolean>;
  onApplyTags: (
    questionIds: string[],
    tagsToAdd: string[],
    tagsToRemove: string[]
  ) => Promise<boolean>;
  onArchiveToggle: (questionIds: string[], archive: boolean) => Promise<boolean>;
  onDeleteQuestions: (questionIds: string[]) => Promise<boolean>;
  className?: string;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedQuestionIds,
  questions,
  groups,
  tags,
  onClearSelection,
  onMoveQuestions,
  onApplyTags,
  onArchiveToggle,
  onDeleteQuestions,
  className,
}) => {
  const count = selectedQuestionIds.size;
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);

  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagsToAdd, setTagsToAdd] = useState<Set<string>>(new Set());
  const [tagsToRemove, setTagsToRemove] = useState<Set<string>>(new Set());

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (count === 0) return null;

  const selectedList = questions.filter((q) => selectedQuestionIds.has(q.id));
  const allArchived = selectedList.length > 0 && selectedList.every((q) => q.archived);

  const handleConfirmMove = async () => {
    setIsProcessing(true);
    try {
      const ok = await onMoveQuestions(Array.from(selectedQuestionIds), targetGroupId);
      if (ok) {
        setMoveModalOpen(false);
        onClearSelection();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmTags = async () => {
    setIsProcessing(true);
    try {
      const ok = await onApplyTags(
        Array.from(selectedQuestionIds),
        Array.from(tagsToAdd),
        Array.from(tagsToRemove)
      );
      if (ok) {
        setTagModalOpen(false);
        setTagsToAdd(new Set());
        setTagsToRemove(new Set());
        onClearSelection();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsProcessing(true);
    try {
      const ok = await onDeleteQuestions(Array.from(selectedQuestionIds));
      if (ok) {
        setDeleteModalOpen(false);
        onClearSelection();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleArchive = async () => {
    setIsProcessing(true);
    try {
      const ok = await onArchiveToggle(Array.from(selectedQuestionIds), !allArchived);
      if (ok) {
        onClearSelection();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Floating or Docked Bulk Bar */}
      <div
        className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[calc(100%-2rem)]',
          'flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl',
          'border border-slate-700 bg-slate-900 text-slate-100 shadow-overlay select-none',
          className
        )}
        role="region"
        aria-label="Ações em massa"
      >
        {/* Counter and clear button */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="min-w-6 px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-500 text-on-accent tabular-nums">
            {count}
          </span>
          <span className="text-xs font-medium truncate">
            {count === 1 ? 'questão selecionada' : 'questões selecionadas'}
          </span>
          <button
            type="button"
            onClick={onClearSelection}
            className="p-1 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            aria-label="Desmarcar todas"
            title="Desmarcar todas"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => {
              setTargetGroupId(null);
              setMoveModalOpen(true);
            }}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            title="Mover para outro grupo"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Mover</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTagsToAdd(new Set());
              setTagsToRemove(new Set());
              setTagModalOpen(true);
            }}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            title="Adicionar ou remover etiquetas"
          >
            <Tags className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Etiquetar</span>
          </button>

          <button
            type="button"
            onClick={handleToggleArchive}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            title={allArchived ? 'Desarquivar questões' : 'Arquivar questões'}
          >
            {allArchived ? (
              <>
                <ArchiveRestore className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Desarquivar</span>
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Arquivar</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-rose-600 hover:bg-rose-700 text-on-accent transition"
            title="Excluir selecionadas"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Excluir</span>
          </button>
        </div>
      </div>

      {/* Move Modal */}
      <Modal
        open={moveModalOpen}
        onOpenChange={setMoveModalOpen}
        title="Mover Questões"
        description={`Mover ${count} ${count === 1 ? 'questão selecionada' : 'questões selecionadas'} para outro grupo:`}
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setMoveModalOpen(false)}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-medium transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmMove}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-on-accent text-sm font-semibold shadow-xs disabled:opacity-50 transition"
            >
              {isProcessing ? 'Movendo...' : 'Mover Questões'}
            </button>
          </div>
        }
      >
        <div className="py-2">
          <label className="block text-meta font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Grupo de Destino
          </label>
          <GroupPicker
            groups={groups}
            value={targetGroupId}
            onChange={setTargetGroupId}
            rootLabel="Sem Grupo (Raiz)"
          />
        </div>
      </Modal>

      {/* Tag Modal */}
      <Modal
        open={tagModalOpen}
        onOpenChange={setTagModalOpen}
        title="Gerenciar Etiquetas em Massa"
        description={`Aplique ou remova etiquetas em ${count} ${count === 1 ? 'questão selecionada' : 'questões selecionadas'}:`}
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setTagModalOpen(false)}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-medium transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmTags}
              disabled={isProcessing || (tagsToAdd.size === 0 && tagsToRemove.size === 0)}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-on-accent text-sm font-semibold shadow-xs disabled:opacity-50 transition"
            >
              {isProcessing ? 'Aplicando...' : 'Aplicar Alterações'}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 py-2">
          {tags.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              Nenhuma etiqueta cadastrada ainda.
            </p>
          ) : (
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
              {tags.map((tag) => {
                const isAdding = tagsToAdd.has(tag.id);
                const isRemoving = tagsToRemove.has(tag.id);

                return (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between gap-3 p-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <TagBadge name={tag.name} color={tag.color} />

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setTagsToRemove((prev) => {
                            const n = new Set(prev);
                            n.delete(tag.id);
                            return n;
                          });
                          setTagsToAdd((prev) => {
                            const n = new Set(prev);
                            if (n.has(tag.id)) n.delete(tag.id);
                            else n.add(tag.id);
                            return n;
                          });
                        }}
                        className={cn(
                          'px-2 py-1 rounded text-xs font-semibold transition',
                          isAdding
                            ? 'bg-emerald-600 text-on-accent'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        )}
                      >
                        {isAdding ? 'Adicionar ✓' : '+ Adicionar'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTagsToAdd((prev) => {
                            const n = new Set(prev);
                            n.delete(tag.id);
                            return n;
                          });
                          setTagsToRemove((prev) => {
                            const n = new Set(prev);
                            if (n.has(tag.id)) n.delete(tag.id);
                            else n.add(tag.id);
                            return n;
                          });
                        }}
                        className={cn(
                          'px-2 py-1 rounded text-xs font-semibold transition',
                          isRemoving
                            ? 'bg-rose-600 text-on-accent'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        )}
                      >
                        {isRemoving ? 'Remover ✓' : '- Remover'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Excluir Questões Selecionadas"
        description="Esta ação é permanente e removerá as questões do banco."
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setDeleteModalOpen(false)}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-medium transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-on-accent text-sm font-semibold shadow-xs disabled:opacity-50 transition"
            >
              {isProcessing ? 'Excluindo...' : 'Excluir Definitivamente'}
            </button>
          </div>
        }
      >
        <div className="py-2">
          <p className="text-sm text-slate-700">
            Tem certeza de que deseja excluir permanentemente{' '}
            <strong>
              {count} {count === 1 ? 'questão selecionada' : 'questões selecionadas'}
            </strong>
            ? Provas existentes que usam essas questões manterão seu conteúdo preservado, mas a
            questão não estará mais disponível no banco.
          </p>
        </div>
      </Modal>
    </>
  );
};
