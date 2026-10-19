import React, { useState } from 'react';
import * as m from 'motion/react-m';
import { GradingRecord, OptionLabel, Classroom } from '../../types/exam';
import { GradingEvidence } from '../../types/omr';
import {
  applyManualOverride,
  revertOverride,
  recomputeTotals,
  setSubjectiveScore,
  setSubjectiveMaxPoints,
  countPendingSubjective,
  isPartial,
  ManualChoice,
} from '../../utils/grading';
import { findDuplicateRecord } from '../../utils/classrooms';
import { AnswerChoiceGroup } from './AnswerChoiceGroup';
import { SubjectiveScoreInput } from './SubjectiveScoreInput';
import { StudentPicker } from './StudentPicker';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Save,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  Eye,
  FileText,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ScoreRing } from '../ui/ScoreRing';
import { CountUp } from '../ui/CountUp';
import { Segmented } from '../ui/Segmented';
import { Alert } from '../ui/Alert';

interface GradingModalProps {
  initialRecord: GradingRecord;
  evidence?: GradingEvidence;
  onSave: (
    record: GradingRecord,
    options?: { newStudentToClass?: { classId: string; name: string; registration?: string } }
  ) => void;
  onCancel: () => void;
  classes?: Classroom[];
  activeClassId?: string | null;
  onSelectActiveClass?: (id: string | null) => void;
  records?: GradingRecord[];
  onOpenClassManager?: () => void;
}

export const GradingModal: React.FC<GradingModalProps> = ({
  initialRecord,
  evidence,
  onSave,
  onCancel,
  classes = [],
  activeClassId = null,
  onSelectActiveClass,
  records = [],
  onOpenClassManager,
}) => {
  const [record, setRecord] = useState<GradingRecord>(initialRecord);
  const [filterOnlyNeedsReview, setFilterOnlyNeedsReview] = useState<boolean>(false);
  const [showFullSheetModal, setShowFullSheetModal] = useState<boolean>(false);

  const [selectedClassId, setSelectedClassId] = useState<string | null>(
    initialRecord.classId || activeClassId || null
  );
  const [studentRef, setStudentRef] = useState<string | undefined>(initialRecord.studentRef);
  const [addToClass, setAddToClass] = useState<boolean>(true);
  const [duplicateCandidate, setDuplicateCandidate] = useState<GradingRecord | null>(null);

  const proceedSave = (targetRecord: GradingRecord) => {
    const finalRecord: GradingRecord = {
      ...targetRecord,
      classId: selectedClassId || undefined,
      studentRef: studentRef || undefined,
    };

    let newStudentOption: { classId: string; name: string; registration?: string } | undefined = undefined;
    if (
      addToClass &&
      selectedClassId &&
      finalRecord.studentName.trim() &&
      !finalRecord.studentRef
    ) {
      newStudentOption = {
        classId: selectedClassId,
        name: finalRecord.studentName.trim(),
        registration: finalRecord.studentId.trim() || undefined,
      };
    }

    onSave(finalRecord, newStudentOption ? { newStudentToClass: newStudentOption } : undefined);
  };

  const handleSaveClick = () => {
    const candidate = {
      classId: selectedClassId || undefined,
      studentRef: studentRef || undefined,
      registration: record.studentId.trim() || undefined,
    };

    const duplicate = findDuplicateRecord(records, candidate);
    if (duplicate && duplicate.id !== record.id) {
      setDuplicateCandidate(duplicate);
      return;
    }

    proceedSave(record);
  };

  const handleOptionChange = (questionNumber: number, choice: ManualChoice) => {
    const updatedAnswers = record.answers.map((a) => {
      if (a.questionNumber !== questionNumber) return a;
      return applyManualOverride(a, choice);
    });
    setRecord(recomputeTotals({ ...record, answers: updatedAnswers }));
  };

  const handleRevert = (questionNumber: number) => {
    const updatedAnswers = record.answers.map((a) => {
      if (a.questionNumber !== questionNumber) return a;
      return revertOverride(a);
    });
    setRecord(recomputeTotals({ ...record, answers: updatedAnswers }));
  };

  const handleSubjectiveChange = (questionNumber: number, score: number | null) => {
    setRecord((prev) => setSubjectiveScore(prev, questionNumber, score));
  };

  const handleSubjectiveMaxChange = (questionNumber: number, newMax: number) => {
    setRecord((prev) => setSubjectiveMaxPoints(prev, questionNumber, newMax));
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 70) {
      return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30';
    }
    if (percentage >= 50) {
      return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30';
    }
    return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30';
  };

  const scoreTone: 'ok' | 'warn' | 'danger' =
    record.percentage >= 70 ? 'ok' : record.percentage >= 50 ? 'warn' : 'danger';

  // Questões que precisam de atenção
  const initialNeedsReviewQuestions = initialRecord.answers.filter((a) => a.needsReview);
  const totalNeedsReview = initialNeedsReviewQuestions.length;
  const reviewedCount = record.answers.filter((a) => a.manualOverride).length;

  // Suspeita global: >= 50% em branco com >= 4 questões
  const blankCount = record.answers.filter((a) => a.status === 'blank').length;
  const isSuspiciousBlank = record.answers.length >= 4 && blankCount / record.answers.length >= 0.5;

  const hasSubjective = !!(record.subjectiveAnswers && record.subjectiveAnswers.length > 0);
  const pendingSubjectiveCount = countPendingSubjective(record);
  const recordIsPartial = isPartial(record);
  const objectiveEarned = record.answers.reduce((acc, a) => acc + a.pointsEarned, 0);
  const objectiveMax = record.answers.reduce((acc, a) => acc + a.maxPoints, 0);

  const displayedAnswers = filterOnlyNeedsReview
    ? record.answers.filter((a) => a.needsReview || a.manualOverride)
    : record.answers;

  return (
    <>
      <Modal
        open={true}
        onOpenChange={(open) => {
          if (!open) onCancel();
        }}
        title="Resultado da Correção"
        size="xl"
        footer={
          <div className="flex items-center justify-between w-full flex-wrap gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={onCancel}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Descartar / Escanear Novamente
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveClick}
              icon={<Save className="w-3.5 h-3.5" />}
            >
              Salvar Nota no Livro
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pt-1">
          {/* Header Superior: Versão + Botão Ver Folha */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Badge tone="accent">
                VERSÃO {record.versionLetter}
              </Badge>
              {record.studentName && (
                <span className="text-body font-bold text-slate-800">
                  {record.studentName}
                </span>
              )}
            </div>

            {evidence?.sheetThumbUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullSheetModal(true)}
                icon={<Eye className="w-3.5 h-3.5" />}
              >
                Ver folha inteira
              </Button>
            )}
          </div>

          {/* Painel Hero da Nota: ScoreRing + CountUp + Aproveitamento */}
          <div className="p-4 rounded-card border border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <ScoreRing
                percent={record.percentage}
                tone={scoreTone}
                size="md"
              >
                <span className="font-display font-bold text-meta tabular-nums text-slate-800">
                  {Math.round(record.percentage)}%
                </span>
              </ScoreRing>

              <div>
                <span className="text-meta font-bold text-slate-500 uppercase tracking-wider block">
                  Nota Final
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-headline font-black text-slate-900 tabular-nums">
                    <CountUp value={record.totalScore} decimals={2} duration={700} />
                  </span>
                  <span className="text-body font-semibold text-slate-500">
                    / {record.maxScore.toFixed(2)} pts
                  </span>
                </div>
              </div>
            </div>

            <div
              className={`px-3.5 py-1.5 rounded-lg border font-bold text-sm ${getScoreColor(
                record.percentage
              )}`}
            >
              {recordIsPartial
                ? `${record.percentage.toFixed(1)}% (Parcial)`
                : `${record.percentage.toFixed(1)}% de aproveitamento`}
            </div>
          </div>

          {/* Subtotal Dissertativas Pendentes */}
          {recordIsPartial && (
            <div className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 text-meta text-amber-900 dark:text-amber-200 flex items-center justify-between flex-wrap gap-2">
              <span className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                {pendingSubjectiveCount}{' '}
                {pendingSubjectiveCount === 1 ? 'dissertativa pendente' : 'dissertativas pendentes'}{' '}
                : nota parcial
              </span>
              <span className="font-mono text-slate-600 tabular-nums">
                Subtotal Objetivas: {objectiveEarned.toFixed(2)} / {objectiveMax.toFixed(2)} pts
              </span>
            </div>
          )}

          {/* Alerta de Conflito de Duplicidade */}
          {duplicateCandidate && (
            <Alert
              tone="warn"
              title="Nota já lançada para este aluno"
              action={
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setDuplicateCandidate(null);
                      proceedSave(record);
                    }}
                  >
                    Manter as duas
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      const dupId = duplicateCandidate.id;
                      setDuplicateCandidate(null);
                      proceedSave({ ...record, id: dupId });
                    }}
                  >
                    Substituir nota anterior
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDuplicateCandidate(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              }
            >
              Já existe uma nota para <strong>{duplicateCandidate.studentName || record.studentName}</strong> (Versão {duplicateCandidate.versionLetter}, {duplicateCandidate.totalScore.toFixed(1)} / {duplicateCandidate.maxScore.toFixed(1)} pts). Deseja substituir ou manter ambas?
            </Alert>
          )}

          {/* Alerta de Suspeita Global (muitas questões em branco) */}
          {isSuspiciousBlank && (
            <Alert tone="danger" title={`Atenção: Muitas questões em branco (${blankCount} de ${record.answers.length})`}>
              Confira se a foto está bem enquadrada e se a folha não está cortada ou inclinada. Se necessário, descarte e escaneie novamente.
            </Alert>
          )}

          {/* Banner / Filtro de Revisão Humana */}
          {totalNeedsReview > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/40 rounded-card flex items-center justify-between flex-wrap gap-2 text-meta text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  <strong>{totalNeedsReview} {totalNeedsReview === 1 ? 'questão precisa' : 'questões precisam'} de revisão</strong>
                  {' '}(revisadas: {reviewedCount}/{totalNeedsReview})
                </span>
              </div>

              <Segmented
                options={[
                  { value: 'all', label: 'Todas as questões' },
                  { value: 'review', label: `Só com dúvida (${totalNeedsReview})` },
                ]}
                value={filterOnlyNeedsReview ? 'review' : 'all'}
                onChange={(val) => setFilterOnlyNeedsReview(val === 'review')}
                layoutId="grading-review-filter"
              />
            </div>
          )}

          {/* Seletor / Dados do Aluno */}
          <StudentPicker
            classes={classes}
            selectedClassId={selectedClassId}
            onSelectClassId={(newId) => {
              setSelectedClassId(newId);
              onSelectActiveClass?.(newId);
            }}
            studentName={record.studentName}
            onStudentNameChange={(newName) => setRecord((prev) => ({ ...prev, studentName: newName }))}
            studentId={record.studentId}
            onStudentIdChange={(newId) => setRecord((prev) => ({ ...prev, studentId: newId }))}
            studentRef={studentRef}
            onStudentRefChange={(newRef) => setStudentRef(newRef)}
            addToClass={addToClass}
            onAddToClassChange={(val) => setAddToClass(val)}
            records={records}
            onOpenClassManager={() => onOpenClassManager?.()}
          />

          {/* Detalhamento Questão a Questão com Ajuste Manual */}
          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
              <label className="block text-meta font-bold text-slate-700">
                Espelho de Correção das Questões Objetivas:
              </label>
              <span className="text-meta text-slate-500">
                Você pode alterar a alternativa marcada clicando nas opções abaixo.
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-card divide-y divide-slate-100 bg-white">
              {displayedAnswers.map((a, idx) => {
                const currentChoice: ManualChoice =
                  a.status === 'blank'
                    ? 'BLANK'
                    : a.status === 'multiple'
                    ? 'INVALID'
                    : (a.markedOption as OptionLabel) || 'BLANK';

                const hasCrop = !!evidence?.rowCrops?.[a.questionNumber];

                return (
                  <m.div
                    key={a.questionNumber}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.2,
                      delay: Math.min(idx * 0.012, 0.48),
                    }}
                    className={`p-3 text-body transition ${
                      a.needsReview
                        ? 'bg-amber-50/70 dark:bg-amber-500/10 border-l-4 border-l-amber-500'
                        : a.manualOverride
                        ? 'bg-indigo-50/40 dark:bg-indigo-500/10 border-l-4 border-l-indigo-500'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-sm w-8">Q{a.questionNumber}</span>

                        {/* Status da resposta */}
                        {a.status === 'correct' && (
                          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold text-meta">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Marcado:{' '}
                            {a.markedOption} (Correto)
                          </span>
                        )}
                        {a.status === 'wrong' && (
                          <span className="flex items-center gap-1 text-rose-700 dark:text-rose-400 font-semibold text-meta">
                            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> Marcado: {a.markedOption} |
                            Gabarito: {a.correctOption}
                          </span>
                        )}
                        {a.status === 'blank' && (
                          <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold text-meta">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Em Branco (Gabarito:{' '}
                            {a.correctOption})
                          </span>
                        )}
                        {a.status === 'multiple' && (
                          <span className="flex items-center gap-1 text-purple-700 dark:text-purple-400 font-semibold text-meta">
                            <AlertCircle className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Rasura / Dupla
                            marcação (Gabarito: {a.correctOption})
                          </span>
                        )}

                        {/* Indicador de dúvida ou intervenção manual */}
                        {a.needsReview && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 font-bold text-[10px]">
                            Dúvida OMR
                          </span>
                        )}

                        {a.manualOverride && (
                          <div className="flex items-center gap-1.5 text-meta text-indigo-700 dark:text-indigo-400 font-medium">
                            <span className="bg-indigo-100 dark:bg-indigo-500/20 px-1.5 py-0.5 rounded font-mono">
                              Original: {a.detectedOption || '—'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRevert(a.questionNumber)}
                              className="flex items-center gap-0.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 underline font-semibold"
                              title="Restaurar leitura original da máquina"
                            >
                              <RotateCcw className="w-3 h-3" /> Desfazer
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <AnswerChoiceGroup
                          size="sm"
                          value={currentChoice}
                          onChange={(choice) => handleOptionChange(a.questionNumber, choice)}
                        />
                        <span className="font-mono font-bold text-slate-700 min-w-[54px] text-right text-meta tabular-nums">
                          {a.pointsEarned.toFixed(1)} / {a.maxPoints.toFixed(1)} pt
                        </span>
                      </div>
                    </div>

                    {/* Recorte da Foto quando disponível */}
                    {hasCrop && (
                      <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center gap-2.5 flex-wrap">
                        <span className="text-meta text-slate-500 font-medium flex items-center gap-1">
                          <FileText className="w-3 h-3 text-slate-400" /> Recorte:
                        </span>
                        <img
                          src={evidence!.rowCrops[a.questionNumber]}
                          alt={`Recorte questão ${a.questionNumber}`}
                          className="max-h-10 rounded border border-slate-300 bg-white object-contain"
                        />
                        {a.fillRatios && (
                          <span className="text-meta font-mono text-slate-400 tabular-nums">
                            A:{Math.round(a.fillRatios.A * 100)}% B:{Math.round(a.fillRatios.B * 100)}% C:{Math.round(a.fillRatios.C * 100)}% D:{Math.round(a.fillRatios.D * 100)}% E:{Math.round(a.fillRatios.E * 100)}%
                          </span>
                        )}
                      </div>
                    )}
                  </m.div>
                );
              })}
            </div>
          </div>

          {/* Questões Dissertativas */}
          {hasSubjective && (
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                <label className="block text-meta font-bold text-slate-700">
                  Questões Dissertativas:
                </label>
                <span className="text-meta text-slate-500">
                  Lance a pontuação agora ou salve para lançar posteriormente no Livro de Notas.
                </span>
              </div>

              <div className="space-y-2 border border-slate-200 rounded-card p-3 bg-slate-50/50">
                {record.subjectiveAnswers!.map((subj) => (
                  <SubjectiveScoreInput
                    key={subj.questionNumber}
                    questionNumber={subj.questionNumber}
                    maxPoints={subj.maxPoints}
                    pointsEarned={subj.pointsEarned}
                    onChange={(score) => handleSubjectiveChange(subj.questionNumber, score)}
                    onMaxPointsChange={(newMax) => handleSubjectiveMaxChange(subj.questionNumber, newMax)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal da Folha Inteira */}
      {showFullSheetModal && evidence?.sheetThumbUrl && (
        <Modal
          open={true}
          onOpenChange={(open) => setShowFullSheetModal(open)}
          title="Foto Completa Escaneada"
          size="xl"
          footer={
            <Button variant="secondary" size="sm" onClick={() => setShowFullSheetModal(false)}>
              Fechar
            </Button>
          }
        >
          <div className="flex items-center justify-center p-2">
            <img
              src={evidence.sheetThumbUrl}
              alt="Folha inteira escaneada"
              className="max-h-[75vh] object-contain rounded-card border border-slate-200"
            />
          </div>
        </Modal>
      )}
    </>
  );
};
