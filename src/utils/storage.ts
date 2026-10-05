import { Exam, GradingRecord } from '../types/exam';

const EXAM_STORAGE_KEY = 'mcorr_exam_data';
const GRADEBOOK_STORAGE_KEY = 'mcorr_gradebook_data';

export function saveExamToStorage(exam: Exam): void {
  try {
    localStorage.setItem(EXAM_STORAGE_KEY, JSON.stringify(exam));
  } catch (e) {
    console.error('Falha ao salvar prova no localStorage', e);
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

export function saveGradebookToStorage(records: GradingRecord[]): void {
  try {
    localStorage.setItem(GRADEBOOK_STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Falha ao salvar notas no localStorage', e);
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

export function exportGradebookToCsv(records: GradingRecord[]): void {
  if (records.length === 0) return;

  const maxQuestions = Math.max(...records.map((r) => r.answers.length), 0);
  const qHeaders = Array.from({ length: maxQuestions }, (_, i) => `Q${i + 1}`).join(';');

  const header = `Aluno;Matrícula;Versão;Nota;Nota Máxima;Porcentagem (%);${qHeaders};Data\n`;

  const rows = records.map((r) => {
    const qAnswers = Array.from({ length: maxQuestions }, (_, i) => {
      const a = r.answers[i];
      if (!a) return '-';
      return `${a.markedOption || 'BRANCO'}(${a.isCorrect ? 'C' : 'E'})`;
    }).join(';');

    const dateStr = new Date(r.timestamp).toLocaleString('pt-BR');
    return `"${r.studentName}";"${r.studentId}";"${r.versionLetter}";${r.totalScore.toFixed(2)};${r.maxScore.toFixed(2)};${r.percentage.toFixed(1)}%;${qAnswers};"${dateStr}"`;
  });

  const csvContent = '\uFEFF' + header + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `notas_turma_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}
