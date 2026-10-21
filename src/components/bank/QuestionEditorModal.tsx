import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { BankGroup, BankQuestion, BankTag, QuestionOption, QuestionType, TagColor } from '../../types/bank';
import { validateBankQuestion } from '../../utils/bank/questions';
import { generateBankId } from '../../utils/bank/ids';
import { Modal } from '../ui/Modal';
import { GroupPicker } from './GroupPicker';
import { TagInput } from './TagInput';
import { MathView } from '../MathView';
import { cn } from '../ui/cn';

export interface QuestionEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question?: BankQuestion | null;
  defaultGroupId?: string | null;
  groups: BankGroup[];
  tags: BankTag[];
  onCreateGroup?: (input: { name: string; parentId: string | null }) => Promise<BankGroup | null>;
  onCreateTag?: (name: string, color: TagColor) => Promise<BankTag | null>;
  onSave: (question: BankQuestion) => Promise<boolean>;
}

const OPTION_LABELS: ('A' | 'B' | 'C' | 'D' | 'E')[] = ['A', 'B', 'C', 'D', 'E'];

export const QuestionEditorModal: React.FC<QuestionEditorModalProps> = ({
  open,
  onOpenChange,
  question,
  defaultGroupId = null,
  groups,
  tags,
  onCreateGroup,
  onCreateTag,
  onSave,
}) => {
  const isEditing = Boolean(question);

  const [groupId, setGroupId] = useState<string | null>(defaultGroupId);
  const [type, setType] = useState<QuestionType>('objective');
  const [prompt, setPrompt] = useState('');
  const [showMathPreview, setShowMathPreview] = useState(false);
  const [points, setPoints] = useState<number>(1);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [options, setOptions] = useState<QuestionOption[]>([
    { id: 'opt_1', label: 'A', text: '', isCorrect: true },
    { id: 'opt_2', label: 'B', text: '', isCorrect: false },
    { id: 'opt_3', label: 'C', text: '', isCorrect: false },
    { id: 'opt_4', label: 'D', text: '', isCorrect: false },
  ]);
  const [linesForAnswer, setLinesForAnswer] = useState<number>(5);
  const [notes, setNotes] = useState('');
  const [solution, setSolution] = useState('');
  const [archived, setArchived] = useState(false);

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Initialize or reset form fields
  useEffect(() => {
    if (open) {
      if (question) {
        setGroupId(question.groupId);
        setType(question.type);
        setPrompt(question.prompt);
        setPoints(question.points);
        setTagIds(question.tagIds ? [...question.tagIds] : []);
        setOptions(
          question.options && question.options.length > 0
            ? question.options.map((o) => ({ ...o }))
            : [
                { id: 'opt_1', label: 'A', text: '', isCorrect: true },
                { id: 'opt_2', label: 'B', text: '', isCorrect: false },
                { id: 'opt_3', label: 'C', text: '', isCorrect: false },
                { id: 'opt_4', label: 'D', text: '', isCorrect: false },
              ]
        );
        setLinesForAnswer(question.linesForAnswer ?? 5);
        setNotes(question.notes ?? '');
        setSolution(question.solution ?? '');
        setArchived(Boolean(question.archived));
      } else {
        setGroupId(defaultGroupId);
        setType('objective');
        setPrompt('');
        setPoints(1);
        setTagIds([]);
        setOptions([
          { id: 'opt_1', label: 'A', text: '', isCorrect: true },
          { id: 'opt_2', label: 'B', text: '', isCorrect: false },
          { id: 'opt_3', label: 'C', text: '', isCorrect: false },
          { id: 'opt_4', label: 'D', text: '', isCorrect: false },
        ]);
        setLinesForAnswer(5);
        setNotes('');
        setSolution('');
        setArchived(false);
      }
      setShowMathPreview(false);
      setValidationErrors([]);
    }
  }, [open, question, defaultGroupId]);

  const handleOptionTextChange = (index: number, text: string) => {
    setOptions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], text };
      return copy;
    });
  };

  const handleSelectCorrectOption = (index: number) => {
    setOptions((prev) =>
      prev.map((opt, i) => ({
        ...opt,
        isCorrect: i === index,
      }))
    );
  };

  const handleAddOption = () => {
    if (options.length >= 5) return;
    const nextIndex = options.length;
    const newLabel = OPTION_LABELS[nextIndex];
    setOptions((prev) => [
      ...prev,
      {
        id: `opt_${Date.now()}_${nextIndex}`,
        label: newLabel,
        text: '',
        isCorrect: false,
      },
    ]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      // Re-assign labels A, B, C...
      const relabeled = filtered.map((opt, i) => ({
        ...opt,
        label: OPTION_LABELS[i],
      }));
      // If the removed one was correct, set first as correct
      if (!relabeled.some((o) => o.isCorrect)) {
        relabeled[0].isCorrect = true;
      }
      return relabeled;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const now = new Date().toISOString();
    const candidateQuestion: BankQuestion = {
      id: question?.id ?? generateBankId(),
      groupId: groupId ?? null,
      type,
      prompt: prompt.trim(),
      points: Number(points),
      tagIds,
      createdAt: question?.createdAt ?? now,
      updatedAt: now,
      archived,
      notes: notes.trim() || undefined,
      solution: solution.trim() || undefined,
      ...(type === 'objective' ? { options } : { linesForAnswer: Number(linesForAnswer) }),
    };

    const validation = validateBankQuestion(candidateQuestion);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      setSaving(false);
      return;
    }

    try {
      const ok = await onSave(candidateQuestion);
      if (ok) {
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Editar Questão' : 'Nova Questão'}
      description="Preencha os dados da questão para salvá-la no banco."
      size="xl"
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-medium transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="question-editor-form"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-on-accent text-sm font-semibold shadow-xs disabled:opacity-50 transition"
          >
            {saving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Salvar no Banco'}
          </button>
        </div>
      }
    >
      <form
        id="question-editor-form"
        onSubmit={handleSave}
        className="flex flex-col gap-4 py-1"
      >
        {validationErrors.length > 0 && (
          <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/70 dark:bg-rose-950/20 text-xs text-rose-700 dark:text-rose-300 flex flex-col gap-1">
            <span className="font-semibold">Corrija os seguintes erros:</span>
            <ul className="list-disc list-inside">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Group Selector & Type Toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-meta font-bold uppercase tracking-wider text-slate-500 mb-1">
              Grupo
            </label>
            <GroupPicker
              groups={groups}
              value={groupId}
              onChange={setGroupId}
              rootLabel="Sem Grupo (Raiz)"
              onCreateGroup={onCreateGroup}
            />
          </div>

          <div>
            <label className="block text-meta font-bold uppercase tracking-wider text-slate-500 mb-1">
              Tipo de Questão
            </label>
            <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50 h-10">
              <button
                type="button"
                onClick={() => setType('objective')}
                className={cn(
                  'flex-1 py-1.5 rounded-md text-xs font-medium transition text-center',
                  type === 'objective'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Objetiva
              </button>
              <button
                type="button"
                onClick={() => setType('subjective')}
                className={cn(
                  'flex-1 py-1.5 rounded-md text-xs font-medium transition text-center',
                  type === 'subjective'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Dissertativa
              </button>
            </div>
          </div>
        </div>

        {/* Prompt Field with LaTeX Preview Toggle */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="question-prompt"
              className="text-meta font-bold uppercase tracking-wider text-slate-500"
            >
              Enunciado da Questão
            </label>
            <button
              type="button"
              onClick={() => setShowMathPreview(!showMathPreview)}
              className="inline-flex items-center gap-1 text-meta text-indigo-600 hover:underline"
            >
              {showMathPreview ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Ocultar pré-visualização LaTeX</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Pré-visualizar LaTeX</span>
                </>
              )}
            </button>
          </div>

          <textarea
            id="question-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Digite o enunciado da questão. Fórmulas LaTeX podem ser inseridas entre $...$ ou $$...$$"
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            required
          />

          {showMathPreview && prompt.trim() && (
            <div className="mt-2 p-3 rounded-lg border border-slate-200 bg-slate-50/70 text-sm text-slate-800">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                Pré-visualização KaTeX:
              </span>
              <MathView content={prompt} />
            </div>
          )}
        </div>

        {/* Objective Options or Subjective Lines */}
        {type === 'objective' ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-meta font-bold uppercase tracking-wider text-slate-500">
                Alternativas (assinale a correta)
              </span>
              {options.length < 5 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="inline-flex items-center gap-1 text-meta text-indigo-600 hover:underline font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Alternativa</span>
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {options.map((opt, index) => (
                <div
                  key={opt.id}
                  className={cn(
                    'flex items-center gap-2 p-1.5 rounded-lg border transition',
                    opt.isCorrect
                      ? 'border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-slate-200 bg-white'
                  )}
                >
                  <label
                    className="inline-flex items-center gap-1.5 pl-2 cursor-pointer select-none"
                    title="Marcar como correta"
                  >
                    <input
                      type="radio"
                      name="correct-option-group"
                      checked={opt.isCorrect}
                      onChange={() => handleSelectCorrectOption(index)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-bold text-xs text-slate-700 w-4">
                      {opt.label})
                    </span>
                  </label>

                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => handleOptionTextChange(index, e.target.value)}
                    placeholder={`Texto da alternativa ${opt.label}...`}
                    className="flex-1 px-2.5 py-1 text-sm rounded border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />

                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(index)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition"
                      title="Remover alternativa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label
              htmlFor="lines-for-answer"
              className="block text-meta font-bold uppercase tracking-wider text-slate-500 mb-1"
            >
              Linhas pautadas para resposta (mínimo 3)
            </label>
            <input
              id="lines-for-answer"
              type="number"
              min={3}
              max={30}
              value={linesForAnswer}
              onChange={(e) => setLinesForAnswer(parseInt(e.target.value, 10) || 3)}
              className="w-32 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        {/* Points & Tags */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-1">
            <label
              htmlFor="question-points"
              className="block text-meta font-bold uppercase tracking-wider text-slate-500 mb-1"
            >
              Pontuação Padrão
            </label>
            <input
              id="question-points"
              type="number"
              step="0.5"
              min="0.1"
              max="100"
              value={points}
              onChange={(e) => setPoints(parseFloat(e.target.value) || 1)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-meta font-bold uppercase tracking-wider text-slate-500 mb-1">
              Etiquetas (máx. 20)
            </label>
            <TagInput
              selectedTagIds={tagIds}
              tags={tags}
              onChange={setTagIds}
              onCreateTag={onCreateTag}
            />
          </div>
        </div>

        {/* Notes & Solution Collapsible or Accordion */}
        <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
          <div>
            <label
              htmlFor="question-notes"
              className="block text-meta font-bold uppercase tracking-wider text-slate-500 mb-1"
            >
              Anotações Internas (privadas, nunca impressas)
            </label>
            <input
              id="question-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Adaptada da Fuvest 2024, referência ao livro X pág. 42"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label
              htmlFor="question-solution"
              className="block text-meta font-bold uppercase tracking-wider text-slate-500 mb-1"
            >
              Resolução comentada (privada)
            </label>
            <textarea
              id="question-solution"
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              placeholder="Passo a passo ou gabarito comentado..."
              rows={2}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Archived checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={archived}
                onChange={(e) => setArchived(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Arquivar esta questão (oculta por padrão nas listagens e no gerador)</span>
            </label>
          </div>
        </div>
      </form>
    </Modal>
  );
};
