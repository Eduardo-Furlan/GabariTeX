import React, { useState } from 'react';
import { GradingRecord, OptionLabel, Classroom } from '../../types/exam';
import { exportGradebookToCsv, loadLastBackupDate } from '../../utils/storage';
import { missingStudents } from '../../utils/classrooms';
import {
  applyManualOverride,
  revertOverride,
  recomputeTotals,
  setSubjectiveScore,
  setSubjectiveMaxPoints,
  isPartial,
  computeAverages,
  ManualChoice,
} from '../../utils/grading';
import { AnswerChoiceGroup } from '../scanner/AnswerChoiceGroup';
import { SubjectiveScoreInput } from '../scanner/SubjectiveScoreInput';
import {
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
  CheckCircle,
  XCircle,
  Pencil,
  RotateCcw,
  Database,
  ShieldAlert,
  Filter,
  GraduationCap,
  ClipboardCopy,
  Check,
  Settings2,
  X,
} from 'lucide-react';

interface GradebookTableProps {
  records: GradingRecord[];
  classes?: Classroom[];
  activeClassId?: string | null;
  onSelectActiveClass?: (id: string | null) => void;
  onOpenClassManager?: () => void;
  onUpdateRecord?: (record: GradingRecord) => void;
  onDeleteRecord: (id: string) => void;
  onClearAll: () => void;
  onOpenBackupPanel?: () => void;
}

export const GradebookTable: React.FC<GradebookTableProps> = ({
  records,
  classes = [],
  activeClassId = null,
  onSelectActiveClass,
  onOpenClassManager,
  onUpdateRecord,
  onDeleteRecord,
  onClearAll,
  onOpenBackupPanel,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterOnlyPending, setFilterOnlyPending] = useState<boolean>(false);
  const [selectedFilterClassId, setSelectedFilterClassId] = useState<string>('all');
  const [showMissingModal, setShowMissingModal] = useState<boolean>(false);
  const [copiedFeedback, setCopiedFeedback] = useState<boolean>(false);
  const [includeMissingInCsv, setIncludeMissingInCsv] = useState<boolean>(true);

  const lastBackupDate = loadLastBackupDate();
  const daysSince = lastBackupDate
    ? Math.floor((Date.now() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isBackupStale = records.length > 0 && (daysSince === null || daysSince >= 7);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Filtro por turma
  const classFilteredRecords = records.filter((r) => {
    if (selectedFilterClassId === 'all') return true;
    if (selectedFilterClassId === 'none') return !r.classId;
    return r.classId === selectedFilterClassId;
  });

  const { averageScore, averagePercentage, totalEvaluated, excludedPartialCount } =
    computeAverages(classFilteredRecords);

  const partialRecordsCount = classFilteredRecords.filter(isPartial).length;
  const displayedRecords = filterOnlyPending
    ? classFilteredRecords.filter(isPartial)
    : classFilteredRecords;

  // Turma para exibição da faixa de estatísticas e faltantes
  const currentBannerClass =
    selectedFilterClassId !== 'all' && selectedFilterClassId !== 'none'
      ? classes.find((c) => c.id === selectedFilterClassId)
      : activeClassId
      ? classes.find((c) => c.id === activeClassId)
      : undefined;

  const missingList = currentBannerClass ? missingStudents(currentBannerClass, records) : [];
  const bannerTotalInClass = currentBannerClass ? currentBannerClass.students.length : 0;
  const bannerGradedCount = bannerTotalInClass - missingList.length;

  const handleCopyMissingList = async () => {
    if (!currentBannerClass) return;
    const text = missingList.map((s) => s.name).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar', err);
    }
  };

  const handleExportCsv = () => {
    const isClassFiltered = selectedFilterClassId !== 'all' && selectedFilterClassId !== 'none';
    const missingToInclude =
      isClassFiltered && currentBannerClass && includeMissingInCsv
        ? missingList
        : undefined;

    exportGradebookToCsv(displayedRecords, {
      classrooms: classes,
      filteredClassId: isClassFiltered ? selectedFilterClassId : undefined,
      missingStudents: missingToInclude,
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-base font-bold text-slate-800">Livro de Notas</h2>
          <span className="ml-2 px-2.5 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-bold rounded-full">
            {classFilteredRecords.length} {classFilteredRecords.length === 1 ? 'prova corrigida' : 'provas corrigidas'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Seletor de Filtro de Turma */}
          <div className="flex items-center gap-1.5">
            <select
              value={selectedFilterClassId}
              onChange={(e) => setSelectedFilterClassId(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Todas as turmas ({records.length})</option>
              {classes.map((cls) => {
                const count = records.filter((r) => r.classId === cls.id).length;
                return (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({count})
                  </option>
                );
              })}
              <option value="none">
                Sem turma ({records.filter((r) => !r.classId).length})
              </option>
            </select>

            {onOpenClassManager && (
              <button
                type="button"
                onClick={onOpenClassManager}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-300 rounded-lg transition"
                title="Gerenciar Turmas e Alunos"
              >
                <Settings2 className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Turmas</span>
              </button>
            )}
          </div>

          {partialRecordsCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterOnlyPending(!filterOnlyPending)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                filterOnlyPending
                  ? 'bg-amber-100 dark:bg-amber-950/80 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Só com pendências ({partialRecordsCount})</span>
            </button>
          )}

          <div className="flex items-center gap-1.5">
            {selectedFilterClassId !== 'all' && selectedFilterClassId !== 'none' && currentBannerClass && (
              <label className="text-[11px] text-slate-600 flex items-center gap-1 cursor-pointer pr-1">
                <input
                  type="checkbox"
                  checked={includeMissingInCsv}
                  onChange={(e) => setIncludeMissingInCsv(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Incluir faltantes</span>
              </label>
            )}

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={classFilteredRecords.length === 0 && (!currentBannerClass || missingList.length === 0)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-on-accent rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5" /> Exportar para Excel / CSV
            </button>
          </div>

          {records.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 dark:hover:text-red-400 rounded-lg text-xs font-medium transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Limpar Histórico
            </button>
          )}
        </div>
      </div>

      {/* Faixa da Turma Ativa / Filtrada */}
      {currentBannerClass && (
        <div className="mb-5 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/60 dark:bg-indigo-950/30 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">
                  {currentBannerClass.name}
                </span>
                {activeClassId === currentBannerClass.id ? (
                  <span className="text-[9px] px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-extrabold uppercase rounded">
                    Turma Ativa
                  </span>
                ) : onSelectActiveClass ? (
                  <button
                    type="button"
                    onClick={() => onSelectActiveClass(currentBannerClass.id)}
                    className="text-[10px] px-2 py-0.5 rounded border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-semibold transition"
                  >
                    Tornar Ativa
                  </button>
                ) : null}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                <strong>{bannerTotalInClass}</strong> {bannerTotalInClass === 1 ? 'aluno' : 'alunos'} ·{' '}
                <strong>{bannerGradedCount}</strong> com nota ·{' '}
                <strong className={missingList.length > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}>
                  {missingList.length} faltando
                </strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {missingList.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowMissingModal(true)}
                  className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg shadow-sm transition"
                >
                  Ver Faltantes ({missingList.length})
                </button>
                <button
                  type="button"
                  onClick={handleCopyMissingList}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-on-accent rounded-lg shadow-sm transition"
                  title="Copiar nomes dos alunos sem nota (um por linha)"
                >
                  {copiedFeedback ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copiado!
                    </>
                  ) : (
                    <>
                      <ClipboardCopy className="w-3.5 h-3.5" /> Copiar Faltantes
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Faixa de Lembrete de Backup */}
      {records.length > 0 && (
        <div
          className={`mb-5 px-4 py-2.5 rounded-xl border text-xs flex items-center justify-between flex-wrap gap-2 transition ${
            isBackupStale
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
              : 'bg-slate-50 border border-slate-200 text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            {isBackupStale ? (
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <Database className="w-4 h-4 text-indigo-500 shrink-0" />
            )}
            <span>
              {lastBackupDate
                ? `Último backup completo: ${daysSince === 0 ? 'hoje' : daysSince === 1 ? 'ontem' : `há ${daysSince} dias`}`
                : 'Último backup: nenhum realizado ainda'}
              {isBackupStale && ' — Recomendamos exportar um backup para proteger suas notas contra perdas.'}
            </span>
          </div>
          {onOpenBackupPanel && (
            <button
              type="button"
              onClick={onOpenBackupPanel}
              className={`font-bold text-xs underline transition ${
                isBackupStale
                  ? 'text-amber-800 dark:text-amber-300 hover:text-amber-950'
                  : 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-800'
              }`}
            >
              Fazer backup agora
            </button>
          )}
        </div>
      )}

      {records.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-xs font-semibold text-slate-500 uppercase block">Total de Alunos</span>
            <span className="text-2xl font-bold text-slate-800">{records.length}</span>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-xs font-semibold text-slate-500 uppercase block">Média da Turma (Pontos)</span>
            <span className="text-2xl font-bold text-slate-800">{averageScore.toFixed(2)} pts</span>
            {excludedPartialCount > 0 && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 block mt-0.5 font-medium">
                ({excludedPartialCount} {excludedPartialCount === 1 ? 'parcial fora da média' : 'parciais fora da média'})
              </span>
            )}
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-xs font-semibold text-slate-500 uppercase block">Aproveitamento Médio</span>
            <span className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{averagePercentage.toFixed(1)}%</span>
            {excludedPartialCount > 0 && (
              <span className="text-[11px] text-slate-500 block mt-0.5 font-medium">
                ({totalEvaluated} {totalEvaluated === 1 ? 'prova completa' : 'provas completas'})
              </span>
            )}
          </div>
        </div>
      )}

      {records.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Nenhuma prova corrigida ainda.</p>
          <p className="text-xs text-slate-400 mt-1">
            Utilize a aba &quot;Corretor OMR&quot; para escanear os cartões-resposta dos alunos.
          </p>
        </div>
      ) : displayedRecords.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-sm font-medium text-slate-600">
            Nenhuma prova com pendências de correção encontrada.
          </p>
          <button
            type="button"
            onClick={() => setFilterOnlyPending(false)}
            className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
          >
            Limpar filtro
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Aluno</th>
                <th className="py-2.5 px-3">Matrícula</th>
                <th className="py-2.5 px-3">Turma</th>
                <th className="py-2.5 px-3 text-center">Versão</th>
                <th className="py-2.5 px-3 text-right">Nota</th>
                <th className="py-2.5 px-3 text-center">Aproveitamento</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedRecords.map((r) => (
                <React.Fragment key={r.id}>
                  <tr className="hover:bg-slate-50 transition cursor-pointer" onClick={() => toggleExpand(r.id)}>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {r.studentName || <span className="text-slate-400 italic">Não identificado</span>}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600 text-xs">
                      {r.studentId || '-'}
                    </td>
                    <td className="py-3 px-3 text-xs">
                      {(() => {
                        const cls = classes.find((c) => c.id === r.classId);
                        if (cls) {
                          return (
                            <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 font-medium rounded text-xs">
                              {cls.name}
                            </span>
                          );
                        }
                        return <span className="text-slate-400 italic text-[11px]">Sem turma</span>;
                      })()}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-800 font-bold text-xs rounded border border-slate-200">
                        {r.versionLetter}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {r.totalScore.toFixed(2)} / {r.maxScore.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center justify-center gap-1.5">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            r.percentage >= 70
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                              : r.percentage >= 50
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                          }`}
                        >
                          {r.percentage.toFixed(1)}%
                        </span>
                        {isPartial(r) && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                            title="Contém questões dissertativas pendentes de nota"
                          >
                            Parcial
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleExpand(r.id)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded"
                          title="Ver detalhes"
                        >
                          {expandedId === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRecord(r.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition"
                          title="Excluir nota"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {expandedId === r.id && (
                    <tr className="bg-slate-50/80">
                      <td colSpan={7} className="p-4">
                        <div className="text-xs">
                          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <span className="font-semibold text-slate-700 block">
                              Resumo e Edição das Respostas:
                            </span>
                            {onUpdateRecord && (
                              <span className="text-[11px] text-slate-500">
                                Clique nos seletores abaixo para corrigir qualquer alternativa diretamente no livro.
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {r.answers.map((a) => {
                              const currentChoice: ManualChoice =
                                a.status === 'blank'
                                  ? 'BLANK'
                                  : a.status === 'multiple'
                                  ? 'INVALID'
                                  : (a.markedOption as OptionLabel) || 'BLANK';

                              return (
                                <div
                                  key={a.questionNumber}
                                  className={`p-2.5 rounded-lg border flex flex-col justify-between gap-1.5 ${
                                    a.isCorrect
                                      ? 'bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/60'
                                      : 'bg-rose-50/60 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800/60'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-slate-800">Q{a.questionNumber}</span>
                                      {a.manualOverride && (
                                        <span
                                          className="flex items-center gap-0.5 text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950 px-1 py-0.5 rounded font-semibold"
                                          title={`Ajustado manualmente (original: ${a.detectedOption || '—'})`}
                                        >
                                          <Pencil className="w-2.5 h-2.5" /> Editado
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {a.isCorrect ? (
                                        <span className="flex items-center gap-0.5 text-emerald-700 dark:text-emerald-300 font-bold">
                                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                          {a.markedOption}
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-0.5 text-rose-700 dark:text-rose-300 font-bold">
                                          <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                                          {a.markedOption || (a.status === 'multiple' ? 'Rasura' : 'Branco')}
                                        </span>
                                      )}
                                      <span className="text-[10px] text-slate-500 ml-1">
                                        (Gab: {a.correctOption})
                                      </span>
                                    </div>
                                  </div>

                                  {onUpdateRecord ? (
                                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 mt-1 gap-1">
                                      <AnswerChoiceGroup
                                        size="sm"
                                        value={currentChoice}
                                        onChange={(choice) => {
                                          const updatedAnswers = r.answers.map((ans) =>
                                            ans.questionNumber === a.questionNumber
                                              ? applyManualOverride(ans, choice)
                                              : ans
                                          );
                                          onUpdateRecord(recomputeTotals({ ...r, answers: updatedAnswers }));
                                        }}
                                      />
                                      {a.manualOverride && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updatedAnswers = r.answers.map((ans) =>
                                              ans.questionNumber === a.questionNumber
                                                ? revertOverride(ans)
                                                : ans
                                            );
                                            onUpdateRecord(recomputeTotals({ ...r, answers: updatedAnswers }));
                                          }}
                                          className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-0.5 transition"
                                          title="Restaurar valor detectado originalmente"
                                        >
                                          <RotateCcw className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-slate-500 text-right">
                                      {a.pointsEarned.toFixed(1)} / {a.maxPoints.toFixed(1)} pt
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Questões Dissertativas */}
                          {r.subjectiveAnswers && r.subjectiveAnswers.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-slate-200">
                              <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                                <span className="font-semibold text-slate-700 block">
                                  Questões Dissertativas:
                                </span>
                                {onUpdateRecord && (
                                  <span className="text-[11px] text-slate-500">
                                    Ajuste a pontuação de cada dissertativa abaixo.
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                {r.subjectiveAnswers.map((s) => (
                                  <SubjectiveScoreInput
                                    key={s.questionNumber}
                                    questionNumber={s.questionNumber}
                                    maxPoints={s.maxPoints}
                                    pointsEarned={s.pointsEarned}
                                    disabled={!onUpdateRecord}
                                    onChange={(newScore) => {
                                      if (!onUpdateRecord) return;
                                      const updated = setSubjectiveScore(r, s.questionNumber, newScore);
                                      onUpdateRecord(updated);
                                    }}
                                    onMaxPointsChange={(newMax) => {
                                      if (!onUpdateRecord) return;
                                      const updated = setSubjectiveMaxPoints(r, s.questionNumber, newMax);
                                      onUpdateRecord(updated);
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Alunos Faltando */}
      {showMissingModal && currentBannerClass && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Alunos Sem Nota ({currentBannerClass.name})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Alunos cadastrados na turma sem prova corrigida
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMissingModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-100">
              {missingList.length === 0 ? (
                <div className="text-center py-6 text-xs text-emerald-600 font-medium">
                  Todos os alunos desta turma já possuem nota registrada!
                </div>
              ) : (
                missingList.map((st, i) => (
                  <div key={st.id} className="py-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      {i + 1}. {st.name}
                    </span>
                    <span className="font-mono text-slate-400 text-[11px]">
                      {st.registration ? `RA: ${st.registration}` : 'Sem matrícula'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowMissingModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg"
              >
                Fechar
              </button>
              {missingList.length > 0 && (
                <button
                  type="button"
                  onClick={handleCopyMissingList}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-on-accent text-xs font-bold rounded-lg shadow-sm transition"
                >
                  {copiedFeedback ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copiado!
                    </>
                  ) : (
                    <>
                      <ClipboardCopy className="w-3.5 h-3.5" /> Copiar Lista
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
