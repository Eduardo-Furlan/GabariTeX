import { Exam, GradingRecord } from '../types/exam';

export type SaveResult = { ok: true } | { ok: false; reason: 'quota' | 'unknown' };

export const EXAM_STORAGE_KEY = 'mcorr_exam_data';
export const GRADEBOOK_STORAGE_KEY = 'mcorr_gradebook_data';
export const TEACHER_PASSWORD_KEY = 'mcorr_teacher_password';
export const LAST_BACKUP_KEY = 'mcorr_last_backup_at';

export function isQuotaExceededError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return (
      err.name === 'QuotaExceededError' ||
      err.code === 22 ||
      err.code === 1014 ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    );
  }
  if (typeof err === 'object' && err !== null && 'name' in err) {
    const errorObj = err as { name?: string; code?: number };
    return (
      errorObj.name === 'QuotaExceededError' ||
      errorObj.code === 22 ||
      errorObj.code === 1014 ||
      errorObj.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    );
  }
  return false;
}

export function tryRequestPersistence(): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
      navigator.storage.persist().catch(() => {});
    }
  } catch {
    // Silencioso se não suportado
  }
}

export function saveExamToStorage(exam: Exam): SaveResult {
  try {
    localStorage.setItem(EXAM_STORAGE_KEY, JSON.stringify(exam));
    tryRequestPersistence();
    return { ok: true };
  } catch (e) {
    console.error('Falha ao salvar prova no localStorage', e);
    return { ok: false, reason: isQuotaExceededError(e) ? 'quota' : 'unknown' };
  }
}

export function loadExamFromStorage(): Exam | null {
  try {
    const raw = localStorage.getItem(EXAM_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Exam) : null;
  } catch (e) {
    console.error('Falha ao carregar prova do localStorage', e);
    return null;
  }
}

export function saveGradebookToStorage(records: GradingRecord[]): SaveResult {
  try {
    localStorage.setItem(GRADEBOOK_STORAGE_KEY, JSON.stringify(records));
    tryRequestPersistence();
    return { ok: true };
  } catch (e) {
    console.error('Falha ao salvar notas no localStorage', e);
    return { ok: false, reason: isQuotaExceededError(e) ? 'quota' : 'unknown' };
  }
}

export function loadGradebookFromStorage(): GradingRecord[] {
  try {
    const raw = localStorage.getItem(GRADEBOOK_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GradingRecord[]) : [];
  } catch (e) {
    console.error('Falha ao carregar notas do localStorage', e);
    return [];
  }
}

export function saveTeacherPasswordToStorage(password: string): void {
  try {
    localStorage.setItem(TEACHER_PASSWORD_KEY, password);
  } catch (e) {
    console.error('Falha ao salvar senha do professor no localStorage', e);
  }
}

export function loadTeacherPasswordFromStorage(): string | null {
  try {
    return localStorage.getItem(TEACHER_PASSWORD_KEY);
  } catch {
    return null;
  }
}

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

export function exportExamToJson(exam: Exam): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exam, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  const safeTitle = (exam.header.examTitle || 'prova').toLowerCase().replace(/[^a-z0-9]/gi, '_');
  downloadAnchor.setAttribute('download', `${safeTitle}_banco.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function formatCsvDecimal(val: number, decimals = 2): string {
  return val.toFixed(decimals).replace('.', ',');
}

/**
 * Gera a string CSV formatada do livro de notas com compatibilidade pt-BR (separador ';', vírgula decimal,
 * escape seguro de aspas duplas e colunas detalhadas de objetivas, dissertativas e pendências).
 */
export function generateGradebookCsv(records: GradingRecord[]): string {
  if (records.length === 0) return '';

  const allQuestionNumbers = Array.from(
    new Set(records.flatMap((r) => r.answers.map((a) => a.questionNumber)))
  ).sort((a, b) => a - b);

  const allSubjectiveNumbers = Array.from(
    new Set(records.flatMap((r) => (r.subjectiveAnswers || []).map((s) => s.questionNumber)))
  ).sort((a, b) => a - b);

  const qHeaders = allQuestionNumbers.map((qNum) => `Q${qNum}`);
  const dHeaders = allSubjectiveNumbers.map((qNum) => `D${qNum}`);

  const headerParts = [
    'Aluno',
    'Matrícula',
    'Versão',
    'Nota',
    'Nota Máxima',
    'Porcentagem (%)',
    ...qHeaders,
    'Revisões manuais',
    'Objetivas',
    'Dissertativas',
    'Pendências',
    ...dHeaders,
    'Data',
  ];

  const header = headerParts.join(';') + '\n';

  const rows = records.map((r) => {
    const qAnswers = allQuestionNumbers.map((qNum) => {
      const a = r.answers.find((ans) => ans.questionNumber === qNum);
      if (!a) return '-';
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

    const dateStr = new Date(r.timestamp).toLocaleString('pt-BR');

    const rowParts = [
      escapeCsvField(r.studentName),
      escapeCsvField(r.studentId),
      escapeCsvField(r.versionLetter),
      formatCsvDecimal(r.totalScore),
      formatCsvDecimal(r.maxScore),
      `${formatCsvDecimal(r.percentage, 1)}%`,
      ...qAnswers,
      manualOverridesCount,
      formatCsvDecimal(objectiveScore),
      formatCsvDecimal(subjectiveScore),
      pendingCount,
      ...dAnswers,
      escapeCsvField(dateStr),
    ];

    return rowParts.join(';');
  });

  return header + rows.join('\n');
}

export function exportGradebookToCsv(records: GradingRecord[]): void {
  const csvBody = generateGradebookCsv(records);
  if (!csvBody) return;

  const csvContent = '\uFEFF' + csvBody;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `notas_turma_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}
