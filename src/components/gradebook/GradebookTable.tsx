import React, { useState } from 'react';
import { GradingRecord, OptionLabel, Classroom, Exam } from '../../types/exam';
import { ExamMeta } from '../../types/profile';
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
import { regradeRecords, RegradeReport } from '../../utils/regrade';
import { analyzeItems, exportItemAnalysisToCsv } from '../../utils/itemAnalysis';
import { MathView } from '../MathView';
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
  RefreshCw,
  BarChart2,
  AlertTriangle,
  Undo2,
  BookOpen,
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
  exam?: Exam;
  exams?: ExamMeta[];
  activeExamId?: string;
  onSelectActiveExam?: (id: string) => void;
  onUpdateRecords?: (records: GradingRecord[]) => void;
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
  exam,
  exams = [],
  activeExamId,
  onSelectActiveExam,
  onUpdateRecords,
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'items'>('table');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterOnlyPending, setFilterOnlyPending] = useState<boolean>(false);
  const [selectedExamFilter, setSelectedExamFilter] = useState<string>('current');
  const [selectedFilterClassId, setSelectedFilterClassId] = useState<string>('all');
  const [showMissingModal, setShowMissingModal] = useState<boolean>(false);
  const [copiedFeedback, setCopiedFeedback] = useState<boolean>(false);
  const [includeMissingInCsv, setIncludeMissingInCsv] = useState<boolean>(true);

  // Estados para recálculo de notas
  const [showRegradeModal, setShowRegradeModal] = useState<boolean>(false);
  const [regradePreview, setRegradePreview] = useState<{
    records: GradingRecord[];
    report: RegradeReport;
  } | null>(null);
  const [undoRecords, setUndoRecords] = useState<GradingRecord[] | null>(null);
  const [regradeFeedback, setRegradeFeedback] = useState<string | null>(null);

  const lastBackupDate = loadLastBackupDate();
  const daysSince = lastBackupDate
    ? Math.floor((Date.now() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isBackupStale = records.length > 0 && (daysSince === null || daysSince >= 7);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const knownIds = new Set(exams.map((e) => e.id));
  if (exam?.id) knownIds.add(exam.id);
  const orphanRecordsCount = records.filter((r) => r.examId && !knownIds.has(r.examId)).length;

  const effectiveExamId =
    selectedExamFilter === 'current' ? (activeExamId || exam?.id) : selectedExamFilter;

  // Filtro por prova (Plano 08 §2.2 e §4)
  const examFilteredRecords = records.filter((r) => {
    if (selectedExamFilter === 'all') return true;
    if (selectedExamFilter === 'orphan') {
      return r.examId && !knownIds.has(r.examId);
    }
    if (!effectiveExamId) return true;
    return r.examId === effectiveExamId || (!r.examId && exam?.id === effectiveExamId);
  });

  // Filtro por turma
  const classFilteredRecords = examFilteredRecords.filter((r) => {
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

  const missingList = currentBannerClass ? missingStudents(currentBannerClass, examFilteredRecords) : [];
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

  const handleStartRegrade = () => {
    if (!exam) {
      alert('A prova atual não foi encontrada neste aparelho.');
      return;
    }
    const result = regradeRecords(records, exam);
    setRegradePreview(result);
    setShowRegradeModal(true);
  };

  const handleConfirmRegrade = () => {
    if (!regradePreview || !onUpdateRecords) return;
    setUndoRecords(records);
    onUpdateRecords(regradePreview.records);
    setShowRegradeModal(false);
    setRegradeFeedback(
      `Notas recalculadas com sucesso: ${regradePreview.report.updated} ${
        regradePreview.report.updated === 1 ? 'nota atualizada' : 'notas atualizadas'
      }, ${regradePreview.report.unchanged} inalteradas.`
    );
  };

  const handleUndoRegrade = () => {
    if (!undoRecords || !onUpdateRecords) return;
    onUpdateRecords(undoRecords);
    setUndoRecords(null);
    setRegradeFeedback('Recálculo desfeito. As notas anteriores foram restauradas.');
  };

  const handleExportItemAnalysis = () => {
    if (!exam) return;
    const analysis = analyzeItems(classFilteredRecords, exam);
    exportItemAnalysisToCsv(analysis, exam.header.examTitle || 'prova');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      {/* Cabeçalho do Livro de Notas */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-bold text-slate-800">Livro de Notas</h2>
            <span className="ml-1 px-2.5 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 text-xs font-bold rounded-full">
              {classFilteredRecords.length} {classFilteredRecords.length === 1 ? 'prova corrigida' : 'provas corrigidas'}
            </span>
          </div>

          {/* Alternador de visualização: Tabela vs Análise por Questão */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md transition ${
                viewMode === 'table'
                  ? 'bg-white text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Notas
            </button>
            <button
              type="button"
              onClick={() => setViewMode('items')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                viewMode === 'items'
                  ? 'bg-white text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Análise por Questão</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Seletor de Filtro de Prova (Plano 08 §2.2) */}
          {(exams.length > 1 || orphanRecordsCount > 0) && (
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedExamFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedExamFilter(val);
                  if (val !== 'current' && val !== 'all' && val !== 'orphan' && onSelectActiveExam) {
                    onSelectActiveExam(val);
                  }
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="current">
                  Prova Atual ({exam?.header.examTitle || 'Ativa'})
                </option>
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.recordCount})
                  </option>
                ))}
                <option value="all">Todas as provas ({records.length})</option>
                {orphanRecordsCount > 0 && (
                  <option value="orphan">
                    Provas não encontradas neste aparelho ({orphanRecordsCount})
                  </option>
                )}
              </select>
            </div>
          )}

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

          {partialRecordsCount > 0 && viewMode === 'table' && (
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

          {/* Botão de Recalcular Notas com a Prova Atual */}
          {records.length > 0 && onUpdateRecords && (
            <button
              type="button"
              onClick={handleStartRegrade}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold shadow-sm transition"
              title="Recalcular notas com gabarito ou anulações da prova atual"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Recalcular</span>
            </button>
          )}

          {viewMode === 'table' && (
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
          )}

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

      {/* Faixa de feedback do recálculo com opção de Desfazer */}
      {regradeFeedback && (
        <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl flex items-center justify-between gap-3 text-xs text-indigo-900 dark:text-indigo-200 flex-wrap">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>{regradeFeedback}</span>
          </div>
          <div className="flex items-center gap-2">
            {undoRecords && (
              <button
                type="button"
                onClick={handleUndoRegrade}
                className="flex items-center gap-1 px-2.5 py-1 bg-white border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg font-bold text-indigo-700 dark:text-indigo-300 transition"
              >
                <Undo2 className="w-3.5 h-3.5" /> Desfazer Recálculo
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setRegradeFeedback(null);
                setUndoRecords(null);
              }}
              className="p-1 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300"
              title="Fechar aviso"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

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
                ) : (
                  onSelectActiveClass && (
                    <button
                      type="button"
                      onClick={() => onSelectActiveClass(currentBannerClass.id)}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                    >
                      (Tornar ativa)
                    </button>
                  )
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                {bannerGradedCount} de {bannerTotalInClass} alunos avaliados (
                {bannerTotalInClass > 0
                  ? ((bannerGradedCount / bannerTotalInClass) * 100).toFixed(0)
                  : 0}
                %)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {missingList.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowMissingModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:hover:bg-amber-900/80 text-amber-900 dark:text-amber-200 rounded-lg text-xs font-bold transition shadow-sm"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>{missingList.length} sem nota</span>
              </button>
            ) : bannerTotalInClass > 0 ? (
              <span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg">
                <Check className="w-3.5 h-3.5" /> Turma completa
              </span>
            ) : null}
          </div>
        </div>
      )}

      {/* Alerta de backup desatualizado */}
      {isBackupStale && onOpenBackupPanel && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              {daysSince === null
                ? 'Você ainda não exportou nenhum backup dos dados deste navegador.'
                : `Seu último backup foi exportado há ${daysSince} dias.`}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenBackupPanel}
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-on-accent rounded-lg font-bold text-xs shadow-sm transition"
          >
            <Database className="w-3 h-3" /> Fazer Backup Agora
          </button>
        </div>
      )}

      {/* MODO 1: ANÁLISE POR QUESTÃO */}
      {viewMode === 'items' ? (
        <div>
          {!exam ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Nenhuma prova disponível para análise de itens neste aparelho.
            </div>
          ) : (() => {
            const analysis = analyzeItems(classFilteredRecords, exam);
            return (
              <div className="space-y-4">
                {/* Faixa no topo */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 flex-wrap">
                    <span className="font-semibold">
                      Usando {analysis.used} {analysis.used === 1 ? 'nota' : 'notas'}; {analysis.excluded} fora
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      (registros com estrutura divergente ou sem identificação são excluídos)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportItemAnalysis}
                    disabled={analysis.items.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-on-accent rounded-lg text-xs font-semibold shadow-sm transition"
                  >
                    <Download className="w-3.5 h-3.5" /> Exportar Análise (CSV)
                  </button>
                </div>

                {/* Cards de resumo estatístico */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                    <span className="text-[11px] font-medium text-slate-500 block">Média da Turma</span>
                    <span className="text-lg font-bold text-slate-900 font-mono">
                      {analysis.summary.mean.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                    <span className="text-[11px] font-medium text-slate-500 block">Mediana</span>
                    <span className="text-lg font-bold text-slate-900 font-mono">
                      {analysis.summary.median.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                    <span className="text-[11px] font-medium text-slate-500 block">Menor Nota</span>
                    <span className="text-lg font-bold text-slate-900 font-mono">
                      {analysis.summary.min.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                    <span className="text-[11px] font-medium text-slate-500 block">Maior Nota</span>
                    <span className="text-lg font-bold text-slate-900 font-mono">
                      {analysis.summary.max.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Tabela de Itens */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-2.5 px-3 w-16">Item</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Enunciado</th>
                        <th className="py-2.5 px-3 text-center min-w-[130px]">Taxa de Acerto</th>
                        <th className="py-2.5 px-3 min-w-[220px]">Distribuição (A..E)</th>
                        <th className="py-2.5 px-3 text-center w-28">Em Branco / Rasura</th>
                        <th className="py-2.5 px-3 min-w-[180px]">Sinalizações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analysis.items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            Nenhuma questão objetiva encontrada para análise.
                          </td>
                        </tr>
                      ) : (
                        analysis.items.map((item) => (
                          <tr
                            key={item.questionId}
                            className="hover:bg-slate-50 transition"
                          >
                            <td className="py-3 px-3 font-bold text-slate-900 align-top">
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-mono">Q{item.originalNumber}</span>
                                {item.annulled && (
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                                    Anulada
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-700 align-top max-w-xs">
                              <div className="line-clamp-3">
                                <MathView content={item.prompt} />
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center align-top">
                              <div className="flex flex-col items-center gap-1">
                                <span className="font-mono font-bold text-sm text-slate-900">
                                  {item.correctPct.toFixed(1)}%
                                </span>
                                <div className="w-20 bg-slate-200 h-2 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      item.correctPct >= 70
                                        ? 'bg-emerald-500'
                                        : item.correctPct >= 30
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${Math.min(100, item.correctPct)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-slate-400">
                                  {item.respondents} {item.respondents === 1 ? 'resposta' : 'respostas'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3 align-top">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {Object.entries(item.optionPct).map(([opt, pct]) => {
                                  const isCorrect = opt === item.correctOptionLabel;
                                  return (
                                    <span
                                      key={opt}
                                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono ${
                                        isCorrect
                                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-bold'
                                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                                      }`}
                                    >
                                      <span>{opt}:</span>
                                      <span>{pct.toFixed(0)}%</span>
                                      {isCorrect && (
                                        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center text-[11px] text-slate-500 align-top">
                              <div>
                                Branco:{' '}
                                <span className="font-mono font-semibold text-slate-700">
                                  {item.blankPct.toFixed(0)}%
                                </span>
                              </div>
                              <div>
                                Rasura:{' '}
                                <span className="font-mono font-semibold text-slate-700">
                                  {item.multiplePct.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3 align-top">
                              <div className="flex flex-col gap-1">
                                {item.flags.map((flag) => {
                                  if (flag === 'possivel_erro_gabarito') {
                                    return (
                                      <span
                                        key={flag}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30"
                                      >
                                        <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                                        Possível erro de gabarito
                                      </span>
                                    );
                                  }
                                  if (flag === 'muito_dificil') {
                                    return (
                                      <span
                                        key={flag}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30"
                                      >
                                        Muito difícil (&lt; 30%)
                                      </span>
                                    );
                                  }
                                  if (flag === 'muito_facil') {
                                    return (
                                      <span
                                        key={flag}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200"
                                      >
                                        Muito fácil (&gt; 90%)
                                      </span>
                                    );
                                  }
                                  return null;
                                })}
                                {item.flags.length === 0 && (
                                  <span className="text-slate-400 text-xs">—</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        /* MODO 2: TABELA DE NOTAS TRADICIONAL */
        <div>
          {/* Faixa de Estatísticas de Médias da Turma */}
          {classFilteredRecords.length > 0 && (
            <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <span className="text-slate-500 text-xs font-medium block">
                  Média da Turma (Pontos)
                </span>
                <span className="text-lg font-bold text-slate-800 font-mono">
                  {averageScore.toFixed(2)}
                </span>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <span className="text-slate-500 text-xs font-medium block">
                  Média de Acertos (%)
                </span>
                <span className="text-lg font-bold text-slate-800 font-mono">
                  {averagePercentage.toFixed(1)}%
                </span>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <span className="text-slate-500 text-xs font-medium block">
                  Provas Computadas
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold text-slate-800 font-mono">
                    {totalEvaluated}
                  </span>
                  {excludedPartialCount > 0 && (
                    <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                      ({excludedPartialCount} com dissertativas pendentes)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {displayedRecords.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs sm:text-sm">
              {filterOnlyPending
                ? 'Nenhuma prova com questões dissertativas pendentes de correção.'
                : 'Nenhuma prova corrigida ainda.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="py-2.5 px-3">Data / Hora</th>
                    <th className="py-2.5 px-3">Aluno</th>
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
                      <tr
                        className={`hover:bg-slate-50/80 transition cursor-pointer ${
                          expandedId === r.id ? 'bg-slate-50/50' : ''
                        }`}
                        onClick={() => toggleExpand(r.id)}
                      >
                        <td className="py-3 px-3 text-slate-500 text-xs">
                          {new Date(r.timestamp).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          <div>
                            <span>{r.studentName || 'Não identificado'}</span>
                            {r.studentId && (
                              <span className="block text-[11px] font-mono text-slate-400 font-normal">
                                RA: {r.studentId}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 text-xs">
                          {classes.find((c) => c.id === r.classId)?.name || (
                            <span className="text-slate-400 italic">Sem turma</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-mono font-bold">
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
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => toggleExpand(r.id)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded"
                              title="Ver detalhes"
                            >
                              {expandedId === r.id ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
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
                                          <span className="font-bold text-slate-800">
                                            Q{a.questionNumber}
                                          </span>
                                          {a.annulled && (
                                            <span
                                              className="text-[10px] text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-1.5 py-0.5 rounded font-semibold"
                                              title="Questão anulada no recálculo"
                                            >
                                              Anulada
                                            </span>
                                          )}
                                          {a.manualOverride && (
                                            <span
                                              className="flex items-center gap-0.5 text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950 px-1 py-0.5 rounded font-semibold"
                                              title={`Ajustado manualmente (original: ${
                                                a.detectedOption || '—'
                                              })`}
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
                                              {a.markedOption ||
                                                (a.status === 'multiple' ? 'Rasura' : 'Branco')}
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
                                              onUpdateRecord(
                                                recomputeTotals({ ...r, answers: updatedAnswers })
                                              );
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
                                                onUpdateRecord(
                                                  recomputeTotals({ ...r, answers: updatedAnswers })
                                                );
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
                                          const updated = setSubjectiveScore(
                                            r,
                                            s.questionNumber,
                                            newScore
                                          );
                                          onUpdateRecord(updated);
                                        }}
                                        onMaxPointsChange={(newMax) => {
                                          if (!onUpdateRecord) return;
                                          const updated = setSubjectiveMaxPoints(
                                            r,
                                            s.questionNumber,
                                            newMax
                                          );
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
                <div className="text-center py-6 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
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

      {/* Modal de Confirmação do Recálculo de Notas */}
      {showRegradeModal && regradePreview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Recalcular Notas com a Prova Atual
                  </h3>
                  <p className="text-xs text-slate-500">
                    Aplica gabaritos corrigidos e anulações às notas salvas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRegradeModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* Resumo do relatório */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30">
                  <span className="text-slate-500 block text-[11px]">Notas a Atualizar</span>
                  <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300 font-mono">
                    {regradePreview.report.updated}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Notas Inalteradas</span>
                  <span className="text-lg font-bold text-slate-700 font-mono">
                    {regradePreview.report.unchanged}
                  </span>
                </div>
              </div>

              {/* Ignorados (se houver) */}
              {(regradePreview.report.skipped.noFingerprint > 0 ||
                regradePreview.report.skipped.structureChanged > 0 ||
                regradePreview.report.skipped.unknownVersion > 0) && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-900 dark:text-amber-300 space-y-1">
                  <span className="font-semibold block">Notas ignoradas no recálculo:</span>
                  <ul className="list-disc list-inside text-[11px] space-y-0.5">
                    {regradePreview.report.skipped.noFingerprint > 0 && (
                      <li>
                        {regradePreview.report.skipped.noFingerprint} sem código de integridade da estrutura
                      </li>
                    )}
                    {regradePreview.report.skipped.structureChanged > 0 && (
                      <li>
                        {regradePreview.report.skipped.structureChanged} com estrutura diferente da prova atual (questões adicionadas/removidas)
                      </li>
                    )}
                    {regradePreview.report.skipped.unknownVersion > 0 && (
                      <li>
                        {regradePreview.report.skipped.unknownVersion} com versão não encontrada no modelo atual
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Lista de variações */}
              {regradePreview.report.changes.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-slate-700 block mb-2">
                    Principais alterações de pontuação ({regradePreview.report.changes.length}):
                  </span>
                  <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {regradePreview.report.changes.map((c) => {
                      const diff = c.after - c.before;
                      return (
                        <div key={c.recordId} className="p-2 flex items-center justify-between">
                          <span className="font-medium text-slate-800 truncate max-w-[180px]">
                            {c.studentName || 'Aluno sem nome'}
                          </span>
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <span className="text-slate-400">{c.before.toFixed(2)}</span>
                            <span className="text-slate-300">→</span>
                            <span className="font-bold text-slate-800">{c.after.toFixed(2)}</span>
                            <span
                              className={`font-bold ml-1 ${
                                diff > 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : diff < 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              ({diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)})
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recomendação de Backup */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-600">
                  Deseja salvar um backup antes de aplicar as mudanças?
                </span>
                {onOpenBackupPanel && (
                  <button
                    type="button"
                    onClick={onOpenBackupPanel}
                    className="flex items-center gap-1 px-2.5 py-1 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-lg font-semibold hover:bg-slate-100 transition"
                  >
                    <Database className="w-3.5 h-3.5 text-slate-500" /> Backup
                  </button>
                )}
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowRegradeModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRegrade}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-on-accent text-xs font-bold rounded-lg shadow-sm transition"
              >
                <Check className="w-3.5 h-3.5" /> Confirmar Recálculo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
