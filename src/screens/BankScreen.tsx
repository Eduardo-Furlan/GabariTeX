import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  FolderTree,
  Layers,
  Plus,
  Sparkles,
  Tags,
  Upload,
  X,
} from 'lucide-react';
import { useBank } from '../context/BankContext';
import { Route } from '../router/hashRouter';
import { BubbleLoader } from '../components/ui/BubbleLoader';
import { EmptyState, BubbleGridIllustration } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { Segmented } from '../components/ui/Segmented';
import { GroupTree, GroupSelection } from '../components/bank/GroupTree';
import { QuestionList } from '../components/bank/QuestionList';
import { QuestionEditorModal } from '../components/bank/QuestionEditorModal';
import { TagManagerModal } from '../components/bank/TagManagerModal';
import { BankImportModal } from '../components/bank/BankImportModal';
import { BulkActionsBar } from '../components/bank/BulkActionsBar';
import { GroupPicker } from '../components/bank/GroupPicker';
import { BlueprintList } from '../components/bank/BlueprintList';
import { BankQuestion } from '../types/bank';
import { generateBankId } from '../utils/bank/ids';

export interface BankScreenProps {
  onNavigate?: (route: Route) => void;
}

export const BankScreen: React.FC<BankScreenProps> = ({ onNavigate }) => {
  const {
    isLoaded,
    isLoading,
    ensureLoaded,
    groups,
    tags,
    questions,
    usageCounts,
    saveQuestion,
    saveQuestions,
    deleteQuestions,
    archiveQuestions,
    createTag,
    renameTag,
    updateTagColor,
    deleteTag,
    mergeTags,
  } = useBank();

  // Local state
  const [activeTab, setActiveTab] = useState<'questions' | 'blueprints'>('questions');
  const [selectedGroup, setSelectedGroup] = useState<GroupSelection>({ kind: 'all' });
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Modals state
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<BankQuestion | null>(null);

  const [tagManagerOpen, setTagManagerOpen] = useState(false);

  const [movingQuestion, setMovingQuestion] = useState<BankQuestion | null>(null);
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);

  const [deletingQuestion, setDeletingQuestion] = useState<BankQuestion | null>(null);
  const [bankImportOpen, setBankImportOpen] = useState(false);

  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);

  // Question count per tag
  const questionCountByTag = useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of questions) {
      if (q.tagIds) {
        for (const tid of q.tagIds) {
          counts.set(tid, (counts.get(tid) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [questions]);

  // Selection handlers
  const handleToggleSelectQuestion = useCallback((id: string) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAllQuestions = useCallback((ids: string[]) => {
    setSelectedQuestionIds(new Set(ids));
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedQuestionIds(new Set());
  }, []);

  // CRUD actions on single questions
  const handleOpenNewQuestion = () => {
    setEditingQuestion(null);
    setEditorModalOpen(true);
  };

  const handleEditQuestion = (question: BankQuestion) => {
    setEditingQuestion(question);
    setEditorModalOpen(true);
  };

  const handleDuplicateQuestion = async (question: BankQuestion) => {
    const now = new Date().toISOString();
    const cloned: BankQuestion = {
      ...question,
      id: generateBankId(),
      prompt: `${question.prompt} (cópia)`,
      createdAt: now,
      updatedAt: now,
    };
    await saveQuestion(cloned);
  };

  const handleOpenMoveQuestion = (question: BankQuestion) => {
    setMovingQuestion(question);
    setTargetGroupId(question.groupId);
  };

  const handleConfirmSingleMove = async () => {
    if (!movingQuestion) return;
    await saveQuestion({
      ...movingQuestion,
      groupId: targetGroupId,
      updatedAt: new Date().toISOString(),
    });
    setMovingQuestion(null);
  };

  const handleArchiveToggleQuestion = async (question: BankQuestion) => {
    await archiveQuestions([question.id], !question.archived);
  };

  const handleOpenDeleteQuestion = (question: BankQuestion) => {
    setDeletingQuestion(question);
  };

  const handleConfirmSingleDelete = async () => {
    if (!deletingQuestion) return;
    await deleteQuestions([deletingQuestion.id]);
    setDeletingQuestion(null);
  };

  // Bulk actions handlers
  const handleBulkMove = async (ids: string[], targetGroup: string | null): Promise<boolean> => {
    const toUpdate = questions.filter((q) => ids.includes(q.id));
    const now = new Date().toISOString();
    const updated = toUpdate.map((q) => ({
      ...q,
      groupId: targetGroup,
      updatedAt: now,
    }));
    const res = await saveQuestions(updated);
    return res.ok;
  };

  const handleBulkApplyTags = async (
    ids: string[],
    tagsToAdd: string[],
    tagsToRemove: string[]
  ): Promise<boolean> => {
    const toUpdate = questions.filter((q) => ids.includes(q.id));
    const now = new Date().toISOString();
    const removeSet = new Set(tagsToRemove);

    const updated = toUpdate.map((q) => {
      const currentTags = (q.tagIds ?? []).filter((tid) => !removeSet.has(tid));
      for (const addTid of tagsToAdd) {
        if (!currentTags.includes(addTid) && currentTags.length < 20) {
          currentTags.push(addTid);
        }
      }
      return {
        ...q,
        tagIds: currentTags,
        updatedAt: now,
      };
    });

    const res = await saveQuestions(updated);
    return res.ok;
  };

  const handleBulkArchive = async (ids: string[], archive: boolean): Promise<boolean> => {
    return await archiveQuestions(ids, archive);
  };

  const handleBulkDelete = async (ids: string[]): Promise<boolean> => {
    return await deleteQuestions(ids);
  };

  if (!isLoaded && isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <BubbleLoader size="lg" />
        <span className="text-meta font-medium text-slate-500 mt-4">
          Carregando Banco de Questões...
        </span>
      </div>
    );
  }

  const defaultGroupIdForNew =
    selectedGroup.kind === 'group' ? selectedGroup.groupId : null;

  return (
    <div className="screen-enter max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col flex-1 min-w-0">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-2xl text-slate-900">
              Banco de Questões
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 tabular-nums">
              {questions.length} {questions.length === 1 ? 'questão' : 'questões'}
            </span>
          </div>
          <p className="text-body text-slate-600 mt-1">
            Organize seu acervo pedagógico por grupos taxonômicos, etiquetas e gere provas
            aleatórias.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Segmented
            value={activeTab}
            onChange={(val) => setActiveTab(val as 'questions' | 'blueprints')}
            options={[
              { value: 'questions', label: 'Questões', icon: <FileText className="w-3.5 h-3.5" /> },
              { value: 'blueprints', label: 'Modelos de Prova', icon: <Layers className="w-3.5 h-3.5" /> },
            ]}
            size="sm"
          />

          {activeTab === 'questions' ? (
            <>
              <button
                type="button"
                onClick={() => setBankImportOpen(true)}
                className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium transition flex items-center gap-1.5"
                title="Importar acervo compartilhado (.gabaritex-bank.zip)"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Importar</span>
              </button>

              <button
                type="button"
                onClick={() => setTagManagerOpen(true)}
                className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium transition flex items-center gap-1.5"
                title="Gerenciar etiquetas do banco"
              >
                <Tags className="w-3.5 h-3.5 text-slate-500" />
                <span>Etiquetas</span>
              </button>

              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate({ type: 'bank_generate' })}
                  className="px-3.5 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Gerar Prova</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleOpenNewQuestion}
                className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-on-accent text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Questão</span>
              </button>
            </>
          ) : (
            onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate({ type: 'bank_generate' })}
                className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-on-accent text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Modelo</span>
              </button>
            )
          )}
        </div>
      </header>

      {/* Main Content Area */}
      {activeTab === 'blueprints' ? (
        <BlueprintList onNavigate={onNavigate} />
      ) : questions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <EmptyState
            illustration={<BubbleGridIllustration />}
            title="Seu banco de questões está vazio"
            description="Cadastre questões organizadas por grupos e etiquetas. Você poderá utilizá-las diretamente em suas provas ou gerar avaliações aleatórias com facilidade."
            actions={
              <button
                type="button"
                onClick={handleOpenNewQuestion}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-on-accent text-sm font-semibold shadow-xs transition flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Primeira Questão</span>
              </button>
            }
          />
        </div>
      ) : (
        <div className="flex flex-col md:flex-row items-start gap-4 flex-1 min-w-0">
          {/* Mobile Group Drawer Toggle Button */}
          <div className="md:hidden w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <FolderTree className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Grupos do Banco</span>
            </div>
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 text-xs font-semibold transition"
            >
              Navegar Grupos
            </button>
          </div>

          {/* Desktop Group Tree Sidebar */}
          <div className="hidden md:block shrink-0">
            <GroupTree
              selected={selectedGroup}
              onSelect={setSelectedGroup}
            />
          </div>

          {/* Mobile Drawer */}
          {mobileDrawerOpen && (
            <div className="fixed inset-0 z-50 flex md:hidden">
              <div
                className="fixed inset-0 bg-scrim/60 transition-opacity"
                onClick={() => setMobileDrawerOpen(false)}
              />
              <div className="relative ml-auto w-full max-w-xs h-full bg-white p-4 shadow-overlay flex flex-col z-10 overflow-y-auto">
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
                  <h3 className="font-bold text-sm text-slate-900">Grupos</h3>
                  <button
                    type="button"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                    aria-label="Fechar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <GroupTree
                  selected={selectedGroup}
                  onSelect={(sel) => {
                    setSelectedGroup(sel);
                    setMobileDrawerOpen(false);
                  }}
                  className="border-0 p-0 shadow-none"
                />
              </div>
            </div>
          )}

          {/* Question List and Filters */}
          <QuestionList
            questions={questions}
            groups={groups}
            tags={tags}
            usageCounts={usageCounts}
            selectedGroup={selectedGroup}
            selectedQuestionIds={selectedQuestionIds}
            onToggleSelectQuestion={handleToggleSelectQuestion}
            onSelectAllQuestions={handleSelectAllQuestions}
            onClearQuestionSelection={handleClearSelection}
            onEditQuestion={handleEditQuestion}
            onDuplicateQuestion={handleDuplicateQuestion}
            onMoveQuestion={handleOpenMoveQuestion}
            onArchiveToggleQuestion={handleArchiveToggleQuestion}
            onDeleteQuestion={handleOpenDeleteQuestion}
            onOpenTagManager={() => setTagManagerOpen(true)}
            onNewQuestion={handleOpenNewQuestion}
          />
        </div>
      )}

      {/* Bulk Actions Bar */}
      {activeTab === 'questions' && (
        <BulkActionsBar
          selectedQuestionIds={selectedQuestionIds}
          questions={questions}
          groups={groups}
          tags={tags}
          onClearSelection={handleClearSelection}
          onMoveQuestions={handleBulkMove}
          onApplyTags={handleBulkApplyTags}
          onArchiveToggle={handleBulkArchive}
          onDeleteQuestions={handleBulkDelete}
        />
      )}

      {/* Question Editor Modal */}
      <QuestionEditorModal
        open={editorModalOpen}
        onOpenChange={setEditorModalOpen}
        question={editingQuestion}
        defaultGroupId={defaultGroupIdForNew}
        groups={groups}
        tags={tags}
        onCreateTag={createTag}
        onSave={async (q) => {
          const res = await saveQuestion(q);
          return res.ok;
        }}
      />

      {/* Tag Manager Modal */}
      <TagManagerModal
        open={tagManagerOpen}
        onOpenChange={setTagManagerOpen}
        tags={tags}
        questionCountByTag={questionCountByTag}
        onRenameTag={renameTag}
        onUpdateColor={updateTagColor}
        onDeleteTag={deleteTag}
        onMergeTag={mergeTags}
      />

      {/* Single Question Move Modal */}
      <Modal
        open={Boolean(movingQuestion)}
        onOpenChange={(open) => !open && setMovingQuestion(null)}
        title="Mover Questão"
        description="Escolha o novo grupo de destino para esta questão:"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setMovingQuestion(null)}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-medium transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmSingleMove}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-on-accent text-sm font-semibold shadow-xs transition"
            >
              Mover
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

      {/* Single Question Delete Modal */}
      <Modal
        open={Boolean(deletingQuestion)}
        onOpenChange={(open) => !open && setDeletingQuestion(null)}
        title="Excluir Questão"
        description="Esta ação removerá a questão do banco de questões:"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setDeletingQuestion(null)}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-medium transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmSingleDelete}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-on-accent text-sm font-semibold shadow-xs transition"
            >
              Excluir Definitivamente
            </button>
          </div>
        }
      >
        <div className="py-2">
          <p className="text-sm text-slate-700">
            Tem certeza de que deseja excluir permanentemente esta questão do banco?
            Provas já criadas que utilizam esta questão manterão seu texto intacto.
          </p>
        </div>
      </Modal>

      <BankImportModal
        isOpen={bankImportOpen}
        onClose={() => setBankImportOpen(false)}
      />
    </div>
  );
};

export default BankScreen;
