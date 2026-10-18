import React, { useState, useEffect } from 'react';
import { GradingRecord, OptionLabel, Classroom, Exam } from '../../types/exam';
import { ExamMeta } from '../../types/profile';
import { exportGradebookToCsv, loadLastBackupDate } from '../../utils/storage';
import { printStudentSlips } from '../../utils/studentSlips';
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
import { Surface } from '../ui/Surface';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Segmented } from '../ui/Segmented';
import { ProgressBar } from '../ui/ProgressBar';
import { ScoreRing } from '../ui/ScoreRing';
import { CountUp } from '../ui/CountUp';
import { toast } from '../ui/toastStore';
import { cn } from '../ui/cn';
import { m, AnimatePresence } from 'motion/react';
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
  Printer,
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

type SortField = 'timestamp' | 'studentName' | 'class' | 'version' | 'score' | 'percentage';
type SortDirection = 'asc' | 'desc';

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
  const [selectedFilterClassId, setSelectedFilterClassId] = useState<string>(activeClassId ?? 'all');
  const [showMissingModal, setShowMissingModal] = useState<boolean>(false);
  const [copiedFeedback, setCopiedFeedback] = useState<boolean>(false);
  const [includeMissingInCsv, setIncludeMissingInCsv] = useState<boolean>(true);

  // Ordenação da tabela
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    if (activeClassId) {
      setSelectedFilterClassId(activeClassId);
    }
  }, [activeClassId]);

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

  const targetScore = exam?.header?.targetScore || 10;

  // Turma para exibição da faixa de estatísticas e faltantes
  const currentBannerClass =
    selectedFilterClassId !== 'all' && selectedFilterClassId !== 'none'
      ? classes.find((c) => c.id === selectedFilterClassId)
      : undefined;

  const missingList = currentBannerClass ? missingStudents(currentBannerClass, examFilteredRecords) : [];
  const bannerTotalInClass = currentBannerClass ? (currentBannerClass.students?.length ?? 0) : 0;
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
      targetScore: exam?.header?.targetScore,
    });
    toast.success('Arquivo CSV exportado com sucesso.');
  };

  const handlePrintSlips = () => {
    printStudentSlips(displayedRecords, {
      examTitle: exam?.header?.examTitle || 'Gabarito Oficial',
      targetScore,
      classroomName: currentBannerClass?.name,
    });
    toast.success('Gerando espelhos de resposta para impressão...');
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
    toast.success('Análise de itens exportada com sucesso.');
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'timestamp' || field === 'score' || field === 'percentage' ? 'desc' : 'asc');
    }
  };

  const sortedRecords = [...displayedRecords].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'timestamp') {
      cmp = a.timestamp - b.timestamp;
    } else if (sortField === 'studentName') {
      cmp = (a.studentName || '').localeCompare(b.studentName || '', 'pt-BR');
    } else if (sortField === 'class') {
      const classA = classes.find((c) => c.id === a.classId)?.name || '';
      const classB = classes.find((c) => c.id === b.classId)?.name || '';
      cmp = classA.localeCompare(classB, 'pt-BR');
    } else if (sortField === 'version') {
      cmp = (a.versionLetter || '').localeCompare(b.versionLetter || '');
    } else if (sortField === 'score') {
      cmp = a.totalScore - b.totalScore;
    } else if (sortField === 'percentage') {
      cmp = a.percentage - b.percentage;
    }
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  const renderSortHeader = (
    label: string,
    field: SortField,
    className?: string,
    align: 'left' | 'center' | 'right' = 'left'
  ) => {
    const isSorted = sortField === field;
    return (
      <th
        scope="col"
        aria-sort={isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
        className={cn(
          'py-2.5 px-3 cursor-pointer select-none transition-colors hover:text-slate-900',
          align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
          className
        )}
        onClick={() => handleSort(field)}
      >
        <div
          className={cn(
            'inline-flex items-center gap-1.5',
            align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'
          )}
        >
          <span>{label}</span>
          <span
            className={cn(
              'inline-flex transition-transform duration-140',
              isSorted ? 'opacity-100 text-indigo-600 dark:text-indigo-400' : 'opacity-0 hover:opacity-40 text-slate-400',
              isSorted && sortDirection === 'desc' && 'rotate-180'
            )}
            aria-hidden="true"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </span>
        </div>
      </th>
    );
  };

  return (
    <Surface tone="default" className="p-6 border border-slate-200 rounded-card shadow-card">
      {/* Cabeçalho do Livro de Notas */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-bold font-display text-slate-800">Livro de Notas</h2>
            <Badge tone="accent" className="font-bold tabular-nums">
              {classFilteredRecords.length} {classFilteredRecords.length === 1 ? 'prova corrigida' : 'provas corrigidas'}
            </Badge>
          </div>

          {/* Alternador de visualização: Tabela vs Análise por Questão */}
          <Segmented
            value={viewMode}
            onChange={(val) => setViewMode(val)}
            layoutId="gradebook-view-mode"
            size="sm"
            options={[
              { value: 'table', label: 'Notas' },
              { value: 'items', label: 'Análise por Questão', icon: <BarChart2 className="w-3.5 h-3.5" /> },
            ]}
          />
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
                className="text-meta px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              className="text-meta px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenClassManager}
                icon={<Settings2 className="w-3.5 h-3.5 text-slate-500" />}
                title="Gerenciar Turmas e Alunos"
              >
                <span className="hidden sm:inline">Turmas</span>
              </Button>
            )}
          </div>

          {partialRecordsCount > 0 && viewMode === 'table' && (
            <Button
              variant={filterOnlyPending ? 'soft' : 'secondary'}
              size="sm"
              onClick={() => setFilterOnlyPending(!filterOnlyPending)}
              icon={<Filter className="w-3.5 h-3.5" />}
              className={filterOnlyPending ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30' : undefined}
            >
              Só com pendências ({partialRecordsCount})
            </Button>
          )}

          {/* Botão de Recalcular Notas com a Prova Atual */}
          {records.length > 0 && onUpdateRecords && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleStartRegrade}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              className="text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
              title="Recalcular notas com gabarito ou anulações da prova atual"
            >
              Recalcular
            </Button>
          )}

          {viewMode === 'table' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedFilterClassId !== 'all' && selectedFilterClassId !== 'none' && currentBannerClass && (
                <label className="text-meta text-slate-600 flex items-center gap-1 cursor-pointer pr-1">
                  <input
                    type="checkbox"
                    checked={includeMissingInCsv}
                    onChange={(e) => setIncludeMissingInCsv(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Incluir faltantes</span>
                </label>
              )}

              <Button
                variant="primary"
                size="sm"
                onClick={handleExportCsv}
                disabled={classFilteredRecords.length === 0 && (!currentBannerClass || missingList.length === 0)}
                icon={<Download className="w-3.5 h-3.5" />}
                className="bg-emerald-600 hover:bg-emerald-700 text-on-accent"
              >
                Exportar para Excel / CSV
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handlePrintSlips}
                disabled={displayedRecords.length === 0}
                icon={<Printer className="w-3.5 h-3.5" />}
                title="Imprimir espelhos de resposta individuais dos alunos em filipetas A4"
              >
                Imprimir Espelhos (A4)
              </Button>
            </div>
          )}

          {records.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              icon={<Trash2 className="w-3.5 h-3.5 text-slate-400" />}
              className="text-slate-500 hover:text-rose-600 dark:hover:text-rose-400"
            >
              Limpar Histórico
            </Button>
          )}
        </div>
      </div>

      {/* Faixa de feedback do recálculo com opção de Desfazer */}
      {regradeFeedback && (
        <Surface tone="default" className="mb-4 p-3 border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 rounded-card flex items-center justify-between gap-3 text-body text-indigo-900 dark:text-indigo-200 flex-wrap">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="text-meta">{regradeFeedback}</span>
          </div>
          <div className="flex items-center gap-2">
            {undoRecords && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleUndoRegrade}
                icon={<Undo2 className="w-3.5 h-3.5" />}
                className="bg-white border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 font-bold"
              >
                Desfazer Recálculo
              </Button>
            )}
            <IconButton
              tone="ghost"
              size="sm"
              onClick={() => {
                setRegradeFeedback(null);
                setUndoRecords(null);
              }}
              label="Fechar aviso"
              className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300"
            >
              <X className="w-3.5 h-3.5" />
            </IconButton>
          </div>
        </Surface>
      )}

      {/* Faixa da Turma Ativa / Filtrada */}
      {currentBannerClass && (
        <Surface tone="default" className="mb-5 p-3.5 rounded-card border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-500/10 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-body font-bold text-slate-800">
                  {currentBannerClass.name}
                </span>
                {activeClassId === currentBannerClass.id ? (
                  <Badge tone="ok">
                    Turma Ativa
                  </Badge>
                ) : (
                  onSelectActiveClass && (
                    <button
                      type="button"
                      onClick={() => onSelectActiveClass(currentBannerClass.id)}
                      className="text-meta text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                    >
                      (Tornar ativa)
                    </button>
                  )
                )}
              </div>
              <p className="text-meta text-slate-500 tabular-nums">
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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowMissingModal(true)}
                icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 text-amber-900 dark:text-amber-300 border-amber-200 dark:border-amber-500/30 font-bold"
              >
                {missingList.length} sem nota
              </Button>
            ) : bannerTotalInClass > 0 ? (
              <span className="flex items-center gap-1.5 text-meta text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 px-2.5 py-1 rounded-lg">
                <Check className="w-3.5 h-3.5" /> Turma completa
              </span>
            ) : null}
          </div>
        </Surface>
      )}

      {/* Alerta de backup desatualizado */}
      {isBackupStale && onOpenBackupPanel && (
        <Surface tone="default" className="mb-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-card flex items-center justify-between text-body text-amber-900 dark:text-amber-300 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-meta">
              {daysSince === null
                ? 'Você ainda não exportou nenhum backup dos dados deste navegador.'
                : `Seu último backup foi exportado há ${daysSince} dias.`}
            </span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenBackupPanel}
            icon={<Database className="w-3 h-3" />}
            className="bg-amber-600 hover:bg-amber-700 text-on-accent"
          >
            Fazer Backup Agora
          </Button>
        </Surface>
      )}

      {/* MODO 1: ANÁLISE POR QUESTÃO */}
      {viewMode === 'items' ? (
        <div>
          {!exam ? (
            <div className="p-8 text-center text-slate-500 text-body">
              Nenhuma prova disponível para análise de itens neste aparelho.
            </div>
          ) : (() => {
            const analysis = analyzeItems(classFilteredRecords, exam);
            return (
              <div className="space-y-4">
                {/* Faixa no topo */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-card flex items-center justify-between flex-wrap gap-2 text-body">
                  <div className="flex items-center gap-2 text-slate-700 flex-wrap">
                    <span className="font-semibold text-meta">
                      Usando {analysis.used} {analysis.used === 1 ? 'nota' : 'notas'}; {analysis.excluded} fora
                    </span>
                    <span className="text-slate-400 text-meta">
                      (registros com estrutura divergente ou sem identificação são excluídos)
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleExportItemAnalysis}
                    disabled={analysis.items.length === 0}
                    icon={<Download className="w-3.5 h-3.5" />}
                    className="bg-emerald-600 hover:bg-emerald-700 text-on-accent"
                  >
                    Exportar Análise (CSV)
                  </Button>
                </div>

                {/* Cards de resumo estatístico */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-card">
                    <span className="text-meta font-medium text-slate-500 block">Média da Turma</span>
                    <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                      <CountUp value={analysis.summary.mean} decimals={2} />
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-card">
                    <span className="text-meta font-medium text-slate-500 block">Mediana</span>
                    <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                      <CountUp value={analysis.summary.median} decimals={2} />
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-card">
                    <span className="text-meta font-medium text-slate-500 block">Menor Nota</span>
                    <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                      <CountUp value={analysis.summary.min} decimals={2} />
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-card">
                    <span className="text-meta font-medium text-slate-500 block">Maior Nota</span>
                    <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                      <CountUp value={analysis.summary.max} decimals={2} />
                    </span>
                  </div>
                </div>

                {/* Tabela de Itens */}
                <div className="overflow-x-auto border border-slate-200 rounded-card">
                  <table className="w-full text-left border-collapse text-body">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-meta">
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
                          <td colSpan={6} className="py-8 text-center text-slate-400 text-body">
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
                                <span className="text-sm font-mono tabular-nums">Q{item.originalNumber}</span>
                                {item.annulled && (
                                  <Badge tone="warn">
                                    Anulada
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-700 align-top max-w-xs">
                              <div className="line-clamp-3">
                                <MathView content={item.prompt} />
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center align-top">
                              <div className="flex flex-col items-center gap-1.5 w-24 mx-auto">
                                <span className="font-mono font-bold text-sm text-slate-900 tabular-nums">
                                  <CountUp value={item.correctPct} decimals={1} suffix="%" />
                                </span>
                                <ProgressBar
                                  value={item.correctPct}
                                  max={100}
                                  tone={item.correctPct >= 70 ? 'ok' : item.correctPct >= 30 ? 'warn' : 'danger'}
                                  className="h-2 w-full"
                                  aria-label={`Taxa de acerto: ${item.correctPct.toFixed(1)}%`}
                                />
                                <span className="text-[10px] text-slate-400 tabular-nums">
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
                                      className={cn(
                                        'inline-flex items-center gap-1 px-2 py-1 rounded text-meta font-mono tabular-nums',
                                        isCorrect
                                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-bold'
                                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                                      )}
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
                            <td className="py-3 px-3 text-center text-meta text-slate-500 align-top">
                              <div>
                                Branco:{' '}
                                <span className="font-mono font-semibold text-slate-700 tabular-nums">
                                  {item.blankPct.toFixed(0)}%
                                </span>
                              </div>
                              <div>
                                Rasura:{' '}
                                <span className="font-mono font-semibold text-slate-700 tabular-nums">
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
                                  <span className="text-slate-400 text-meta">—</span>
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
          {/* Faixa de Estatísticas de Médias da Turma com ScoreRing + CountUp */}
          {classFilteredRecords.length > 0 && (
            <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Surface tone="default" className="p-4 flex items-center gap-4 border border-slate-200 rounded-card shadow-2xs">
                <ScoreRing
                  percent={Math.max(0, Math.min(100, (averageScore / (exam?.header?.targetScore || 10)) * 100))}
                  tone={averagePercentage >= 70 ? 'ok' : averagePercentage >= 50 ? 'warn' : 'danger'}
                  size="sm"
                />
                <div>
                  <span className="text-meta font-medium text-slate-500 block">
                    Média da Turma (Escala {targetScore})
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                      <CountUp
                        value={Number(((averagePercentage / 100) * targetScore).toFixed(2))}
                        decimals={2}
                      />
                    </span>
                    <span className="text-meta text-slate-400 font-mono tabular-nums">
                      (<CountUp value={averageScore} decimals={2} /> pts)
                    </span>
                  </div>
                </div>
              </Surface>

              <Surface tone="default" className="p-4 flex items-center gap-4 border border-slate-200 rounded-card shadow-2xs">
                <ScoreRing
                  percent={Math.max(0, Math.min(100, averagePercentage))}
                  tone={averagePercentage >= 70 ? 'ok' : averagePercentage >= 50 ? 'warn' : 'danger'}
                  size="sm"
                />
                <div>
                  <span className="text-meta font-medium text-slate-500 block">
                    Média de Acertos (%)
                  </span>
                  <div className="mt-0.5">
                    <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                      <CountUp value={averagePercentage} decimals={1} suffix="%" />
                    </span>
                  </div>
                </div>
              </Surface>

              <Surface tone="default" className="p-4 flex items-center gap-4 border border-slate-200 rounded-card shadow-2xs">
                <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-meta font-medium text-slate-500 block">
                    Provas Computadas
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                      <CountUp value={totalEvaluated} />
                    </span>
                    {excludedPartialCount > 0 && (
                      <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                        ({excludedPartialCount} com dissertativas pendentes)
                      </span>
                    )}
                  </div>
                </div>
              </Surface>
            </div>
          )}

          {displayedRecords.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-body">
              {filterOnlyPending
                ? 'Nenhuma prova com questões dissertativas pendentes de correção.'
                : 'Nenhuma prova corrigida ainda.'}
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-card">
              <table className="w-full text-left border-collapse text-body">
                <thead>
                  <tr className="sticky top-[var(--chrome-h,96px)] z-10 bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-meta shadow-xs">
                    {renderSortHeader('Data / Hora', 'timestamp', 'sticky left-0 bg-slate-50 md:static z-20')}
                    {renderSortHeader('Aluno', 'studentName')}
                    {renderSortHeader('Turma', 'class')}
                    {renderSortHeader('Versão', 'version', undefined, 'center')}
                    {renderSortHeader(`Nota (${targetScore})`, 'score', undefined, 'right')}
                    {renderSortHeader('Aproveitamento', 'percentage', undefined, 'center')}
                    <th scope="col" className="py-2.5 px-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <AnimatePresence initial={false}>
                    {sortedRecords.map((r) => (
                      <React.Fragment key={r.id}>
                        <m.tr
                          layout="position"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.16 }}
                          className={cn(
                            'group hover:bg-indigo-50 transition-colors cursor-pointer text-body',
                            expandedId === r.id && 'bg-slate-50/70'
                          )}
                          onClick={() => toggleExpand(r.id)}
                        >
                          <td className="py-3 px-3 text-slate-500 text-meta sticky left-0 z-10 bg-white group-hover:bg-indigo-50 md:static transition-colors tabular-nums">
                            {new Date(r.timestamp).toLocaleString('pt-BR')}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800">
                            <div>
                              <span>{r.studentName || 'Não identificado'}</span>
                              {r.studentId && (
                                <span className="block text-meta font-mono text-slate-400 font-normal tabular-nums">
                                  RA: {r.studentId}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600 text-meta">
                            {classes.find((c) => c.id === r.classId)?.name || (
                              <span className="text-slate-400 italic">Sem turma</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-meta font-mono font-bold">
                              {r.versionLetter}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                            <div>
                              <span>{((r.percentage / 100) * targetScore).toFixed(2)}</span>
                              <span className="block text-meta text-slate-400 font-normal">
                                {r.totalScore.toFixed(2)} / {r.maxScore.toFixed(2)} pts
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="inline-flex items-center justify-center gap-1.5">
                              <span
                                className={cn(
                                  'inline-block px-2.5 py-0.5 rounded-full text-meta font-bold tabular-nums',
                                  r.percentage >= 70
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                                    : r.percentage >= 50
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300'
                                )}
                              >
                                {`${r.percentage.toFixed(1)}%`}
                              </span>
                              {isPartial(r) && (
                                <Badge
                                  tone="warn"
                                  title="Contém questões dissertativas pendentes de nota"
                                >
                                  Parcial
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div
                              className="flex items-center justify-end gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <IconButton
                                tone="ghost"
                                size="sm"
                                onClick={() => toggleExpand(r.id)}
                                label={expandedId === r.id ? 'Recolher detalhes' : 'Ver detalhes'}
                              >
                                {expandedId === r.id ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </IconButton>
                              <IconButton
                                tone="ghost"
                                size="sm"
                                onClick={() => onDeleteRecord(r.id)}
                                label="Excluir nota"
                                className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </IconButton>
                            </div>
                          </td>
                        </m.tr>

                        {expandedId === r.id && (
                          <m.tr
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.14 }}
                            className="bg-slate-50/80"
                          >
                            <td colSpan={7} className="p-4">
                              <div className="text-body">
                                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                  <span className="font-semibold text-slate-700 block">
                                    Resumo e Edição das Respostas:
                                  </span>
                                  {onUpdateRecord && (
                                    <span className="text-meta text-slate-500">
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
                                        className={cn(
                                          'p-2.5 rounded-lg border flex flex-col justify-between gap-1.5',
                                          a.isCorrect
                                            ? 'bg-emerald-50/60 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/25'
                                            : 'bg-rose-50/60 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/25'
                                        )}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-slate-800 font-mono tabular-nums">
                                              Q{a.questionNumber}
                                            </span>
                                            {a.annulled && (
                                              <Badge tone="warn" title="Questão anulada no recálculo">
                                                Anulada
                                              </Badge>
                                            )}
                                            {a.manualOverride && (
                                              <Badge
                                                tone="accent"
                                                title={`Ajustado manualmente (original: ${a.detectedOption || '—'})`}
                                                className="flex items-center gap-0.5"
                                              >
                                                <Pencil className="w-2.5 h-2.5" /> Editado
                                              </Badge>
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
                                            <span className="text-meta text-slate-500 ml-1">
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
                                              <IconButton
                                                tone="ghost"
                                                size="sm"
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
                                                label="Restaurar valor detectado originalmente"
                                                className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                                              >
                                                <RotateCcw className="w-3.5 h-3.5" />
                                              </IconButton>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="text-meta text-slate-500 text-right font-mono tabular-nums">
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
                                        <span className="text-meta text-slate-500">
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
                          </m.tr>
                        )}
                      </React.Fragment>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de Alunos Faltando */}
      <Modal
        open={showMissingModal && Boolean(currentBannerClass)}
        onOpenChange={setShowMissingModal}
        title={`Alunos Sem Nota (${currentBannerClass?.name || ''})`}
        description="Alunos cadastrados na turma sem prova corrigida"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowMissingModal(false)}>
              Fechar
            </Button>
            {missingList.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleCopyMissingList}
                icon={copiedFeedback ? <Check className="w-3.5 h-3.5" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
              >
                {copiedFeedback ? 'Copiado!' : 'Copiar Lista'}
              </Button>
            )}
          </div>
        }
      >
        <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
          {missingList.length === 0 ? (
            <div className="text-center py-6 text-body text-emerald-600 dark:text-emerald-400 font-medium">
              Todos os alunos desta turma já possuem nota registrada!
            </div>
          ) : (
            missingList.map((st, i) => (
              <div key={st.id} className="py-2.5 flex items-center justify-between text-body">
                <span className="font-medium text-slate-800">
                  {i + 1}. {st.name}
                </span>
                <span className="font-mono text-slate-400 text-meta tabular-nums">
                  {st.registration ? `RA: ${st.registration}` : 'Sem matrícula'}
                </span>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Modal de Confirmação do Recálculo de Notas */}
      <Modal
        open={showRegradeModal && Boolean(regradePreview)}
        onOpenChange={setShowRegradeModal}
        title="Recalcular Notas com a Prova Atual"
        description="Aplica gabaritos corrigidos e anulações às notas salvas"
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowRegradeModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmRegrade}
              icon={<Check className="w-3.5 h-3.5" />}
            >
              Confirmar Recálculo
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-body">
          {/* Resumo do relatório */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-card bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30">
              <span className="text-slate-500 block text-meta">Notas a Atualizar</span>
              <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300 font-mono tabular-nums">
                <CountUp value={regradePreview?.report.updated ?? 0} />
              </span>
            </div>
            <div className="p-3 rounded-card bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block text-meta">Notas Inalteradas</span>
              <span className="text-lg font-bold text-slate-700 font-mono tabular-nums">
                <CountUp value={regradePreview?.report.unchanged ?? 0} />
              </span>
            </div>
          </div>

          {/* Ignorados (se houver) */}
          {regradePreview &&
            (regradePreview.report.skipped.noFingerprint > 0 ||
              regradePreview.report.skipped.structureChanged > 0 ||
              regradePreview.report.skipped.unknownVersion > 0) && (
              <div className="p-3 rounded-card bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-body text-amber-900 dark:text-amber-300 space-y-1">
                <span className="font-semibold block">Notas ignoradas no recálculo:</span>
                <ul className="list-disc list-inside text-meta space-y-0.5">
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
          {regradePreview && regradePreview.report.changes.length > 0 && (
            <div>
              <span className="text-meta font-semibold text-slate-700 block mb-2">
                Principais alterações de pontuação ({regradePreview.report.changes.length}):
              </span>
              <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100 text-body">
                {regradePreview.report.changes.map((c) => {
                  const diff = c.after - c.before;
                  return (
                    <div key={c.recordId} className="p-2.5 flex items-center justify-between">
                      <span className="font-medium text-slate-800 truncate max-w-[200px]">
                        {c.studentName || 'Aluno sem nome'}
                      </span>
                      <div className="flex items-center gap-2 font-mono text-meta tabular-nums">
                        <span className="text-slate-400">{c.before.toFixed(2)}</span>
                        <span className="text-slate-300">→</span>
                        <span className="font-bold text-slate-800">{c.after.toFixed(2)}</span>
                        <span
                          className={cn(
                            'font-bold ml-1',
                            diff > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : diff < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-400'
                          )}
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
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-card flex items-center justify-between text-body">
            <span className="text-slate-600 text-meta">
              Deseja salvar um backup antes de aplicar as mudanças?
            </span>
            {onOpenBackupPanel && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenBackupPanel}
                icon={<Database className="w-3.5 h-3.5 text-slate-500" />}
              >
                Backup
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </Surface>
  );
};
