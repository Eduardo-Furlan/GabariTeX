import React, { useState, useEffect } from 'react';
import { Exam, Question } from '../../types/exam';
import { ExamMeta } from '../../types/profile';
import { ProfileStore } from '../../storage/profileStore';
import { MathView } from '../MathView';
import { MAX_QUESTIONS } from '../../utils/examLimits';
import {
  BookOpen,
  Search,
  Check,
  Plus,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';

interface ImportQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  exams: ExamMeta[];
  currentExamId: string;
  currentQuestionCount: number;
  store: ProfileStore;
  onImport: (questions: Question[]) => number;
}

export const ImportQuestionsModal: React.FC<ImportQuestionsModalProps> = ({
  isOpen,
  onClose,
  exams,
  currentExamId,
  currentQuestionCount,
  store,
  onImport,
}) => {
  const otherExams = exams.filter((e) => e.id !== currentExamId);
  const [selectedSourceExamId, setSelectedSourceExamId] = useState<string>('');
  const [sourceExam, setSourceExam] = useState<Exam | null>(null);
  const [isLoadingExam, setIsLoadingExam] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'objective' | 'subjective'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const availableSlots = Math.max(0, MAX_QUESTIONS - currentQuestionCount);

  useEffect(() => {
    if (isOpen) {
      const firstId = otherExams[0]?.id || '';
      setSelectedSourceExamId(firstId);
      setSearchQuery('');
      setTypeFilter('all');
      setSelectedIds(new Set());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedSourceExamId) {
      setSourceExam(null);
      setSelectedIds(new Set());
      return;
    }

    let cancelled = false;
    setIsLoadingExam(true);
    setSelectedIds(new Set());

    store
      .getExam(selectedSourceExamId)
      .then((loaded) => {
        if (!cancelled) {
          setSourceExam(loaded || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSourceExam(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingExam(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedSourceExamId, store]);

  const sourceQuestions = sourceExam?.questions || [];
  const filteredQuestions = sourceQuestions.filter((q) => {
    if (typeFilter !== 'all' && q.type !== typeFilter) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const inPrompt = (q.prompt || '').toLowerCase().includes(query);
    const inOptions = (q.options || []).some((opt) =>
      (opt.text || '').toLowerCase().includes(query)
    );
    return inPrompt || inOptions;
  });

  const toggleQuestion = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < availableSlots) {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const allFilteredSelected =
      filteredQuestions.length > 0 &&
      filteredQuestions.every((q) => selectedIds.has(q.id));

    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const q of filteredQuestions) {
          next.delete(q.id);
        }
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const q of filteredQuestions) {
          if (next.size >= availableSlots) break;
          next.add(q.id);
        }
        return next;
      });
    }
  };

  const handleConfirmImport = () => {
    if (!sourceExam || selectedIds.size === 0) return;
    const toImport = sourceExam.questions.filter((q) => selectedIds.has(q.id));
    onImport(toImport);
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="xl"
      title="Importar Questões de Outra Prova"
      description={`Reaproveite questões já cadastradas na sua biblioteca (${availableSlots} ${
        availableSlots === 1 ? 'vaga disponível' : 'vagas disponíveis'
      } até o limite de ${MAX_QUESTIONS}).`}
      footer={
        <div className="flex items-center justify-between w-full">
          <Badge tone={selectedIds.size > 0 ? 'accent' : 'neutral'} dot={selectedIds.size > 0}>
            {`${selectedIds.size} ${
              selectedIds.size === 1 ? 'questão selecionada' : 'questões selecionadas'
            }`}
          </Badge>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={handleConfirmImport}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Importar {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {otherExams.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="w-8 h-8 text-slate-400" />}
            title="Nenhuma outra prova disponível na biblioteca"
            description="Crie outras avaliações ou importe um arquivo de perfil para copiar questões entre provas."
          />
        ) : (
          <>
            {/* Seleção da Prova de Origem e Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="source-exam-select"
                  className="block text-xs font-semibold text-slate-600 uppercase mb-1"
                >
                  Prova de Origem
                </label>
                <select
                  id="source-exam-select"
                  value={selectedSourceExamId}
                  onChange={(e) => setSelectedSourceExamId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {otherExams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {`${ex.name} (${ex.questionCount} ${
                        ex.questionCount === 1 ? 'questão' : 'questões'
                      })`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="source-question-search"
                  className="block text-xs font-semibold text-slate-600 uppercase mb-1"
                >
                  Buscar no Enunciado
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="source-question-search"
                    type="text"
                    placeholder="Filtrar por palavra-chave ou fórmula..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Barra de Filtro por Tipo e Selecionar Todas */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
                {(
                  [
                    { id: 'all', label: 'Todas' },
                    { id: 'objective', label: 'Objetivas' },
                    { id: 'subjective', label: 'Dissertativas' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTypeFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-md transition ${
                      typeFilter === tab.id
                        ? 'bg-white text-indigo-700 dark:text-indigo-300 font-semibold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {filteredQuestions.length > 0 && availableSlots > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:underline"
                >
                  {filteredQuestions.every((q) => selectedIds.has(q.id))
                    ? 'Desmarcar visíveis'
                    : 'Selecionar visíveis'}
                </button>
              )}
            </div>

            {availableSlots === 0 && (
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>
                  {`A prova atual já atingiu o limite máximo de ${MAX_QUESTIONS} questões.`}
                </span>
              </div>
            )}

            {/* Lista de Questões */}
            {isLoadingExam ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-medium">Carregando questões...</span>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="py-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                Nenhuma questão encontrada com os filtros selecionados.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {filteredQuestions.map((q, idx) => {
                  const isSelected = selectedIds.has(q.id);
                  const isDisabled = !isSelected && selectedIds.size >= availableSlots;

                  return (
                    <div
                      key={q.id}
                      onClick={() => {
                        if (!isDisabled) toggleQuestion(q.id);
                      }}
                      className={`p-3 rounded-card border text-xs transition flex items-start gap-3 ${
                        isSelected
                          ? 'border-indigo-400 dark:border-indigo-500/50 bg-indigo-50/50 dark:bg-indigo-500/10 cursor-pointer'
                          : isDisabled
                          ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                          : 'border-slate-200 bg-white hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      <div
                        className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0 transition ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-on-accent'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">Questão #{idx + 1}</span>
                            <Badge
                              tone={q.type === 'objective' ? 'accent' : 'neutral'}
                            >
                              {q.type === 'objective' ? 'Objetiva' : 'Dissertativa'}
                            </Badge>
                          </div>
                          <span className="font-mono text-[11px] font-semibold text-slate-600 tabular-nums">
                            {(q.points || 0).toFixed(1)} pt
                          </span>
                        </div>

                        <div className="text-slate-700 line-clamp-2">
                          <MathView content={q.prompt || '(Sem enunciado)'} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
