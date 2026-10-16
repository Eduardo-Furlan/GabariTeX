import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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
  Award,
  Save,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  Eye,
  X,
  FileText,
} from 'lucide-react';

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
      return 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-800/60';
    }
    if (percentage >= 50) {
      return 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/50 dark:border-amber-800/60';
    }
    return 'text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/50 dark:border-rose-800/60';
  };

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

  const modalContent = (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-5 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col my-auto">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900">Resultado da Correção</h3>
          </div>
          <div className="flex items-center gap-2">
            {evidence?.sheetThumbUrl && (
              <button
                type="button"
                onClick={() => setShowFullSheetModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                <Eye className="w-3.5 h-3.5" /> Ver folha inteira
              </button>
            )}
            <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-black text-xs rounded-md">
              VERSÃO {record.versionLetter}
            </span>
          </div>
        </div>

        {/* Corpo do Modal com scroll interno se necessário */}
        <div className="flex-1 overflow-y-auto min-h-0 py-2.5 space-y-3 pr-1">
          {/* Alerta de Suspeita Global (muitas questões em branco) */}
          {isSuspiciousBlank && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/60 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold">Atenção: Muitas questões em branco ({blankCount} de {record.answers.length})</span>
                <p className="text-rose-700 dark:text-rose-300">
                  Confira se a foto está bem enquadrada e se a folha não está cortada ou inclinada. Se necessário, descarte e escaneie novamente.
                </p>
              </div>
            </div>
          )}

          {/* Banner de Revisão Humana */}
          {totalNeedsReview > 0 && (
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  <strong>{totalNeedsReview} {totalNeedsReview === 1 ? 'questão precisa' : 'questões precisam'} de revisão</strong>
                  {' '}(revisadas: {reviewedCount}/{totalNeedsReview})
                </span>
              </div>

              <button
                type="button"
                onClick={() => setFilterOnlyNeedsReview(!filterOnlyNeedsReview)}
                className="px-2.5 py-1 bg-white border border-amber-200 dark:border-amber-500/30 rounded-lg font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition"
              >
                {filterOnlyNeedsReview ? 'Mostrar todas as questões' : 'Mostrar só as que geram dúvida'}
              </button>
            </div>
          )}

          {/* Painel de Pontuação */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nota Final</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-slate-900">
                    {record.totalScore.toFixed(2)}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    / {record.maxScore.toFixed(2)} pts
                  </span>
                </div>
              </div>

              <div
                className={`px-3 py-1.5 rounded-lg border font-bold text-sm sm:text-base ${getScoreColor(
                  record.percentage
                )}`}
              >
                {recordIsPartial
                  ? `${record.percentage.toFixed(1)}% (Parcial)`
                  : `${record.percentage.toFixed(1)}% de aproveitamento`}
              </div>
            </div>

            {recordIsPartial && (
              <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs">
                <span className="text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1.5 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  {pendingSubjectiveCount}{' '}
                  {pendingSubjectiveCount === 1 ? 'dissertativa pendente' : 'dissertativas pendentes'}{' '}
                  : nota parcial
                </span>
                <span className="text-slate-600 font-mono text-[11px]">
                  Subtotal Objetivas: {objectiveEarned.toFixed(2)} / {objectiveMax.toFixed(2)} pts
                </span>
              </div>
            )}
          </div>

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
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
              <label className="block text-[11px] font-bold text-slate-600 uppercase">
                Espelho de Correção das Questões Objetivas:
              </label>
              <span className="text-[10px] text-slate-500">
                Você pode alterar a alternativa marcada clicando nas opções abaixo.
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
              {displayedAnswers.map((a) => {
                const currentChoice: ManualChoice =
                  a.status === 'blank'
                    ? 'BLANK'
                    : a.status === 'multiple'
                    ? 'INVALID'
                    : (a.markedOption as OptionLabel) || 'BLANK';

                const hasCrop = !!evidence?.rowCrops?.[a.questionNumber];

                return (
                  <div
                    key={a.questionNumber}
                    className={`p-2.5 text-xs transition ${
                      a.needsReview
                        ? 'bg-amber-50/60 dark:bg-amber-950/30 border-l-4 border-l-amber-500'
                        : a.manualOverride
                        ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-l-4 border-l-indigo-500'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-xs w-7">Q{a.questionNumber}</span>

                        {/* Status da resposta */}
                        {a.status === 'correct' && (
                          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Marcado:{' '}
                            {a.markedOption} (Correto)
                          </span>
                        )}
                        {a.status === 'wrong' && (
                          <span className="flex items-center gap-1 text-rose-700 dark:text-rose-300 font-semibold text-[11px]">
                            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> Marcado: {a.markedOption} |
                            Gabarito: {a.correctOption}
                          </span>
                        )}
                        {a.status === 'blank' && (
                          <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300 font-semibold text-[11px]">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Em Branco (Gabarito:{' '}
                            {a.correctOption})
                          </span>
                        )}
                        {a.status === 'multiple' && (
                          <span className="flex items-center gap-1 text-purple-700 dark:text-purple-300 font-semibold text-[11px]">
                            <AlertCircle className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Rasura / Dupla
                            marcação (Gabarito: {a.correctOption})
                          </span>
                        )}

                        {/* Indicador de dúvida ou intervenção manual */}
                        {a.needsReview && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-bold text-[10px]">
                            Dúvida OMR
                          </span>
                        )}

                        {a.manualOverride && (
                          <div className="flex items-center gap-1.5 text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                            <span className="bg-indigo-100 dark:bg-indigo-950 px-1.5 py-0.5 rounded font-mono">
                              Original: {a.detectedOption || '—'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRevert(a.questionNumber)}
                              className="flex items-center gap-0.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-300 underline font-semibold"
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
                        <span className="font-mono font-bold text-slate-700 min-w-[48px] text-right text-xs">
                          {a.pointsEarned.toFixed(1)} / {a.maxPoints.toFixed(1)} pt
                        </span>
                      </div>
                    </div>

                    {/* Recorte da Foto quando disponível */}
                    {hasCrop && (
                      <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center gap-2.5 flex-wrap">
                        <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                          <FileText className="w-3 h-3 text-slate-400" /> Recorte:
                        </span>
                        <img
                          src={evidence!.rowCrops[a.questionNumber]}
                          alt={`Recorte questão ${a.questionNumber}`}
                          className="max-h-10 rounded border border-slate-300 bg-white object-contain"
                        />
                        {a.fillRatios && (
                          <span className="text-[10px] font-mono text-slate-400">
                            A:{Math.round(a.fillRatios.A * 100)}% B:{Math.round(a.fillRatios.B * 100)}% C:{Math.round(a.fillRatios.C * 100)}% D:{Math.round(a.fillRatios.D * 100)}% E:{Math.round(a.fillRatios.E * 100)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Questões Dissertativas */}
          {hasSubjective && (
            <div>
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                <label className="block text-[11px] font-bold text-slate-600 uppercase">
                  Questões Dissertativas:
                </label>
                <span className="text-[10px] text-slate-500">
                  Lance a pontuação agora ou salve para lançar posteriormente no Livro de Notas.
                </span>
              </div>

              <div className="space-y-2 border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
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

        {/* Ações */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 flex-wrap shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-300 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Descartar / Escanear Novamente
          </button>
          <button
            type="button"
            onClick={handleSaveClick}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-on-accent rounded-lg text-xs font-bold shadow-sm transition"
          >
            <Save className="w-3.5 h-3.5" /> Salvar Nota no Livro
          </button>
        </div>
      </div>

      {/* Modal de Conflito de Duplicidade */}
      {duplicateCandidate && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Nota já lançada para este aluno
                </h3>
                <p className="text-xs text-slate-500">
                  Já existe uma correção para este aluno nesta turma.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div>
                <span className="text-slate-500">Aluno:</span>{' '}
                <strong className="text-slate-800">
                  {duplicateCandidate.studentName || record.studentName}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Nota já gravada:</span>{' '}
                <span className="font-mono font-bold text-slate-800">
                  Versão {duplicateCandidate.versionLetter}, {duplicateCandidate.totalScore.toFixed(1)} / {duplicateCandidate.maxScore.toFixed(1)} pts ({duplicateCandidate.percentage.toFixed(0)}%)
                </span>
              </div>
              <div>
                <span className="text-slate-500">Nova nota atual:</span>{' '}
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  Versão {record.versionLetter}, {record.totalScore.toFixed(1)} / {record.maxScore.toFixed(1)} pts ({record.percentage.toFixed(0)}%)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 flex-wrap">
              <button
                type="button"
                onClick={() => setDuplicateCandidate(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setDuplicateCandidate(null);
                  proceedSave(record);
                }}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                Manter as duas
              </button>
              <button
                type="button"
                onClick={() => {
                  const dupId = duplicateCandidate.id;
                  setDuplicateCandidate(null);
                  proceedSave({ ...record, id: dupId });
                }}
                className="px-3.5 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-on-accent rounded-lg shadow-sm transition"
              >
                Substituir nota anterior
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Overlay da Folha Inteira */}
      {showFullSheetModal && evidence?.sheetThumbUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setShowFullSheetModal(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-xl p-2 shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-700">Foto Completa Escaneada</span>
              <button
                type="button"
                onClick={() => setShowFullSheetModal(false)}
                className="p-1 text-slate-500 hover:text-slate-800 rounded transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={evidence.sheetThumbUrl}
              alt="Folha inteira escaneada"
              className="max-h-[80vh] object-contain rounded"
            />
          </div>
        </div>
      )}
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
};
