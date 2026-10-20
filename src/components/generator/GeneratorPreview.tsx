import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Layers,
  Dices,
  Plus,
  BookOpen,
} from 'lucide-react';
import {
  Blueprint,
  BankGroup,
  BankTag,
  BankQuestion,
} from '../../types/bank';
import {
  Pick,
  generateFromBlueprint,
  describeFailure,
} from '../../utils/bank/solver';
import { pathOf } from '../../utils/bank/tree';
import { Button } from '../ui/Button';
import { TagBadge } from '../bank/TagBadge';
import { toast } from '../ui/toastStore';

export interface GeneratorPreviewProps {
  blueprint: Blueprint;
  groups: BankGroup[];
  tags: BankTag[];
  questions: BankQuestion[];
  picks: Pick[];
  seed: number;
  onPicksChange: (picks: Pick[]) => void;
  onSeedChange: (seed: number) => void;
  excludeQuestionIds?: ReadonlySet<string>;
  onClearExclusions?: () => void;
  onCreateExam?: (picks: Pick[], title: string) => void;
  onAppendToExam?: (picks: Pick[]) => void;
  hasActiveExam?: boolean;
}

export const GeneratorPreview: React.FC<GeneratorPreviewProps> = ({
  blueprint,
  groups,
  tags,
  questions,
  picks,
  seed,
  onPicksChange,
  onSeedChange,
  excludeQuestionIds = new Set(),
  onClearExclusions,
  onCreateExam,
  onAppendToExam,
  hasActiveExam = false,
}) => {
  const [lockedQuestionIds, setLockedQuestionIds] = useState<Set<string>>(new Set());
  const [seedInput, setSeedInput] = useState(() => (seed >>> 0).toString(16));
  const [isSwapping, setIsSwapping] = useState<string | null>(null);

  const questionsById = React.useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions]
  );
  const groupsById = React.useMemo(
    () => new Map(groups.map((g) => [g.id, g])),
    [groups]
  );
  const tagsById = React.useMemo(
    () => new Map(tags.map((t) => [t.id, t])),
    [tags]
  );

  // Toggle lock for a question
  const handleToggleLock = (questionId: string) => {
    setLockedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  // Re-roll with new seed while preserving locked picks
  const handleReRoll = () => {
    const nextSeed = Math.floor(Math.random() * 0xffffffff);
    onSeedChange(nextSeed);
    setSeedInput((nextSeed >>> 0).toString(16));

    const lockedList = picks
      .filter((p) => lockedQuestionIds.has(p.questionId))
      .map((p) => ({ questionId: p.questionId, lineId: p.lineId }));

    const res = generateFromBlueprint({
      groups,
      tags,
      questions,
      blueprint,
      seed: nextSeed,
      excludeQuestionIds,
      locked: lockedList,
    });

    if (res.ok) {
      onPicksChange(res.picks);
      toast.success('Sorteio realizado com nova semente!');
    } else {
      const firstFailure = res.failures[0];
      const desc = describeFailure(firstFailure, { blueprint, groupsById, tagsById });
      toast.error(desc);
    }
  };

  // Change seed manually
  const handleApplySeed = () => {
    const parsed = parseInt(seedInput, 16);
    const newSeed = isNaN(parsed) ? 12345 : parsed;
    onSeedChange(newSeed);

    const lockedList = picks
      .filter((p) => lockedQuestionIds.has(p.questionId))
      .map((p) => ({ questionId: p.questionId, lineId: p.lineId }));

    const res = generateFromBlueprint({
      groups,
      tags,
      questions,
      blueprint,
      seed: newSeed,
      excludeQuestionIds,
      locked: lockedList,
    });

    if (res.ok) {
      onPicksChange(res.picks);
      toast.success('Semente aplicada com sucesso!');
    } else {
      const firstFailure = res.failures[0];
      const desc = describeFailure(firstFailure, { blueprint, groupsById, tagsById });
      toast.error(desc);
    }
  };

  // Swap single question
  const handleSwap = (pickToSwap: Pick) => {
    setIsSwapping(pickToSwap.questionId);
    try {
      // Lock all other picks
      const lockedForSwap = picks
        .filter((p) => p.questionId !== pickToSwap.questionId)
        .map((p) => ({ questionId: p.questionId, lineId: p.lineId }));

      // Exclude current question from pool
      const nextExcludes = new Set([...excludeQuestionIds, pickToSwap.questionId]);
      const nextSeed = Math.floor(Math.random() * 0xffffffff);

      const res = generateFromBlueprint({
        groups,
        tags,
        questions,
        blueprint,
        seed: nextSeed,
        excludeQuestionIds: nextExcludes,
        locked: lockedForSwap,
      });

      if (res.ok) {
        onPicksChange(res.picks);
        toast.success('Questão substituída com sucesso!');
      } else {
        toast.error('Não há outra questão que atenda a esta regra.');
      }
    } finally {
      setIsSwapping(null);
    }
  };

  const totalPoints = picks.reduce((sum, p) => sum + p.points, 0);

  return (
    <div className="space-y-4">
      {/* Controls Bar: Seed & Re-Roll */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-700">Semente:</span>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              onBlur={handleApplySeed}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplySeed();
              }}
              className="w-24 h-8 px-2 font-mono text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              title="Código hexadecimal da semente determinística"
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<Dices className="w-3.5 h-3.5" />}
              onClick={handleReRoll}
              title="Sortear nova semente"
            />
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Stats */}
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span>
              Total: <strong className="text-slate-900">{`${picks.length}/40`}</strong>
            </span>
            <span>•</span>
            <span>
              Soma de pontos: <strong className="text-slate-900">{totalPoints}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={handleReRoll}
          >
            Sortear de Novo
          </Button>

          {onCreateExam && (
            <Button
              variant="primary"
              size="sm"
              icon={<Sparkles className="w-3.5 h-3.5" />}
              onClick={() => onCreateExam(picks, blueprint.name)}
            >
              Criar Prova
            </Button>
          )}

          {hasActiveExam && onAppendToExam && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => onAppendToExam(picks)}
            >
              Adicionar à Prova Atual
            </Button>
          )}
        </div>
      </div>

      {/* Questions Preview Cards */}
      {picks.length === 0 ? (
        <div className="p-8 text-center bg-white border border-slate-200 rounded-xl">
          <p className="text-sm text-slate-500">
            Nenhuma questão sorteada ainda. Clique em "Pré-visualizar Sorteio" acima.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {picks.map((pick, idx) => {
            const q = questionsById.get(pick.questionId);
            const isLocked = lockedQuestionIds.has(pick.questionId);
            const isRepeated = excludeQuestionIds.has(pick.questionId);
            const grp = q?.groupId ? groupsById.get(q.groupId) : null;
            const groupPath = grp ? pathOf(groups, grp.id) : 'Sem Grupo';

            return (
              <div
                key={`${pick.questionId}-${idx}`}
                className={`p-3.5 bg-white border rounded-xl shadow-2xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isLocked
                    ? 'border-indigo-300 dark:border-indigo-500/40 bg-indigo-50/20 dark:bg-indigo-950/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Left: Number, Prompt and Info */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-slate-100 text-xs font-bold text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>

                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium text-slate-900 line-clamp-2">
                      {q?.prompt || 'Questão não encontrada'}
                    </p>

                    <div className="flex items-center gap-2 flex-wrap text-2xs text-slate-500">
                      <span className="font-semibold text-slate-600">{groupPath}</span>
                      <span>•</span>
                      <span>{q?.type === 'objective' ? 'Objetiva' : 'Discursiva'}</span>
                      <span>•</span>
                      <span className="font-semibold text-slate-700">{`${pick.points} pts`}</span>

                      {isRepeated && (
                        <span className="px-1.5 py-0.5 rounded text-2xs font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                          Já usada em outra prova
                        </span>
                      )}

                      {q?.tagIds?.map((tid) => {
                        const tag = tagsById.get(tid);
                        if (!tag) return null;
                        return (
                          <TagBadge
                            key={tid}
                            name={tag.name}
                            color={tag.color}
                            className="text-2xs py-0 h-4"
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right: Lock & Swap Actions */}
                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  <Button
                    variant={isLocked ? 'primary' : 'ghost'}
                    size="sm"
                    icon={isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5 text-slate-400" />}
                    onClick={() => handleToggleLock(pick.questionId)}
                    title={isLocked ? 'Fixada: mantida ao sortear novamente' : 'Fixar questão no sorteio'}
                  >
                    {isLocked ? 'Fixada' : 'Fixar'}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    loading={isSwapping === pick.questionId}
                    onClick={() => handleSwap(pick)}
                    title="Trocar por outra questão que atenda a esta mesma regra"
                  >
                    Trocar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
