import React from 'react';
import { Question, QuestionOption } from '../../types/exam';
import { MathView } from '../MathView';
import { ImageUploader } from '../ImageUploader';
import {
  Trash2,
  Plus,
  ChevronUp,
  ChevronDown,
  Copy,
  FolderUp,
} from 'lucide-react';
import { Surface } from '../ui/Surface';
import { Bubble } from '../ui/Bubble';
import { IconButton } from '../ui/IconButton';
import { Select } from '../ui/Select';
import { cn } from '../ui/cn';

interface QuestionEditorProps {
  question: Question;
  index: number;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  canDuplicate?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDuplicate?: () => void;
  onSendToBank?: () => void;
  onChange: (updatedQuestion: Question) => void;
  onDelete: () => void;
}

const OPTION_LABELS: ('A' | 'B' | 'C' | 'D' | 'E')[] = ['A', 'B', 'C', 'D', 'E'];

export const QuestionEditor: React.FC<QuestionEditorProps> = ({
  question,
  index,
  canMoveUp = false,
  canMoveDown = false,
  canDuplicate = true,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onSendToBank,
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
    <Surface tone="default" className="p-4 sm:p-6 mb-4 transition hover:border-slate-300">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 flex-wrap gap-2">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 font-bold text-xs shrink-0 select-none">
            {index + 1}
          </span>
          <span className="font-semibold text-slate-800 text-sm sm:text-base">
            {`Questão ${index + 1}`}
          </span>
          {question.sourceQuestionId && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30"
              title="Questão originária do Banco de Questões"
            >
              Do banco
            </span>
          )}

          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => handleTypeChange('objective')}
              className={cn(
                'px-2.5 sm:px-3 py-1 rounded-md transition select-none',
                question.type === 'objective'
                  ? 'bg-white text-indigo-700 dark:text-indigo-300 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Objetiva
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('subjective')}
              className={cn(
                'px-2.5 sm:px-3 py-1 rounded-md transition select-none',
                question.type === 'subjective'
                  ? 'bg-white text-indigo-700 dark:text-indigo-300 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Dissertativa
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs">
            <label htmlFor={`annulled-${question.id}`} className="font-medium text-slate-600">
              Situação:
            </label>
            <Select
              id={`annulled-${question.id}`}
              value={question.annulled || ''}
              onChange={(val) => {
                const annulled = (val as 'give_points' | 'discard' | '') || undefined;
                onChange({
                  ...question,
                  annulled,
                });
              }}
              size="sm"
              options={[
                { value: '', label: 'Válida' },
                { value: 'give_points', label: 'Anulada (pontos para todos)' },
                { value: 'discard', label: 'Anulada (desconsiderar)' },
              ]}
              buttonClassName={cn(
                'text-xs font-medium',
                question.annulled === 'give_points' &&
                  'border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
                question.annulled === 'discard' &&
                  'border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30'
              )}
            />
          </div>

          <div className="flex items-center gap-1">
            <label className="text-xs text-slate-500 font-medium">Valor:</label>
            <input
              type="number"
              step="0.1"
              min="0"
              className="w-16 px-2 py-1 border border-slate-300 rounded-lg text-sm text-right font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={question.points}
              onChange={(e) => onChange({ ...question, points: parseFloat(e.target.value) || 0 })}
            />
            <span className="text-xs text-slate-500">pt</span>
          </div>

          <div className="flex items-center gap-0.5 border-l border-slate-200 pl-2">
            {onMoveUp && (
              <IconButton
                label="Mover questão para cima"
                size="sm"
                tone="ghost"
                disabled={!canMoveUp}
                onClick={onMoveUp}
              >
                <ChevronUp className="w-4 h-4" />
              </IconButton>
            )}
            {onMoveDown && (
              <IconButton
                label="Mover questão para baixo"
                size="sm"
                tone="ghost"
                disabled={!canMoveDown}
                onClick={onMoveDown}
              >
                <ChevronDown className="w-4 h-4" />
              </IconButton>
            )}
            {onDuplicate && (
              <IconButton
                label="Duplicar questão"
                size="sm"
                tone="ghost"
                disabled={!canDuplicate}
                onClick={onDuplicate}
              >
                <Copy className="w-4 h-4" />
              </IconButton>
            )}
            {onSendToBank && (
              <IconButton
                label="Salvar no Banco de Questões"
                size="sm"
                tone="ghost"
                onClick={onSendToBank}
              >
                <FolderUp className="w-4 h-4" />
              </IconButton>
            )}
            <IconButton
              label="Excluir questão"
              size="sm"
              tone="danger"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4" />
            </IconButton>
          </div>
        </div>
      </div>

      {question.annulled && (
        <div
          className={cn(
            'mb-3 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between',
            question.annulled === 'give_points'
              ? 'bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30'
              : 'bg-rose-50 text-rose-900 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30'
          )}
        >
          <span>
            {question.annulled === 'give_points'
              ? 'Questão anulada: pontuação cheia concedida a todos os alunos ao recalcular.'
              : 'Questão anulada: desconsiderada do total e do valor máximo da prova ao recalcular.'}
          </span>
          <span className="text-meta opacity-75">Não altera folhas já impressas</span>
        </div>
      )}

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-1.5">
          <label className="block text-xs font-semibold text-slate-600">
            Enunciado da Questão
          </label>
          <div className="flex flex-wrap items-center gap-1 text-meta text-slate-500">
            <span className="text-slate-400 text-meta">Atalhos LaTeX:</span>
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
                className="px-1.5 py-0.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-300 border border-slate-200 rounded font-mono text-meta transition"
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:outline-none transition"
          placeholder="Digite o enunciado da questão. Use $...$ para equações na linha ou \[...\] para fórmulas destacadas..."
          value={question.prompt}
          onChange={(e) => onChange({ ...question, prompt: e.target.value })}
        />

        {question.prompt && (
          <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-meta font-semibold text-slate-400 block mb-1">
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
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              Alternativas (Selecione a correta para o gabarito)
            </span>
            {question.options.length < 5 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium transition"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Alternativa ({OPTION_LABELS[question.options.length]})
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {question.options.map((opt, optIndex) => (
              <div
                key={opt.id}
                className={cn(
                  'flex items-start gap-2.5 p-2.5 rounded-lg border transition duration-150',
                  opt.isCorrect
                    ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                    : 'border-slate-200 bg-slate-50/50'
                )}
              >
                {/* Folha Óptica signature answer bubble */}
                <button
                  type="button"
                  aria-pressed={opt.isCorrect}
                  onClick={() => handleSetCorrectOption(optIndex)}
                  className="mt-0.5 transition active:scale-95 focus-visible:outline-none shrink-0"
                  title={
                    opt.isCorrect
                      ? 'Alternativa Correta (Gabarito)'
                      : 'Marcar como alternativa correta'
                  }
                >
                  <Bubble
                    state={opt.isCorrect ? 'correct' : 'empty'}
                    size="md"
                    label={
                      opt.isCorrect
                        ? `Alternativa ${opt.label} (correta)`
                        : `Alternativa ${opt.label}`
                    }
                  >
                    {opt.label}
                  </Bubble>
                </button>

                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    className="w-full px-2.5 py-1 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 font-mono focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:outline-none transition"
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
                  <IconButton
                    label="Excluir alternativa"
                    size="sm"
                    tone="ghost"
                    onClick={() => handleRemoveOption(optIndex)}
                    className="mt-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </IconButton>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {question.type === 'subjective' && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-3 flex-wrap">
          <label className="text-xs font-semibold text-slate-600">
            Linhas pautadas para resposta:
          </label>
          <input
            type="number"
            min="3"
            max="30"
            className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
    </Surface>
  );
};
