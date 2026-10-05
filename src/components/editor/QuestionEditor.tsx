import React from 'react';
import { Question, QuestionOption } from '../../types/exam';
import { MathView } from '../MathView';
import { ImageUploader } from '../ImageUploader';
import { Trash2, Plus, CheckCircle2, Circle } from 'lucide-react';

interface QuestionEditorProps {
  question: Question;
  index: number;
  onChange: (updatedQuestion: Question) => void;
  onDelete: () => void;
}

const OPTION_LABELS: ('A' | 'B' | 'C' | 'D' | 'E')[] = ['A', 'B', 'C', 'D', 'E'];

export const QuestionEditor: React.FC<QuestionEditorProps> = ({
  question,
  index,
  onChange,
  onDelete,
}) => {
  const insertMathSnippet = (snippet: string) => {
    onChange({
      ...question,
      prompt: question.prompt ? `${question.prompt} ${snippet}` : snippet,
    });
  };

  const handleTypeChange = (newType: 'objective' | 'subjective') => {
    if (newType === 'objective' && (!question.options || question.options.length === 0)) {
      onChange({
        ...question,
        type: newType,
        options: [
          { id: `${question.id}-opt-1`, label: 'A', text: '', isCorrect: true },
          { id: `${question.id}-opt-2`, label: 'B', text: '', isCorrect: false },
          { id: `${question.id}-opt-3`, label: 'C', text: '', isCorrect: false },
          { id: `${question.id}-opt-4`, label: 'D', text: '', isCorrect: false },
        ],
      });
    } else {
      onChange({
        ...question,
        type: newType,
        linesForAnswer: question.linesForAnswer || 8,
      });
    }
  };

  const handleOptionTextChange = (optIndex: number, text: string) => {
    if (!question.options) return;
    const newOptions = [...question.options];
    newOptions[optIndex] = { ...newOptions[optIndex], text };
    onChange({ ...question, options: newOptions });
  };

  const handleSetCorrectOption = (optIndex: number) => {
    if (!question.options) return;
    const newOptions = question.options.map((opt, i) => ({
      ...opt,
      isCorrect: i === optIndex,
    }));
    onChange({ ...question, options: newOptions });
  };

  const handleAddOption = () => {
    if (!question.options || question.options.length >= 5) return;
    const nextLabel = OPTION_LABELS[question.options.length];
    const newOption: QuestionOption = {
      id: `${question.id}-opt-${question.options.length + 1}`,
      label: nextLabel,
      text: '',
      isCorrect: false,
    };
    onChange({
      ...question,
      options: [...question.options, newOption],
    });
  };

  const handleRemoveOption = (optIndex: number) => {
    if (!question.options || question.options.length <= 2) return;
    const filtered = question.options.filter((_, i) => i !== optIndex);
    const reindexed = filtered.map((opt, i) => ({
      ...opt,
      label: OPTION_LABELS[i],
    }));
    if (!reindexed.some((opt) => opt.isCorrect)) {
      reindexed[0].isCorrect = true;
    }
    onChange({ ...question, options: reindexed });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-4 transition hover:border-slate-300">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm">
            {index + 1}
          </span>
          <span className="font-semibold text-slate-800">Questão {index + 1}</span>

          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => handleTypeChange('objective')}
              className={`px-3 py-1 rounded-md transition ${
                question.type === 'objective'
                  ? 'bg-white text-indigo-700 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Objetiva (Gabarito)
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('subjective')}
              className={`px-3 py-1 rounded-md transition ${
                question.type === 'subjective'
                  ? 'bg-white text-indigo-700 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dissertativa (Aberta)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <label className="text-xs text-slate-500 font-medium">Valor:</label>
            <input
              type="number"
              step="0.1"
              min="0"
              className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-right font-medium"
              value={question.points}
              onChange={(e) => onChange({ ...question, points: parseFloat(e.target.value) || 0 })}
            />
            <span className="text-xs text-slate-500">pt</span>
          </div>

          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            title="Excluir questão"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-slate-600 uppercase">
            Enunciado da Questão (suporta texto e LaTeX: $x^2$, \lim, \int, \frac&#123;a&#125;&#123;b&#125;)
          </label>
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <span className="text-slate-400">Atalhos:</span>
            {[
              { label: 'x²', val: '$x^2$' },
              { label: 'a/b', val: '$\\frac{a}{b}$' },
              { label: '√x', val: '$\\sqrt{x}$' },
              { label: '∫', val: '$\\int_{a}^{b} f(x)\\,dx$' },
              { label: 'lim', val: '$\\lim_{x \\to 0}$' },
              { label: '∑', val: '$\\sum_{i=1}^{n}$' },
              { label: 'Matriz', val: '$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$' },
            ].map((btn) => (
              <button
                key={btn.label}
                type="button"
                onClick={() => insertMathSnippet(btn.val)}
                className="px-1.5 py-0.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded font-mono text-[10px]"
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          placeholder="Digite o enunciado da questão. Use $...$ para equações na linha ou \[...\] para fórmulas destacadas..."
          value={question.prompt}
          onChange={(e) => onChange({ ...question, prompt: e.target.value })}
        />

        {question.prompt && (
          <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">
              Pré-visualização do Enunciado:
            </span>
            <MathView content={question.prompt} className="text-slate-800 text-sm leading-relaxed" />
          </div>
        )}

        <ImageUploader
          imageUrl={question.imageUrl}
          imageCaption={question.imageCaption}
          onImageChange={(url, caption) =>
            onChange({ ...question, imageUrl: url, imageCaption: caption })
          }
        />
      </div>

      {question.type === 'objective' && question.options && (
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600 uppercase flex items-center gap-1">
              Alternativas (Selecione a correta para o gabarito)
            </span>
            {question.options.length < 5 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Alternativa ({OPTION_LABELS[question.options.length]})
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {question.options.map((opt, optIndex) => (
              <div
                key={opt.id}
                className={`flex items-start gap-2 p-2.5 rounded-lg border transition ${
                  opt.isCorrect
                    ? 'border-emerald-300 bg-emerald-50/40'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSetCorrectOption(optIndex)}
                  className="mt-1 text-slate-400 hover:text-emerald-600 transition"
                  title={opt.isCorrect ? 'Alternativa Correta' : 'Marcar como correta'}
                >
                  {opt.isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-400" />
                  )}
                </button>

                <span className="font-bold text-sm text-slate-700 mt-1 min-w-[18px]">
                  {opt.label})
                </span>

                <div className="flex-1">
                  <input
                    type="text"
                    className="w-full px-2.5 py-1 text-sm border border-slate-300 rounded bg-white font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    placeholder={`Texto da alternativa ${opt.label} (suporta $LaTeX$)...`}
                    value={opt.text}
                    onChange={(e) => handleOptionTextChange(optIndex, e.target.value)}
                  />
                  {opt.text && (
                    <div className="mt-1 px-1 text-xs text-slate-700">
                      <MathView content={opt.text} />
                    </div>
                  )}
                </div>

                {question.options && question.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(optIndex)}
                    className="mt-1 p-1 text-slate-300 hover:text-red-500 transition"
                    title="Excluir alternativa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {question.type === 'subjective' && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-600 uppercase">
            Linhas pautadas para resposta:
          </label>
          <input
            type="number"
            min="3"
            max="30"
            className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-center"
            value={question.linesForAnswer || 8}
            onChange={(e) =>
              onChange({ ...question, linesForAnswer: parseInt(e.target.value) || 8 })
            }
          />
          <span className="text-xs text-slate-500 italic">
            (Esta questão não entrará no gabarito óptico de bolinhas)
          </span>
        </div>
      )}
    </div>
  );
};
