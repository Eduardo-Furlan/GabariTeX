import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { Question } from '../../types/exam';
import { QuestionEditor } from './QuestionEditor';
import { Plus, Layers, Calculator, BookOpen, Library } from 'lucide-react';
import { MAX_QUESTIONS, remainingQuestions } from '../../utils/examLimits';
import { springs } from '../../ui/motion/tokens';
import { Button } from '../ui/Button';
import { CountUp } from '../ui/CountUp';
import { ProgressBar } from '../ui/ProgressBar';
import { Alert } from '../ui/Alert';
import { toast } from '../ui/toastStore';
import { cn } from '../ui/cn';

interface QuestionListProps {
  questions: Question[];
  onChange: (updatedQuestions: Question[]) => void;
  onOpenImportModal?: () => void;
  onOpenAddFromBankModal?: () => void;
}

export const QuestionList: React.FC<QuestionListProps> = ({
  questions,
  onChange,
  onOpenImportModal,
  onOpenAddFromBankModal,
}) => {
  const [movedId, setMovedId] = useState<string | null>(null);

  const isLimitReached = questions.length >= MAX_QUESTIONS;
  const remaining = remainingQuestions(questions.length);
  const showWarning = questions.length >= 36 && !isLimitReached;

  const orderKey = questions.map((q) => q.id).join('|');

  useEffect(() => {
    if (!movedId) return;
    const isReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el = document.getElementById(`question-card-${movedId}`);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: isReduced ? 'auto' : 'smooth' });
    }
    const timer = setTimeout(() => {
      setMovedId(null);
    }, 600);
    return () => clearTimeout(timer);
  }, [movedId]);

  const handleUpdateQuestion = (index: number, updated: Question) => {
    const list = [...questions];
    list[index] = updated;
    onChange(list);
  };

  const handleDeleteQuestion = (index: number) => {
    if (questions.length <= 1) {
      toast.error('A prova deve ter pelo menos uma questão.');
      return;
    }
    const list = questions.filter((_, i) => i !== index);
    onChange(list);
  };

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    const reordered = [...questions];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);
    onChange(reordered);
    setMovedId(moved.id);
  };

  const handleDuplicateQuestion = (index: number) => {
    if (questions.length >= MAX_QUESTIONS) return;
    const source = questions[index];
    if (!source) return;
    const newId = `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const cloned: Question = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      options: source.options
        ? source.options.map((opt, idx) => ({
            ...opt,
            id: `${newId}-opt-${idx + 1}`,
          }))
        : undefined,
    };
    const next = [...questions];
    next.splice(index + 1, 0, cloned);
    onChange(next);
  };

  const handleAddQuestion = (type: 'objective' | 'subjective') => {
    if (questions.length >= MAX_QUESTIONS) {
      return;
    }
    const newId = `q-${Date.now()}`;
    const newQuestion: Question =
      type === 'objective'
        ? {
            id: newId,
            type: 'objective',
            prompt: 'Considere a expressão matemática: $f(x) = $',
            points: 1.0,
            options: [
              { id: `${newId}-opt-1`, label: 'A', text: '$0$', isCorrect: true },
              { id: `${newId}-opt-2`, label: 'B', text: '$1$', isCorrect: false },
              { id: `${newId}-opt-3`, label: 'C', text: '$2$', isCorrect: false },
              { id: `${newId}-opt-4`, label: 'D', text: '$-1$', isCorrect: false },
            ],
          }
        : {
            id: newId,
            type: 'subjective',
            prompt: 'Demonstre detalhadamente que...',
            points: 2.0,
            linesForAnswer: 8,
          };

    onChange([...questions, newQuestion]);
  };

  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);
  const objectiveCount = questions.filter((q) => q.type === 'objective').length;
  const subjectiveCount = questions.filter((q) => q.type === 'subjective').length;

  return (
    <div>
      {/* Sticky summary toolbar */}
      <div className="sticky top-[var(--chrome-h,96px)] z-20 chrome-surface rounded-card p-3 sm:p-4 mb-4 border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs sm:text-sm text-slate-600">
            <span className="flex items-center gap-1.5 font-medium">
              <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>
                Total:{' '}
                <strong className="tabular-nums">
                  {`${questions.length}/${MAX_QUESTIONS}`}
                </strong>
              </span>
            </span>
            <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
              •
            </span>
            <span>
              Objetivas: <strong className="tabular-nums">{objectiveCount}</strong>
            </span>
            <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
              •
            </span>
            <span>
              Dissertativas: <strong className="tabular-nums">{subjectiveCount}</strong>
            </span>
            <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
              •
            </span>
            <span className="flex items-center gap-1 font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/30">
              <Calculator className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Pontuação: <CountUp value={totalPoints} decimals={1} /> pts
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenAddFromBankModal && (
              <Button
                variant="secondary"
                size="sm"
                disabled={isLimitReached}
                onClick={onOpenAddFromBankModal}
                icon={<Library className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                title={
                  isLimitReached
                    ? 'Limite de 40 questões atingido.'
                    : 'Adicionar questões do Banco de Questões'
                }
              >
                Adicionar do Banco
              </Button>
            )}
            {onOpenImportModal && (
              <Button
                variant="secondary"
                size="sm"
                disabled={isLimitReached}
                onClick={onOpenImportModal}
                icon={<BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                title={
                  isLimitReached
                    ? 'Limite de 40 questões atingido.'
                    : 'Importar questões de outras provas da biblioteca'
                }
              >
                Importar de Outra Prova
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              disabled={isLimitReached}
              onClick={() => handleAddQuestion('objective')}
              icon={<Plus className="w-3.5 h-3.5" />}
              title={
                isLimitReached
                  ? 'Limite de 40 questões atingido: é o máximo que cabe na folha de respostas A4.'
                  : undefined
              }
            >
              Nova Objetiva
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={isLimitReached}
              onClick={() => handleAddQuestion('subjective')}
              icon={<Plus className="w-3.5 h-3.5" />}
              title={
                isLimitReached
                  ? 'Limite de 40 questões atingido: é o máximo que cabe na folha de respostas A4.'
                  : undefined
              }
            >
              Nova Dissertativa
            </Button>
          </div>
        </div>

        {/* Limit progress bar */}
        <div className="mt-2.5">
          <ProgressBar
            value={(questions.length / MAX_QUESTIONS) * 100}
            tone={isLimitReached ? 'danger' : questions.length >= 36 ? 'warn' : 'accent'}
            aria-label="Limite de questões"
          />
        </div>
      </div>

      {isLimitReached && (
        <div className="mb-4">
          <Alert tone="danger">
            Limite de 40 questões atingido: é o máximo que cabe na folha de respostas A4.
          </Alert>
        </div>
      )}

      {showWarning && (
        <div className="mb-4">
          <Alert tone="warn">
            {`Atenção: restam apenas ${remaining} ${
              remaining === 1 ? 'questão' : 'questões'
            } antes de atingir o limite de ${MAX_QUESTIONS} da folha A4.`}
          </Alert>
        </div>
      )}

      {/* Animated question list */}
      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {questions.map((q, idx) => (
            <m.div
              id={`question-card-${q.id}`}
              key={q.id}
              layout="position"
              layoutDependency={orderKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={springs.soft}
              className={cn(
                'rounded-card transition-shadow duration-300',
                movedId === q.id && 'ring-2 ring-indigo-500 ring-offset-2'
              )}
            >
              <QuestionEditor
                question={q}
                index={idx}
                canMoveUp={idx > 0}
                canMoveDown={idx < questions.length - 1}
                canDuplicate={!isLimitReached}
                onMoveUp={() => handleMoveQuestion(idx, 'up')}
                onMoveDown={() => handleMoveQuestion(idx, 'down')}
                onDuplicate={() => handleDuplicateQuestion(idx)}
                onChange={(updated) => handleUpdateQuestion(idx, updated)}
                onDelete={() => handleDeleteQuestion(idx)}
              />
            </m.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
        <Button
          variant="soft"
          disabled={isLimitReached}
          onClick={() => handleAddQuestion('objective')}
          icon={<Plus className="w-4 h-4" />}
          title={
            isLimitReached
              ? 'Limite de 40 questões atingido: é o máximo que cabe na folha de respostas A4.'
              : undefined
          }
        >
          Adicionar Questão Objetiva
        </Button>
        <Button
          variant="secondary"
          disabled={isLimitReached}
          onClick={() => handleAddQuestion('subjective')}
          icon={<Plus className="w-4 h-4" />}
          title={
            isLimitReached
              ? 'Limite de 40 questões atingido: é o máximo que cabe na folha de respostas A4.'
              : undefined
          }
        >
          Adicionar Questão Dissertativa
        </Button>
      </div>
    </div>
  );
};
