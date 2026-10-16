import { Exam, GradingRecord, Classroom } from '../types/exam';
import { saveLastBackupDate } from './storage';
import { isWithinLimit, MAX_QUESTIONS } from './examLimits';

export interface BackupFile {
  app: 'gabaritex';
  schema: 1;
  exportedAt: string; // ISO 8601
  exam: Exam;
  gradebook: GradingRecord[];
  classes?: Classroom[];
  teacherPassword?: string;
}

export interface GradebookExportFile {
  app: 'gabaritex-gradebook';
  schema: 1;
  exportedAt: string;
  gradebook: GradingRecord[];
}

export interface MergeSummary {
  added: number;
  updated: number;
  unchanged: number;
}

/**
 * Constrói o objeto de backup estruturado da aplicação.
 */
export function buildBackup(
  exam: Exam,
  gradebook: GradingRecord[],
  teacherPassword?: string,
  classes?: Classroom[]
): BackupFile {
  return {
    app: 'gabaritex',
    schema: 1,
    exportedAt: new Date().toISOString(),
    exam,
    gradebook,
    classes,
    teacherPassword,
  };
}

/**
 * Valida e converte o conteúdo de texto de um arquivo JSON em BackupFile.
 * Não lança exceções em caso de JSON malformado ou campos inválidos.
 */
export function parseBackup(
  text: string
): { ok: true; data: BackupFile } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Arquivo corrompido: formato JSON inválido.' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Estrutura inválida: o conteúdo raiz deve ser um objeto JSON.' };
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.app !== 'gabaritex') {
    return {
      ok: false,
      error: 'Arquivo incompatível: este arquivo não é um backup oficial do GabariTeX.',
    };
  }

  if (obj.schema !== 1) {
    return {
      ok: false,
      error: `Versão de esquema não suportada (${String(obj.schema)}). Esperado: schema 1.`,
    };
  }

  if (typeof obj.exportedAt !== 'string') {
    return { ok: false, error: 'Data de exportação ausente ou inválida no backup.' };
  }

  // Validação da prova (Exam)
  if (!obj.exam || typeof obj.exam !== 'object' || Array.isArray(obj.exam)) {
    return { ok: false, error: 'Dados da prova ausentes ou malformatados no arquivo de backup.' };
  }
  const examObj = obj.exam as Record<string, unknown>;
  if (!examObj.header || typeof examObj.header !== 'object' || !Array.isArray(examObj.questions)) {
    return {
      ok: false,
      error: 'Estrutura da prova corrompida: cabeçalho ou lista de questões ausentes.',
    };
  }

  if (!isWithinLimit(examObj.questions.length)) {
    return {
      ok: false,
      error: `A prova tem ${examObj.questions.length} questões; o máximo é ${MAX_QUESTIONS}. Remova ${examObj.questions.length - MAX_QUESTIONS} e tente novamente.`,
    };
  }

  // Validação do livro de notas (Gradebook)
  if (!Array.isArray(obj.gradebook)) {
    return {
      ok: false,
      error: 'Lista de notas de correção ausente ou malformatada no backup.',
    };
  }

  return {
    ok: true,
    data: {
      app: 'gabaritex',
      schema: 1,
      exportedAt: obj.exportedAt,
      exam: obj.exam as Exam,
      gradebook: obj.gradebook as GradingRecord[],
      classes: Array.isArray(obj.classes) ? (obj.classes as Classroom[]) : undefined,
      teacherPassword:
        typeof obj.teacherPassword === 'string' ? obj.teacherPassword : undefined,
    },
  };
}

/**
 * Dispara o download do arquivo de backup no navegador e registra a data do último backup.
 */
export function downloadBackupFile(backup: BackupFile): void {
  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `gabaritex-backup-${dateStr}.json`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  saveLastBackupDate();
}

/**
 * Constrói o arquivo de exportação exclusivo de notas para sincronização entre aparelhos.
 */
export function buildGradebookExport(gradebook: GradingRecord[]): GradebookExportFile {
  return {
    app: 'gabaritex-gradebook',
    schema: 1,
    exportedAt: new Date().toISOString(),
    gradebook,
  };
}

/**
 * Faz download das notas em formato JSON para levar do celular para o computador.
 */
export function downloadGradebookJson(gradebook: GradingRecord[]): void {
  const fileData = buildGradebookExport(gradebook);
  const jsonStr = JSON.stringify(fileData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `gabaritex-notas-${dateStr}.json`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Analisa e extrai uma lista de GradingRecord de um arquivo JSON (aceita export de notas, backup completo ou array direto).
 */
export function parseGradebookExport(
  text: string
): { ok: true; data: GradingRecord[] } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Arquivo corrompido: formato JSON inválido.' };
  }

  if (Array.isArray(parsed)) {
    return { ok: true, data: parsed as GradingRecord[] };
  }

  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    // Se for backup completo do GabariTeX
    if (obj.app === 'gabaritex' && Array.isArray(obj.gradebook)) {
      return { ok: true, data: obj.gradebook as GradingRecord[] };
    }
    // Se for arquivo de notas dedicado
    if (obj.app === 'gabaritex-gradebook' && Array.isArray(obj.gradebook)) {
      return { ok: true, data: obj.gradebook as GradingRecord[] };
    }
  }

  return {
    ok: false,
    error: 'Arquivo inválido: nenhuma lista de notas do GabariTeX encontrada no arquivo.',
  };
}

/**
 * Mescla duas listas de notas por ID, mantendo os registros mais recentes e calculando o resumo de alterações.
 */
export function mergeGradebooks(
  currentRecords: GradingRecord[],
  incomingRecords: GradingRecord[]
): {
  merged: GradingRecord[];
  summary: MergeSummary;
} {
  const currentMap = new Map<string, GradingRecord>();
  currentRecords.forEach((r) => currentMap.set(r.id, r));

  let added = 0;
  let updated = 0;
  let unchanged = 0;

  incomingRecords.forEach((incoming) => {
    const existing = currentMap.get(incoming.id);
    if (!existing) {
      currentMap.set(incoming.id, incoming);
      added++;
    } else {
      // Se o registro recebido for mais recente, atualiza
      if (incoming.timestamp > existing.timestamp) {
        currentMap.set(incoming.id, incoming);
        updated++;
      } else {
        unchanged++;
      }
    }
  });

  // Ordena por timestamp decrescente (mais recentes primeiro)
  const merged = Array.from(currentMap.values()).sort((a, b) => b.timestamp - a.timestamp);

  return {
    merged,
    summary: { added, updated, unchanged },
  };
}

