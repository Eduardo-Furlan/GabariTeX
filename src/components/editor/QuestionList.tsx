import React from 'react';
import { Question } from '../../types/exam';
import { QuestionEditor } from './QuestionEditor';
import { Plus, Layers, Calculator, AlertTriangle } from 'lucide-react';
import { MAX_QUESTIONS, remainingQuestions } from '../../utils/examLimits';

interface QuestionListProps {
  questions: Question[];
  onChange: (updatedQuestions: Question[]) => void;
}

export const QuestionList: React.FC<QuestionListProps> = ({ questions, onChange }) => {
  const isLimitReached = questions.length >= MAX_QUESTIONS;
  const remaining = remainingQuestions(questions.length);
  const showWarning = questions.length >= 36 && !isLimitReached;

  const handleUpdateQuestion = (index: number, updated: Question) => {
    const list = [...questions];
    list[index] = updated;
    onChange(list);
  };

  const handleDeleteQuestion = (index: number) => {
    if (questions.length <= 1) {
      alert('A prova deve ter pelo menos uma questão.');
      return;
    }
    const list = questions.filter((_, i) => i !== index);
    onChange(list);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 px-1 gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs sm:text-sm text-slate-600">
          <span className="flex items-center gap-1.5 font-medium">
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            Total: <strong>{questions.length}/{MAX_QUESTIONS}</strong>
          </span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span>
            Objetivas: <strong>{objectiveCount}</strong>
          </span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span>
            Dissertativas: <strong>{subjectiveCount}</strong>
          </span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span className="flex items-center gap-1 font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/30">
            <Calculator className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            Pontuação: {totalPoints.toFixed(1)} pts
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={isLimitReached}
            onClick={() => handleAddQuestion('objective')}
            title={
              isLimitReached
                ? 'Limite de 40 questões atingido: é o máximo que cabe na folha de respostas A4.'
                : undefined
            }
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition ${
              isLimitReached
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-indigo-600 hover:bg-indigo-700 text-on-accent'
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> Nova Objetiva
          </button>
          <button
            type="button"
            disabled={isLimitReached}
            onClick={() => handleAddQuestion('subjective')}
            title={
              isLimitReached
                ? 'Limite de 40 questões atingido: é o máximo que cabe na folha de respostas A4.'
                : undefined
            }
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              isLimitReached
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> Nova Dissertativa
          </button>
        </div>
      </div>

      {isLimitReached && (
        <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs sm:text-sm font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>Limite de 40 questões atingido: é o máximo que cabe na folha de respostas A4.</span>
        </div>
      )}

      {showWarning && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl text-xs sm:text-sm font-medium text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            Atenção: restam apenas {remaining} {remaining === 1 ? 'questão' : 'questões'} antes de atingir o limite de {MAX_QUESTIONS} da folha A4.
          </span>
        </div>
      )}

      <div className="space-y-4">
        {questions.map((q, idx) => (
          <QuestionEditor
            key={q.id}
            question={q}
            index={idx}
            onChange={(updated) => handleUpdateQuestion(idx, updated)}
            onDelete={() => handleDeleteQuestion(idx)}
          />
        ))}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
        <button
          type="button"
          disabled={isLimitReached}
          onClick={() => handleAddQuestion('objective')}
          title={
            isLimitReached
              ? 'Limite de 40 questões atingido: é o máximo que cabe na folha de respostas A4.'
              : undefined
          }
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition border ${
            isLimitReached
              ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed'
              : 'bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30'
          }`}
        >
          <Plus className="w-4 h-4" /> Adicionar Questão Objetiva
        </button>
        <button
          type="button"
          disabled={isLimitReached}
          onClick={() => handleAddQuestion('subjective')}
          title={
            isLimitReached
              ? 'Limite de 40 questões atingido: é o máximo que cabe na folha de respostas A4.'
              : undefined
          }
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition border ${
            isLimitReached
              ? 'bg-slate-50 dark:bg-slate-900/40 text-slate-300 dark:text-slate-700 border-slate-200 dark:border-slate-800 cursor-not-allowed'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <Plus className="w-4 h-4" /> Adicionar Questão Dissertativa
        </button>
      </div>
    </div>
  );
};
