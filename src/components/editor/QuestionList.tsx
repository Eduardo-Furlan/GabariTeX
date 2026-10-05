import React from 'react';
import { Question } from '../../types/exam';
import { QuestionEditor } from './QuestionEditor';
import { Plus, Layers, Calculator } from 'lucide-react';

interface QuestionListProps {
  questions: Question[];
  onChange: (updatedQuestions: Question[]) => void;
}

export const QuestionList: React.FC<QuestionListProps> = ({ questions, onChange }) => {
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
      <div className="flex items-center justify-between mb-4 px-1 flex-wrap gap-2">
        <div className="flex items-center gap-4 text-sm text-slate-600">
          <span className="flex items-center gap-1.5 font-medium">
            <Layers className="w-4 h-4 text-indigo-600" />
            Total: <strong>{questions.length}</strong> questões
          </span>
          <span className="text-slate-400">|</span>
          <span>
            Objetivas: <strong>{objectiveCount}</strong>
          </span>
          <span className="text-slate-400">|</span>
          <span>
            Dissertativas: <strong>{subjectiveCount}</strong>
          </span>
          <span className="text-slate-400">|</span>
          <span className="flex items-center gap-1 font-semibold text-emerald-700">
            <Calculator className="w-4 h-4" />
            Pontuação Total: {totalPoints.toFixed(1)} pts
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleAddQuestion('objective')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Nova Questão Objetiva
          </button>
          <button
            type="button"
            onClick={() => handleAddQuestion('subjective')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
          >
            <Plus className="w-4 h-4" /> Nova Questão Dissertativa
          </button>
        </div>
      </div>

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

      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => handleAddQuestion('objective')}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-semibold transition"
        >
          <Plus className="w-4 h-4" /> Adicionar Mais Uma Questão Objetiva
        </button>
        <button
          type="button"
          onClick={() => handleAddQuestion('subjective')}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-sm font-semibold transition"
        >
          <Plus className="w-4 h-4" /> Adicionar Questão Dissertativa
        </button>
      </div>
    </div>
  );
};
