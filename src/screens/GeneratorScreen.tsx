import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  ArrowLeft,
  Save,
  Plus,
  Layers,
  Code2,
  FileCheck2,
  AlertTriangle,
  RotateCcw,
  X,
} from 'lucide-react';
import { Route } from '../router/hashRouter';
import { useBank } from '../context/BankContext';
import { useProfile } from '../context/ProfileContext';
import { Blueprint } from '../types/bank';
import { Exam, Question } from '../types/exam';
import { MAX_QUESTIONS } from '../utils/examLimits';
import {
  Pick,
  generateFromBlueprint,
  describeFailure,
  GenerateFailure,
  analyzeBlueprint,
} from '../utils/bank/solver';
import { generateBankId } from '../utils/bank/ids';
import { toExamQuestion } from '../utils/bank/questions';
import { buildExclusionSet } from '../utils/bank/usage';
import { VisualRuleBuilder } from '../components/generator/VisualRuleBuilder';
import { TextRuleEditor } from '../components/generator/TextRuleEditor';
import { GeneratorPreview } from '../components/generator/GeneratorPreview';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Segmented } from '../components/ui/Segmented';
import { Modal } from '../components/ui/Modal';
import { BubbleLoader } from '../components/ui/BubbleLoader';
import { toast } from '../components/ui/toastStore';

export interface GeneratorScreenProps {
  blueprintId?: string;
  onNavigate?: (route: Route) => void;
}

function createDefaultBlueprint(): Blueprint {
  const now = new Date().toISOString();
  return {
    id: generateBankId(),
    name: 'Novo Modelo',
    blocks: [
      {
        id: generateBankId(),
        source: { kind: 'all' },
        quotas: [
          {
            id: generateBankId(),
            count: 10,
            filter: { tagIds: [], notTagIds: [] },
          },
        ],
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

export const GeneratorScreen: React.FC<GeneratorScreenProps> = ({
  blueprintId,
  onNavigate,
}) => {
  const {
    isLoaded: isBankLoaded,
    isLoading: isBankLoading,
    ensureLoaded,
    blueprints,
    groups,
    tags,
    questions,
    saveBlueprint,
  } = useBank();

  const {
    exams,
    exam: activeExam,
    store,
    updateExam,
    createExam,
    importQuestions,
  } = useProfile();

  // Mode and active blueprint state
  const [editorMode, setEditorMode] = useState<'visual' | 'text'>('visual');
  const [currentBlueprint, setCurrentBlueprint] = useState<Blueprint>(() => {
    if (blueprintId) {
      const found = blueprints.find((b) => b.id === blueprintId);
      if (found) return JSON.parse(JSON.stringify(found));
    }
    return createDefaultBlueprint();
  });

  // Generation state
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 0xffffffff));
  const [picks, setPicks] = useState<Pick[]>([]);
  const [hasPreviewed, setHasPreviewed] = useState(false);
  const [generationFailure, setGenerationFailure] = useState<GenerateFailure | null>(null);

  // Avoid repeats state
  const [avoidRepeats, setAvoidRepeats] = useState(false);
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const [loadedExams, setLoadedExams] = useState<Map<string, Exam>>(new Map());

  // Dialogs
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [blueprintTitleInput, setBlueprintTitleInput] = useState('');
  const [blueprintDescInput, setBlueprintDescInput] = useState('');

  const [createExamModalOpen, setCreateExamModalOpen] = useState(false);
  const [newExamTitleInput, setNewExamTitleInput] = useState('');
  const [isCreatingExam, setIsCreatingExam] = useState(false);

  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);

  // Load blueprint if blueprintId provided
  useEffect(() => {
    if (!isBankLoaded) return;
    if (blueprintId) {
      const found = blueprints.find((b) => b.id === blueprintId);
      if (found) {
        setCurrentBlueprint(JSON.parse(JSON.stringify(found)));
        return;
      }
    }
  }, [blueprintId, blueprints, isBankLoaded]);

  // Load full exams when selected for exclusion
  useEffect(() => {
    if (!avoidRepeats || selectedExamIds.length === 0) return;
    let cancelled = false;

    async function fetchMissing() {
      const missing = selectedExamIds.filter((id) => !loadedExams.has(id));
      if (missing.length === 0) return;

      const results = await Promise.all(
        missing.map(async (id) => {
          const ex = await store.getExam(id);
          return { id, exam: ex };
        })
      );

      if (cancelled) return;
      setLoadedExams((prev) => {
        const next = new Map(prev);
        for (const res of results) {
          if (res.exam) next.set(res.id, res.exam);
        }
        return next;
      });
    }

    fetchMissing();
    return () => {
      cancelled = true;
    };
  }, [avoidRepeats, selectedExamIds, store, loadedExams]);

  // Exclusion set
  const excludeQuestionIds = useMemo(() => {
    if (!avoidRepeats || selectedExamIds.length === 0) {
      return new Set<string>();
    }
    const examList = selectedExamIds
      .map((id) => loadedExams.get(id))
      .filter((e): e is Exam => Boolean(e));
    return buildExclusionSet(examList, selectedExamIds);
  }, [avoidRepeats, selectedExamIds, loadedExams]);

  const groupsById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const questionsById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  // Blueprint Analysis for totals
  const analysis = useMemo(() => {
    return analyzeBlueprint({
      groups,
      tags,
      questions,
      blueprint: currentBlueprint,
      excludeQuestionIds,
    });
  }, [groups, tags, questions, currentBlueprint, excludeQuestionIds]);

  // Run generation
  const handleRunGeneration = useCallback(
    (customExcludes?: ReadonlySet<string>) => {
      const excludes = customExcludes ?? excludeQuestionIds;
      const res = generateFromBlueprint({
        groups,
        tags,
        questions,
        blueprint: currentBlueprint,
        seed,
        excludeQuestionIds: excludes,
      });

      if (res.ok) {
        setPicks(res.picks);
        setGenerationFailure(null);
        setHasPreviewed(true);
        toast.success('Sorteio realizado com sucesso!');
      } else {
        const first = res.failures[0];
        setGenerationFailure(first);
        setHasPreviewed(true);
        const desc = describeFailure(first, {
          blueprint: currentBlueprint,
          groupsById,
          tagsById,
        });
        toast.error(desc);
      }
    },
    [groups, tags, questions, currentBlueprint, seed, excludeQuestionIds, groupsById, tagsById]
  );

  // Model switching
  const handleSelectModel = (val: string) => {
    if (val === '__new__') {
      setCurrentBlueprint(createDefaultBlueprint());
      setPicks([]);
      setHasPreviewed(false);
      setGenerationFailure(null);
      return;
    }
    const found = blueprints.find((b) => b.id === val);
    if (found) {
      setCurrentBlueprint(JSON.parse(JSON.stringify(found)));
      setPicks([]);
      setHasPreviewed(false);
      setGenerationFailure(null);
    }
  };

  // Save Model
  const handleOpenSaveModal = () => {
    setBlueprintTitleInput(currentBlueprint.name);
    setBlueprintDescInput(currentBlueprint.description || '');
    setSaveModalOpen(true);
  };

  const handleConfirmSaveBlueprint = async () => {
    const trimmed = blueprintTitleInput.trim();
    if (!trimmed) {
      toast.error('O nome do modelo não pode ser vazio.');
      return;
    }
    const toSave: Blueprint = {
      ...currentBlueprint,
      name: trimmed,
      description: blueprintDescInput.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    const res = await saveBlueprint(toSave);
    if (res.ok) {
      setCurrentBlueprint(toSave);
      setSaveModalOpen(false);
      toast.success('Modelo salvo com sucesso!');
    }
  };

  // Create Exam
  const handleOpenCreateExamModal = () => {
    if (picks.length === 0) {
      toast.error('Realize o sorteio antes de criar a prova.');
      return;
    }
    setNewExamTitleInput(currentBlueprint.name || 'Nova Prova');
    setCreateExamModalOpen(true);
  };

  const handleConfirmCreateExam = async () => {
    setIsCreatingExam(true);
    try {
      const examTitle = newExamTitleInput.trim() || currentBlueprint.name || 'Nova Prova';
      const newExam = await createExam(examTitle);

      const examQuestions = picks.map((p) => {
        const bq = questionsById.get(p.questionId)!;
        return toExamQuestion(bq, p.points);
      });

      const clonedList: Question[] = examQuestions.slice(0, MAX_QUESTIONS).map((q) => ({
        ...JSON.parse(JSON.stringify(q)),
        id: crypto.randomUUID(),
        sourceQuestionId: q.sourceQuestionId,
        options: q.options
          ? q.options.map((opt) => ({
              ...opt,
              id: crypto.randomUUID(),
            }))
          : undefined,
      }));

      const populatedExam: Exam = {
        ...newExam,
        questions: clonedList,
        updatedAt: new Date().toISOString(),
      };

      await store.putExam(populatedExam);
      updateExam(populatedExam);
      setCreateExamModalOpen(false);
      toast.success('Prova criada com sucesso!');
      onNavigate?.({ type: 'exam_step', examId: populatedExam.id, step: 'criar' });
    } finally {
      setIsCreatingExam(false);
    }
  };

  // Append to active exam
  const handleAppendToActiveExam = () => {
    if (!activeExam || picks.length === 0) return;
    const examQuestions = picks.map((p) => {
      const bq = questionsById.get(p.questionId)!;
      return toExamQuestion(bq, p.points);
    });

    const countAdded = importQuestions(examQuestions);
    if (countAdded > 0) {
      toast.success(`${countAdded} questão(ões) adicionada(s) à prova ativa!`);
      onNavigate?.({ type: 'exam_step', examId: activeExam.id, step: 'criar' });
    }
  };

  if (!isBankLoaded && isBankLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <BubbleLoader size="lg" />
        <span className="text-meta font-medium text-slate-500 mt-4">
          Carregando gerador de provas...
        </span>
      </div>
    );
  }

  const modelOptions = [
    { value: '__new__', label: '+ Novo Modelo...' },
    ...blueprints.map((b) => ({ value: b.id, label: b.name })),
  ];

  return (
    <div className="screen-enter max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col flex-1 min-w-0 space-y-6">
      {/* Top Header / Bar */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          {onNavigate && (
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => onNavigate({ type: 'bank' })}
              title="Voltar ao banco"
            />
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-bold text-2xl text-slate-900">
                Gerar Prova
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
                {currentBlueprint.name}
              </span>
            </div>
            <p className="text-body text-slate-600 mt-0.5">
              Defina regras balanceadas de sorteio taxonômico e crie avaliações em instantes.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Model picker */}
          <div className="w-56">
            <Select<string>
              size="sm"
              value={blueprints.some((b) => b.id === currentBlueprint.id) ? currentBlueprint.id : '__new__'}
              onChange={handleSelectModel}
              options={modelOptions}
            />
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={<Save className="w-3.5 h-3.5" />}
            onClick={handleOpenSaveModal}
          >
            Salvar
          </Button>

          <Button
            variant="ghost"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => handleSelectModel('__new__')}
          >
            Novo
          </Button>

          {/* Visual | Text View Mode Toggle */}
          <Segmented
            value={editorMode}
            onChange={(val) => setEditorMode(val as 'visual' | 'text')}
            options={[
              { value: 'visual', label: 'Visual', icon: <Layers className="w-3.5 h-3.5" /> },
              { value: 'text', label: 'Texto', icon: <Code2 className="w-3.5 h-3.5" /> },
            ]}
            size="sm"
          />
        </div>
      </header>

      {/* Rules Builder (Visual or Text) */}
      <section className="space-y-4">
        {editorMode === 'visual' ? (
          <VisualRuleBuilder
            blueprint={currentBlueprint}
            onChange={setCurrentBlueprint}
            groups={groups}
            tags={tags}
            questions={questions}
            excludeQuestionIds={excludeQuestionIds}
          />
        ) : (
          <TextRuleEditor
            blueprint={currentBlueprint}
            onChange={setCurrentBlueprint}
            groups={groups}
            tags={tags}
          />
        )}
      </section>

      {/* Generation Bar: Avoid Repeats, Summary, Preview Action */}
      <section className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Avoid repeats toggle and multi-select */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={avoidRepeats}
                onChange={(e) => setAvoidRepeats(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <span className="text-xs font-semibold text-slate-700">
                Evitar questões usadas em:
              </span>
            </label>

            {avoidRepeats && (
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedExamIds.map((exId) => {
                  const m = exams.find((e) => e.id === exId);
                  return (
                    <span
                      key={exId}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
                    >
                      <span>{m ? m.name : exId}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedExamIds((prev) => prev.filter((id) => id !== exId))}
                        className="p-0.5 text-slate-400 hover:text-slate-700 rounded"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}

                <Select<string>
                  size="sm"
                  value=""
                  placeholder="+ Selecionar Prova"
                  onChange={(val) => {
                    if (val && !selectedExamIds.includes(val)) {
                      setSelectedExamIds((prev) => [...prev, val]);
                    }
                  }}
                  options={exams
                    .filter((e) => !selectedExamIds.includes(e.id))
                    .map((e) => ({ value: e.id, label: e.name }))}
                />
              </div>
            )}
          </div>

          {/* Right: Summary and Preview button */}
          <div className="flex items-center justify-between lg:justify-end gap-4">
            <div className="text-xs text-slate-600 flex items-center gap-3">
              <span>
                Total: <strong className="text-slate-900">{`${analysis.totalNeeded}/40`}</strong>
              </span>
              <span>•</span>
              {analysis.failures.length > 0 && (
                <span className="text-rose-600 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>
                    {analysis.failures.length} {analysis.failures.length === 1 ? 'aviso' : 'avisos'}
                  </span>
                </span>
              )}
            </div>

            <Button
              variant="primary"
              size="md"
              icon={<Sparkles className="w-4 h-4" />}
              onClick={() => handleRunGeneration()}
            >
              Pré-visualizar Sorteio
            </Button>
          </div>
        </div>

        {/* If generation failed due to exclusions, offer trying with repeats allowed */}
        {generationFailure && avoidRepeats && excludeQuestionIds.size > 0 && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
            <span className="text-rose-700 dark:text-rose-300">
              O sorteio não encontrou questões suficientes respeitando as provas excluídas.
            </span>
            <Button
              variant="soft"
              size="sm"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={() => handleRunGeneration(new Set())}
            >
              Tentar Permitindo Repetições
            </Button>
          </div>
        )}
      </section>

      {/* Preview Section */}
      {hasPreviewed && (
        <section className="space-y-4 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-semibold text-base text-slate-900">
              Pré-visualização do Sorteio
            </h2>
          </div>

          <GeneratorPreview
            blueprint={currentBlueprint}
            groups={groups}
            tags={tags}
            questions={questions}
            picks={picks}
            seed={seed}
            onPicksChange={setPicks}
            onSeedChange={setSeed}
            excludeQuestionIds={excludeQuestionIds}
            onCreateExam={handleOpenCreateExamModal}
            onAppendToExam={handleAppendToActiveExam}
            hasActiveExam={Boolean(activeExam && activeExam.id)}
          />
        </section>
      )}

      {/* Save Blueprint Modal */}
      <Modal
        open={saveModalOpen}
        onOpenChange={setSaveModalOpen}
        title="Salvar Modelo de Prova"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setSaveModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleConfirmSaveBlueprint}>
              Salvar Modelo
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome do Modelo
            </label>
            <input
              type="text"
              value={blueprintTitleInput}
              onChange={(e) => setBlueprintTitleInput(e.target.value)}
              placeholder="Ex: Prova Bimestral - Geometria"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Descrição (opcional)
            </label>
            <textarea
              value={blueprintDescInput}
              onChange={(e) => setBlueprintDescInput(e.target.value)}
              rows={3}
              placeholder="Ex: 10 questões cobrindo ângulos, triângulos e semelhança..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </Modal>

      {/* Create Exam Dialog */}
      <Modal
        open={createExamModalOpen}
        onOpenChange={setCreateExamModalOpen}
        title="Criar Prova a Partir do Sorteio"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setCreateExamModalOpen(false)}
              disabled={isCreatingExam}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmCreateExam}
              loading={isCreatingExam}
            >
              Criar Avaliação
            </Button>
          </div>
        }
      >
        <div className="space-y-3 py-2">
          <p className="text-xs text-slate-600">
            As {picks.length} questões sorteadas serão copiadas para uma nova prova independente.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Título da Nova Prova
            </label>
            <input
              type="text"
              value={newExamTitleInput}
              onChange={(e) => setNewExamTitleInput(e.target.value)}
              placeholder="Ex: Avaliação Bimestral de Geometria"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default GeneratorScreen;
