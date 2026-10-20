import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Copy,
  Pencil,
  Trash2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { Blueprint } from '../../types/bank';
import { useBank } from '../../context/BankContext';
import { detectBrokenReferences } from '../../utils/bank/blueprint';
import { generateBankId } from '../../utils/bank/ids';
import { Route } from '../../router/hashRouter';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { EmptyState, BubbleGridIllustration } from '../ui/EmptyState';

export interface BlueprintListProps {
  onNavigate?: (route: Route) => void;
}

export const BlueprintList: React.FC<BlueprintListProps> = ({ onNavigate }) => {
  const { blueprints, groups, tags, saveBlueprint, deleteBlueprint } = useBank();

  const [renamingBlueprint, setRenamingBlueprint] = useState<Blueprint | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');

  const [deletingBlueprint, setDeletingBlueprint] = useState<Blueprint | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const validGroupIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups]);
  const validTagIds = useMemo(() => new Set(tags.map((t) => t.id)), [tags]);

  const handleDuplicate = async (bp: Blueprint) => {
    const now = new Date().toISOString();
    const cloned: Blueprint = {
      ...bp,
      id: generateBankId(),
      name: `${bp.name} (cópia)`,
      createdAt: now,
      updatedAt: now,
    };
    await saveBlueprint(cloned);
  };

  const handleOpenRename = (bp: Blueprint) => {
    setRenamingBlueprint(bp);
    setRenameValue(bp.name);
    setRenameError('');
  };

  const handleConfirmRename = async () => {
    if (!renamingBlueprint) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameError('O nome do modelo não pode ser vazio.');
      return;
    }
    await saveBlueprint({
      ...renamingBlueprint,
      name: trimmed,
      updatedAt: new Date().toISOString(),
    });
    setRenamingBlueprint(null);
  };

  const handleOpenDelete = (bp: Blueprint) => {
    setDeletingBlueprint(bp);
  };

  const handleConfirmDelete = async () => {
    if (!deletingBlueprint) return;
    setIsDeleting(true);
    try {
      await deleteBlueprint(deletingBlueprint.id);
      setDeletingBlueprint(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (blueprints.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <EmptyState
          illustration={<BubbleGridIllustration />}
          title="Nenhum modelo de prova cadastrado"
          description="Crie modelos com regras de sorteio por grupos e etiquetas para automatizar a geração balanceada e consistente de avaliações."
          actions={
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => onNavigate?.({ type: 'bank_generate' })}
            >
              Criar Primeiro Modelo
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col space-y-4">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Modelos Salvos</span>
            <span className="text-xs font-normal text-slate-500">
              ({blueprints.length} {blueprints.length === 1 ? 'modelo' : 'modelos'})
            </span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Gere provas instantaneamente ou edite as regras taxonômicas dos seus modelos.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => onNavigate?.({ type: 'bank_generate' })}
        >
          Novo Modelo
        </Button>
      </div>

      {/* Grid of blueprints */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {blueprints.map((bp) => {
          const totalQuestions = bp.blocks.reduce(
            (sum, b) => sum + (b.quotas?.reduce((qSum, q) => qSum + q.count, 0) ?? 0),
            0
          );
          const broken = detectBrokenReferences(bp, validGroupIds, validTagIds);

          return (
            <div
              key={bp.id}
              className="flex flex-col justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-2xs hover:shadow-xs transition"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-slate-900 text-sm line-clamp-2">
                    {bp.name}
                  </h3>
                  {broken.broken ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 shrink-0"
                      title={
                        broken.missingGroups.length > 0
                          ? 'Contém grupos que foram excluídos do banco'
                          : 'Contém etiquetas que foram excluídas do banco'
                      }
                    >
                      <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                      <span>{broken.missingGroups.length > 0 ? 'Grupo removido' : 'Etiqueta removida'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>OK</span>
                    </span>
                  )}
                </div>

                {bp.description && (
                  <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                    {bp.description}
                  </p>
                )}

                <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                  <span>
                    {`${bp.blocks.length} ${bp.blocks.length === 1 ? 'bloco' : 'blocos'}`}
                  </span>
                  <span>•</span>
                  <span>
                    {`${totalQuestions} ${totalQuestions === 1 ? 'questão' : 'questões'}`}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Sparkles className="w-3.5 h-3.5" />}
                  onClick={() => onNavigate?.({ type: 'bank_generate', blueprintId: bp.id })}
                >
                  Gerar
                </Button>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Copy className="w-3.5 h-3.5" />}
                    title="Duplicar modelo"
                    onClick={() => handleDuplicate(bp)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Pencil className="w-3.5 h-3.5" />}
                    title="Renomear modelo"
                    onClick={() => handleOpenRename(bp)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    title="Excluir modelo"
                    onClick={() => handleOpenDelete(bp)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rename Modal */}
      <Modal
        open={Boolean(renamingBlueprint)}
        onOpenChange={(open) => {
          if (!open) setRenamingBlueprint(null);
        }}
        title="Renomear Modelo de Prova"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setRenamingBlueprint(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleConfirmRename}>
              Salvar
            </Button>
          </div>
        }
      >
        <div className="space-y-3 py-2">
          <label className="block text-xs font-semibold text-slate-700">
            Nome do Modelo
          </label>
          <input
            type="text"
            value={renameValue}
            onChange={(e) => {
              setRenameValue(e.target.value);
              setRenameError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirmRename();
              }
            }}
            placeholder="Ex: Prova de Matemática - 1º Bimestre"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
          {renameError && <p className="text-xs text-rose-600 dark:text-rose-400">{renameError}</p>}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={Boolean(deletingBlueprint)}
        onOpenChange={(open) => {
          if (!open) setDeletingBlueprint(null);
        }}
        title="Excluir Modelo de Prova"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setDeletingBlueprint(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              loading={isDeleting}
            >
              Excluir Modelo
            </Button>
          </div>
        }
      >
        <div className="space-y-2 py-2">
          <p className="text-sm text-slate-700">
            Tem certeza que deseja excluir o modelo{' '}
            <strong className="text-slate-900">
              "{deletingBlueprint?.name}"
            </strong>
            ?
          </p>
          <p className="text-xs text-slate-500">
            Esta ação não pode ser desfeita. Nenhuma questão do banco ou prova já criada será afetada.
          </p>
        </div>
      </Modal>
    </div>
  );
};
