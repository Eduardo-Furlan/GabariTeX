import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  Check,
  Layers,
  FileText,
} from 'lucide-react';
import { BankQuestion } from '../../types/bank';
import { Question } from '../../types/exam';
import { useBank } from '../../context/BankContext';
import {
  fromExamQuestion,
  questionDuplicateKey,
} from '../../utils/bank/questions';
import { pathOf } from '../../utils/bank/tree';
import { Modal } from '../ui/Modal';
import { GroupPicker } from '../bank/GroupPicker';
import { TagInput } from '../bank/TagInput';
import { MathView } from '../MathView';
import { toast } from '../ui/toastStore';
import { cn } from '../ui/cn';

export interface SendToBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  examQuestions: readonly Question[];
  preselectedQuestionId?: string | null;
  onQuestionsUpdated: (updatedExamQuestions: Question[]) => void;
}

export const SendToBankModal: React.FC<SendToBankModalProps> = ({
  isOpen,
  onClose,
  examQuestions,
  preselectedQuestionId,
  onQuestionsUpdated,
}) => {
  const {
    ensureLoaded,
    groups,
    tags,
    questions: bankQuestions,
    createGroup,
    saveQuestions,
    createTag,
  } = useBank();

  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);
  const [appliedTagIds, setAppliedTagIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [decisions, setDecisions] = useState<Map<string, 'save' | 'skip'>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Map of bank duplicates: duplicateKey -> BankQuestion
  const bankDuplicateMap = useMemo(() => {
    const map = new Map<string, BankQuestion>();
    for (const bq of bankQuestions) {
      const key = questionDuplicateKey(bq);
      if (!map.has(key)) {
        map.set(key, bq);
      }
    }
    return map;
  }, [bankQuestions]);

  useEffect(() => {
    if (isOpen) {
      ensureLoaded();
      setTargetGroupId(null);
      setAppliedTagIds([]);
      setIsSubmitting(false);

      const initialSelected = new Set<string>();
      const initialDecisions = new Map<string, 'save' | 'skip'>();

      for (const q of examQuestions) {
        const isPreselected = preselectedQuestionId ? q.id === preselectedQuestionId : true;
        if (isPreselected) {
          initialSelected.add(q.id);
        }

        const key = questionDuplicateKey(q);
        const hasDuplicate = bankDuplicateMap.has(key);
        // Default to skip if duplicate already in bank, otherwise save
        initialDecisions.set(q.id, hasDuplicate ? 'skip' : 'save');
      }

      setSelectedIds(initialSelected);
      setDecisions(initialDecisions);
    }
  }, [isOpen, examQuestions, preselectedQuestionId, bankDuplicateMap, ensureLoaded]);

  const toggleSelectQuestion = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSetDecision = (questionId: string, decision: 'save' | 'skip') => {
    setDecisions((prev) => {
      const next = new Map(prev);
      next.set(questionId, decision);
      return next;
    });
  };

  const questionsToProcess = useMemo(() => {
    return examQuestions.filter(
      (q) => selectedIds.has(q.id) && decisions.get(q.id) === 'save'
    );
  }, [examQuestions, selectedIds, decisions]);

  const handleSaveToBank = async () => {
    if (questionsToProcess.length === 0) {
      toast.error('Nenhuma questão selecionada para salvar no banco.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newBankQuestions: BankQuestion[] = [];
      const updatedExamQuestionsMap = new Map<string, string>(); // examQuestionId -> newBankQuestionId

      for (const eq of questionsToProcess) {
        const bq = fromExamQuestion(eq, targetGroupId, appliedTagIds);
        newBankQuestions.push(bq);
        updatedExamQuestionsMap.set(eq.id, bq.id);
      }

      const saveRes = await saveQuestions(newBankQuestions);
      if (!saveRes.ok) {
        toast.error('Erro ao salvar questões no banco.');
        return;
      }

      // Update sourceQuestionId on exam questions
      const nextExamQuestions = examQuestions.map((q) => {
        const newBankId = updatedExamQuestionsMap.get(q.id);
        if (newBankId) {
          return {
            ...q,
            sourceQuestionId: newBankId,
          };
        }
        return q;
      });

      onQuestionsUpdated(nextExamQuestions);

      toast.success(
        `${newBankQuestions.length} ${
          newBankQuestions.length === 1 ? 'questão salva' : 'questões salvas'
        } no Banco de Questões com sucesso.`
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Salvar Questões no Banco"
      description="Envie questões desta prova para o seu Banco de Questões reutilizável."
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full flex-wrap gap-2">
          <div className="text-xs text-slate-600">
            <span className="font-semibold tabular-nums text-slate-900">
              {questionsToProcess.length}
            </span>{' '}
            {questionsToProcess.length === 1 ? 'questão será adicionada' : 'questões serão adicionadas'}{' '}
            ao banco
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-medium transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveToBank}
              disabled={isSubmitting || questionsToProcess.length === 0}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-on-accent text-sm font-semibold shadow-xs disabled:opacity-50 transition"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar no Banco'}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-1">
        {/* Destination Group and Tags Config */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border border-slate-200 bg-white">
          <div>
            <label className="block text-meta font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Grupo de Destino
            </label>
            <GroupPicker
              groups={groups}
              value={targetGroupId}
              onChange={setTargetGroupId}
              rootLabel="Sem Grupo (Raiz)"
              onCreateGroup={createGroup}
            />
          </div>

          <div>
            <label className="block text-meta font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Etiquetas a Aplicar
            </label>
            <TagInput
              selectedTagIds={appliedTagIds}
              tags={tags}
              onChange={setAppliedTagIds}
              onCreateTag={createTag}
            />
          </div>
        </div>

        {/* Questions List */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">
              Questões da Prova ({examQuestions.length})
            </span>
            <span className="text-meta text-slate-500">
              Detecção automática de duplicatas ativada
            </span>
          </div>

          <div className="flex flex-col gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
            {examQuestions.map((q, idx) => {
              const isSelected = selectedIds.has(q.id);
              const key = questionDuplicateKey(q);
              const duplicateBankQuestion = bankDuplicateMap.get(key);
              const isDuplicate = Boolean(duplicateBankQuestion);
              const currentDecision = decisions.get(q.id) ?? 'save';

              const duplicateGroupPath = duplicateBankQuestion
                ? duplicateBankQuestion.groupId
                  ? pathOf(groups, duplicateBankQuestion.groupId)
                  : 'Sem Grupo'
                : '';

              return (
                <div
                  key={q.id}
                  className={cn(
                    'p-3 rounded-xl border text-xs transition flex flex-col gap-2',
                    isSelected
                      ? 'border-indigo-300 bg-white shadow-xs'
                      : 'border-slate-200 bg-slate-50/50 opacity-60'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <label className="mt-0.5 inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectQuestion(q.id)}
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center transition',
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-on-accent'
                            : 'border-slate-300 bg-white'
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                      </span>
                    </label>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">
                            Questão #{idx + 1}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                            {q.type === 'objective' ? (
                              <>
                                <Layers className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                <span>Objetiva</span>
                              </>
                            ) : (
                              <>
                                <FileText className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                <span>Dissertativa</span>
                              </>
                            )}
                          </span>
                        </div>

                        <span className="font-semibold text-slate-600 tabular-nums">
                          {q.points === 1 ? '1 pt' : `${q.points} pts`}
                        </span>
                      </div>

                      <div className="text-slate-700 line-clamp-2">
                        <MathView content={q.prompt || '(Sem enunciado)'} />
                      </div>
                    </div>
                  </div>

                  {/* Duplicate notice & choice */}
                  {isDuplicate && isSelected && (
                    <div className="mt-1 p-2 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span className="text-[11px]">
                          Já existe no banco ({duplicateGroupPath}).
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSetDecision(q.id, 'skip')}
                          className={cn(
                            'px-2 py-0.5 rounded text-[11px] font-medium transition',
                            currentDecision === 'skip'
                              ? 'bg-amber-600 text-on-accent font-semibold'
                              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                          )}
                        >
                          Pular (recomendado)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetDecision(q.id, 'save')}
                          className={cn(
                            'px-2 py-0.5 rounded text-[11px] font-medium transition',
                            currentDecision === 'save'
                              ? 'bg-indigo-600 text-on-accent font-semibold'
                              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                          )}
                        >
                          Salvar como nova
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
};
