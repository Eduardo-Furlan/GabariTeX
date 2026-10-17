import { GradingRecord, Classroom, Student } from '../types/exam';
import { saveFile } from '../platform/files';

export type SaveResult =
  | { ok: true }
  | { ok: false; reason: 'quota' | 'disk_full' | 'permission' | 'unknown'; error?: unknown };

export const LAST_BACKUP_KEY = 'mcorr_last_backup_at';
export const ACTIVE_CLASS_STORAGE_KEY = 'mcorr_active_class';

export function saveLastBackupDate(date: Date = new Date()): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, date.toISOString());
  } catch (e) {
    console.error('Falha ao salvar data do último backup', e);
  }
}

export function loadLastBackupDate(): Date | null {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_KEY);
    return raw ? new Date(raw) : null;
  } catch {
    return null;
  }
}

export function saveActiveClassIdToStorage(classId: string | null): void {
  try {
    if (classId) {
      localStorage.setItem(ACTIVE_CLASS_STORAGE_KEY, classId);
    } else {
      localStorage.removeItem(ACTIVE_CLASS_STORAGE_KEY);
    }
  } catch {
    // Silencioso se indisponível
  }
}

export function loadActiveClassIdFromStorage(): string | null {
  try {
    return localStorage.getItem(ACTIVE_CLASS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function formatCsvDecimal(val: number, decimals = 2): string {
  return val.toFixed(decimals).replace('.', ',');
}

export interface GenerateGradebookCsvOptions {
  classrooms?: Classroom[];
  missingStudents?: Student[];
  filteredClassId?: string;
  targetScore?: number;
}

/**
 * Gera a string CSV formatada do livro de notas com compatibilidade pt-BR (separador ';', vírgula decimal,
 * escape seguro de aspas duplas, coluna Turma e colunas detalhadas de objetivas, dissertativas e pendências).
 */
export function generateGradebookCsv(
  records: GradingRecord[],
  options?: GenerateGradebookCsvOptions
): string {
  if (records.length === 0 && (!options?.missingStudents || options.missingStudents.length === 0)) {
    return '';
  }

  const allQuestionNumbers = Array.from(
    new Set(records.flatMap((r) => r.answers.map((a) => a.questionNumber)))
  ).sort((a, b) => a - b);

  const allSubjectiveNumbers = Array.from(
    new Set(records.flatMap((r) => (r.subjectiveAnswers || []).map((s) => s.questionNumber)))
  ).sort((a, b) => a - b);

  const qHeaders = allQuestionNumbers.map((qNum) => `Q${qNum}`);
  const dHeaders = allSubjectiveNumbers.map((qNum) => `D${qNum}`);

  const scoreHeader =
    options?.targetScore !== undefined ? `Nota (Escala ${options.targetScore})` : 'Nota';

  const headerParts = [
    'Aluno',
    'Matrícula',
    'Versão',
    scoreHeader,
    ...(options?.targetScore !== undefined ? ['Pontos Brutos'] : []),
    'Nota Máxima',
    'Porcentagem (%)',
    ...qHeaders,
    'Revisões manuais',
    'Objetivas',
    'Dissertativas',
    'Pendências',
    ...dHeaders,
    'Turma',
    'Data',
  ];

  const header = headerParts.join(';') + '\n';

  const rows = records.map((r) => {
    const qAnswers = allQuestionNumbers.map((qNum) => {
      const a = r.answers.find((ans) => ans.questionNumber === qNum);
      if (!a) return '-';
      if (a.annulled) {
        return `${a.markedOption || 'BRANCO'}(ANULADA)`;
      }
      return `${a.markedOption || 'BRANCO'}(${a.isCorrect ? 'C' : 'E'})`;
    });

    const manualOverridesCount = r.answers.filter((a) => a.manualOverride).length;
    const objectiveScore = r.answers.reduce((acc, a) => acc + a.pointsEarned, 0);
    const subjectiveScore = (r.subjectiveAnswers || []).reduce(
      (acc, s) => acc + (s.pointsEarned ?? 0),
      0
    );
    const pendingCount = (r.subjectiveAnswers || []).filter((s) => s.pointsEarned === null).length;

    const dAnswers = allSubjectiveNumbers.map((qNum) => {
      const s = (r.subjectiveAnswers || []).find((subj) => subj.questionNumber === qNum);
      if (!s || s.pointsEarned === null) return '';
      return formatCsvDecimal(s.pointsEarned);
    });

    const className =
      options?.classrooms?.find((c) => c.id === r.classId)?.name ||
      (r.classId ? r.classId : 'Sem turma');

    const dateStr = new Date(r.timestamp).toLocaleString('pt-BR');

    const scaledScore =
      options?.targetScore !== undefined
        ? r.maxScore > 0
          ? (r.totalScore / r.maxScore) * options.targetScore
          : (r.percentage / 100) * options.targetScore
        : r.totalScore;

    const rowParts = [
      escapeCsvField(r.studentName),
      escapeCsvField(r.studentId),
      escapeCsvField(r.versionLetter),
      formatCsvDecimal(scaledScore),
      ...(options?.targetScore !== undefined ? [formatCsvDecimal(r.totalScore)] : []),
      formatCsvDecimal(r.maxScore),
      `${formatCsvDecimal(r.percentage, 1)}%`,
      ...qAnswers,
      manualOverridesCount,
      formatCsvDecimal(objectiveScore),
      formatCsvDecimal(subjectiveScore),
      pendingCount,
      ...dAnswers,
      escapeCsvField(className),
      escapeCsvField(dateStr),
    ];

    return rowParts.join(';');
  });

  if (options?.missingStudents && options.missingStudents.length > 0) {
    const missingClassName =
      options.classrooms?.find((c) => c.id === options.filteredClassId)?.name ||
      (options.filteredClassId ? options.filteredClassId : 'Sem turma');

    const missingRows = options.missingStudents.map((st) => {
      const emptyAnswers = allQuestionNumbers.map(() => '-');
      const emptySubj = allSubjectiveNumbers.map(() => '');
      const parts = [
        escapeCsvField(st.name),
        escapeCsvField(st.registration || ''),
        '-',
        '0,00',
        ...(options?.targetScore !== undefined ? ['0,00'] : []),
        '0,00',
        'Sem nota',
        ...emptyAnswers,
        '0',
        '0,00',
        '0,00',
        '0',
        ...emptySubj,
        escapeCsvField(missingClassName),
        '-',
      ];
      return parts.join(';');
    });
    rows.push(...missingRows);
  }

  return header + rows.join('\n');
}

export function exportGradebookToCsv(
  records: GradingRecord[],
  options?: GenerateGradebookCsvOptions
): void {
  const csvBody = generateGradebookCsv(records, options);
  if (!csvBody) return;

  const csvContent = '\uFEFF' + csvBody;
  void saveFile({
    suggestedName: `notas_turma_${new Date().toISOString().slice(0, 10)}.csv`,
    mime: 'text/csv;charset=utf-8;',
    data: csvContent,
  });
}
