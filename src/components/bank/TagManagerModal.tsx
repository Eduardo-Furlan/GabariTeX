import React, { useState } from 'react';
import {
  Pencil,
  Trash2,
  GitMerge,
  Check,
  X,
  Palette,
} from 'lucide-react';
import { BankTag, TagColor } from '../../types/bank';
import { TAG_COLORS } from '../../utils/bank/tags';
import { validateTagName } from '../../utils/bank/names';
import { Modal } from '../ui/Modal';
import { TagBadge } from './TagBadge';
import { Select } from '../ui/Select';
import { cn } from '../ui/cn';

export interface TagManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: BankTag[];
  questionCountByTag: Map<string, number>;
  onRenameTag: (id: string, name: string) => Promise<boolean>;
  onUpdateColor: (id: string, color: TagColor) => Promise<boolean>;
  onDeleteTag: (id: string) => Promise<boolean>;
  onMergeTag: (sourceId: string, targetId: string) => Promise<boolean>;
}

export const TagManagerModal: React.FC<TagManagerModalProps> = ({
  open,
  onOpenChange,
  tags,
  questionCountByTag,
  onRenameTag,
  onUpdateColor,
  onDeleteTag,
  onMergeTag,
}) => {
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const [mergingSourceId, setMergingSourceId] = useState<string | null>(null);
  const [targetTagId, setTargetTagId] = useState<string>('');

  const [colorPickerTagId, setColorPickerTagId] = useState<string | null>(null);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);

  const startEdit = (tag: BankTag) => {
    setEditingTagId(tag.id);
    setEditName(tag.name);
    setEditError(null);
  };

  const handleSaveRename = async (id: string) => {
    const val = validateTagName(editName);
    if (!val.valid) {
      setEditError(val.error ?? 'Nome inválido');
      return;
    }

    const success = await onRenameTag(id, val.normalized);
    if (success) {
      setEditingTagId(null);
      setEditError(null);
    }
  };

  const handleConfirmMerge = async () => {
    if (!mergingSourceId || !targetTagId || mergingSourceId === targetTagId) return;
    const success = await onMergeTag(mergingSourceId, targetTagId);
    if (success) {
      setMergingSourceId(null);
      setTargetTagId('');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTagId) return;
    const success = await onDeleteTag(deletingTagId);
    if (success) {
      setDeletingTagId(null);
    }
  };

  const deletingTag = tags.find((t) => t.id === deletingTagId);
  const deletingCount = deletingTagId ? questionCountByTag.get(deletingTagId) ?? 0 : 0;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Gerenciar Etiquetas"
      description="Renomeie, altere cores, mescle ou exclua etiquetas do banco de questões."
      size="lg"
    >
      <div className="flex flex-col gap-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
        {tags.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-500">
            Nenhuma etiqueta cadastrada ainda.
          </div>
        ) : (
          tags.map((tag) => {
            const count = questionCountByTag.get(tag.id) ?? 0;
            const isEditing = editingTagId === tag.id;
            const isPickingColor = colorPickerTagId === tag.id;

            return (
              <div
                key={tag.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition"
              >
                {/* Left: Tag Badge or Edit Input */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => {
                            setEditName(e.target.value);
                            setEditError(null);
                          }}
                          className="px-2.5 py-1 text-xs rounded border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          autoFocus
                          maxLength={40}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(tag.id)}
                          className="p-1 rounded bg-indigo-600 hover:bg-indigo-700 text-on-accent transition"
                          title="Salvar nome"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTagId(null)}
                          className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {editError && (
                        <span className="text-[11px] text-rose-600 font-medium">
                          {editError}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <TagBadge name={tag.name} color={tag.color} />
                      <span className="text-meta text-slate-400 tabular-nums">
                        {count === 1 ? '1 questão' : `${count} questões`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Palette Color Picker */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setColorPickerTagId(isPickingColor ? null : tag.id)
                      }
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                      title="Alterar cor"
                    >
                      <Palette className="w-3.5 h-3.5" />
                    </button>

                    {isPickingColor && (
                      <div className="absolute right-0 top-full mt-1 z-30 p-2 rounded-xl border border-slate-200 bg-white shadow-overlay flex items-center gap-1.5">
                        {TAG_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={async () => {
                              await onUpdateColor(tag.id, c);
                              setColorPickerTagId(null);
                            }}
                            className={cn(
                              'w-5 h-5 rounded-full border transition flex items-center justify-center',
                              tag.color === c
                                ? 'ring-2 ring-indigo-500 scale-110'
                                : 'opacity-70 hover:opacity-100'
                            )}
                          >
                            <TagBadge name="" color={c} className="p-0 border-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Rename button */}
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => startEdit(tag)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
                      title="Renomear etiqueta"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Merge button */}
                  <button
                    type="button"
                    onClick={() => {
                      setMergingSourceId(tag.id);
                      setTargetTagId('');
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
                    title="Mesclar etiqueta"
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => setDeletingTagId(tag.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition"
                    title="Excluir etiqueta"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* Merge Confirmation Section */}
        {mergingSourceId && (
          <div className="mt-3 p-3 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20 flex flex-col gap-2">
            <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
              Mesclar &quot;{tags.find((t) => t.id === mergingSourceId)?.name}&quot; em:
            </span>
            <div className="flex items-center gap-2">
              <Select
                size="sm"
                value={targetTagId}
                onChange={setTargetTagId}
                placeholder="Selecione o destino..."
                options={tags
                  .filter((t) => t.id !== mergingSourceId)
                  .map((t) => ({ value: t.id, label: t.name }))}
                className="flex-1"
              />
              <button
                type="button"
                onClick={handleConfirmMerge}
                disabled={!targetTagId}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-on-accent text-xs font-semibold disabled:opacity-50 transition"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setMergingSourceId(null)}
                className="px-2.5 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-200 transition"
              >
                Cancelar
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Todas as questões com a etiqueta de origem receberão a etiqueta de destino.
            </p>
          </div>
        )}

        {/* Delete Confirmation Section */}
        {deletingTagId && deletingTag && (
          <div className="mt-3 p-3 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 flex flex-col gap-2">
            <span className="text-xs font-semibold text-rose-900 dark:text-rose-200">
              Excluir etiqueta &quot;{deletingTag.name}&quot;?
            </span>
            <p className="text-[11px] text-slate-600">
              Esta etiqueta está presente em{' '}
              <strong>
                {deletingCount} {deletingCount === 1 ? 'questão' : 'questões'}
              </strong>
              . Ao excluir, ela será removida de todas as questões.
            </p>
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeletingTagId(null)}
                className="px-2.5 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-200 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-on-accent text-xs font-semibold transition"
              >
                Excluir Definitivamente
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
