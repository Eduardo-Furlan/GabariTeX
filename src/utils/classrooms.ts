import { Student, Classroom, GradingRecord } from '../types/exam';

export function normalizeText(s: string): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeRegistration(s: string): string {
  if (!s) return '';
  return s.trim().replace(/\s+/g, '').toLowerCase();
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
}

export function createClassroom(name: string): Classroom {
  const trimmed = name.trim();
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: trimmed || 'Nova Turma',
    students: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function addStudent(
  c: Classroom,
  input: { name: string; registration?: string }
): Classroom {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error('Nome do aluno não pode ser vazio.');
  }

  const newStudent: Student = {
    id: generateId(),
    name: trimmedName,
    registration: input.registration ? input.registration.trim() : undefined,
  };

  return {
    ...c,
    students: [...c.students, newStudent],
    updatedAt: new Date().toISOString(),
  };
}

export function updateStudent(
  c: Classroom,
  studentId: string,
  patch: Partial<Omit<Student, 'id'>>
): Classroom {
  const updatedStudents = c.students.map((st) => {
    if (st.id !== studentId) return st;
    const nextName = patch.name !== undefined ? patch.name.trim() : st.name;
    if (!nextName) {
      throw new Error('Nome do aluno não pode ser vazio.');
    }
    return {
      ...st,
      name: nextName,
      registration:
        patch.registration !== undefined
          ? patch.registration.trim() || undefined
          : st.registration,
    };
  });

  return {
    ...c,
    students: updatedStudents,
    updatedAt: new Date().toISOString(),
  };
}

export function removeStudent(c: Classroom, studentId: string): Classroom {
  return {
    ...c,
    students: c.students.filter((st) => st.id !== studentId),
    updatedAt: new Date().toISOString(),
  };
}

export function searchStudents(c: Classroom, query: string): Student[] {
  if (!query || !query.trim()) {
    return [...c.students];
  }

  const normQuery = normalizeText(query);
  const normReg = normalizeRegistration(query);

  return c.students.filter((st) => {
    const nameMatch = normalizeText(st.name).includes(normQuery);
    const regMatch = st.registration
      ? normalizeRegistration(st.registration).startsWith(normReg) ||
        normalizeRegistration(st.registration).includes(normReg)
      : false;
    return nameMatch || regMatch;
  });
}

function isDelimiterAt(line: string, i: number, delimiter: string): boolean {
  if (delimiter !== '-') {
    return line[i] === delimiter;
  }
  // Se o delimitador for '-', verifica se é separador de campos (com espaço adjacente)
  // para não quebrar hífens internos em nomes como "Jean-Claude" ou matrículas como "2026-001"
  if (line[i] !== '-') return false;
  const prevChar = i > 0 ? line[i - 1] : '';
  const nextChar = i < line.length - 1 ? line[i + 1] : '';
  return /\s/.test(prevChar) || /\s/.test(nextChar);
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // pula aspa escapada
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && isDelimiterAt(line, i, delimiter)) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

export function parseStudentList(text: string): {
  students: Array<{ name: string; registration?: string }>;
  duplicates: number;
  ignoredLines: number;
} {
  // Remove BOM se presente
  const cleanText = text.replace(/^\uFEFF/, '');
  const rawLines = cleanText.split(/\r?\n/);

  let duplicates = 0;
  let ignoredLines = 0;

  // Encontra a primeira linha com conteúdo para detectar o delimitador
  const firstContentLine = rawLines.find((l) => l.trim().length > 0);
  if (!firstContentLine) {
    return { students: [], duplicates: 0, ignoredLines: rawLines.length };
  }

  // Detecta se a primeira linha tem traço de separação com espaços adjacentes
  const dashCount = (firstContentLine.match(/\s+-\s*|\s*-\s+/g) || []).length;

  // Detecta o delimitador: mais frequente entre ';', '\t', '|', ',', '-'
  const counts: Record<string, number> = {
    ';': (firstContentLine.match(/;/g) || []).length,
    '\t': (firstContentLine.match(/\t/g) || []).length,
    '|': (firstContentLine.match(/\|/g) || []).length,
    ',': (firstContentLine.match(/,/g) || []).length,
    '-': dashCount,
  };

  let delimiter = ';';
  let maxCount = counts[';'];
  for (const sep of ['\t', '|', ',', '-']) {
    if (counts[sep] > maxCount) {
      delimiter = sep;
      maxCount = counts[sep];
    }
  }

  const parsedLines: string[][] = [];
  for (const line of rawLines) {
    if (!line.trim()) {
      ignoredLines++;
      continue;
    }
    const cols = parseCsvLine(line, delimiter);
    parsedLines.push(cols);
  }

  if (parsedLines.length === 0) {
    return { students: [], duplicates, ignoredLines };
  }

  // Verifica cabeçalho opcional na primeira linha
  const firstCols = parsedLines[0];
  const hasHeader = firstCols.some((col) => /matr|^ra$|nome|aluno/i.test(col));

  let nameColIdx = 0;
  let regColIdx = -1;
  let startIndex = 0;

  if (hasHeader) {
    startIndex = 1;
    nameColIdx = firstCols.findIndex((col) => /nome|aluno/i.test(col));
    regColIdx = firstCols.findIndex((col) => /matr|^ra$/i.test(col));
    if (nameColIdx === -1) {
      nameColIdx = 0;
    }
  } else {
    // Sem cabeçalho:
    // Se 1 coluna: só nomes
    // Se 2 colunas: a coluna majoritariamente numérica é a matrícula
    if (firstCols.length === 1) {
      nameColIdx = 0;
      regColIdx = -1;
    } else if (firstCols.length >= 2) {
      // Analisa as primeiras linhas para ver qual coluna é numérica
      let col0NumCount = 0;
      let col1NumCount = 0;
      const sampleLines = parsedLines.slice(0, 10);
      for (const row of sampleLines) {
        if (row[0] && /^[\d\s.\-_]+$/.test(row[0].trim())) col0NumCount++;
        if (row[1] && /^[\d\s.\-_]+$/.test(row[1].trim())) col1NumCount++;
      }

      if (col0NumCount > col1NumCount) {
        regColIdx = 0;
        nameColIdx = 1;
      } else if (col1NumCount > col0NumCount) {
        regColIdx = 1;
        nameColIdx = 0;
      } else {
        // Se empate, padrão col 0 = nome, col 1 = matrícula
        nameColIdx = 0;
        regColIdx = 1;
      }
    }
  }

  const seenRegs = new Set<string>();
  const seenNames = new Set<string>();
  const students: Array<{ name: string; registration?: string }> = [];

  for (let i = startIndex; i < parsedLines.length; i++) {
    const cols = parsedLines[i];
    const rawName = cols[nameColIdx]?.trim() || '';
    const rawReg = regColIdx >= 0 && cols[regColIdx] ? cols[regColIdx].trim() : undefined;

    if (!rawName) {
      ignoredLines++;
      continue;
    }

    const normN = normalizeText(rawName);
    const normR = rawReg ? normalizeRegistration(rawReg) : undefined;

    let isDup = false;
    if (normR && seenRegs.has(normR)) {
      isDup = true;
    } else if (seenNames.has(normN)) {
      isDup = true;
    }

    if (isDup) {
      duplicates++;
      continue;
    }

    if (normR) seenRegs.add(normR);
    seenNames.add(normN);

    students.push({
      name: rawName,
      registration: rawReg || undefined,
    });
  }

  return { students, duplicates, ignoredLines };
}

export function mergeIntoClassroom(
  c: Classroom,
  list: Array<{ name: string; registration?: string }>
): { classroom: Classroom; added: number; skipped: number } {
  const existingRegs = new Set<string>();
  const existingNames = new Set<string>();

  for (const st of c.students) {
    if (st.registration) {
      existingRegs.add(normalizeRegistration(st.registration));
    }
    existingNames.add(normalizeText(st.name));
  }

  let added = 0;
  let skipped = 0;
  const newStudents: Student[] = [...c.students];

  for (const item of list) {
    const normName = normalizeText(item.name);
    const normReg = item.registration ? normalizeRegistration(item.registration) : undefined;

    if (!item.name.trim()) {
      skipped++;
      continue;
    }

    if (normReg && existingRegs.has(normReg)) {
      skipped++;
      continue;
    }

    if (existingNames.has(normName)) {
      skipped++;
      continue;
    }

    if (normReg) existingRegs.add(normReg);
    existingNames.add(normName);

    newStudents.push({
      id: generateId(),
      name: item.name.trim(),
      registration: item.registration?.trim() || undefined,
    });
    added++;
  }

  return {
    classroom: {
      ...c,
      students: newStudents,
      updatedAt: new Date().toISOString(),
    },
    added,
    skipped,
  };
}

export function findDuplicateRecord(
  records: GradingRecord[],
  candidate: { classId?: string; studentRef?: string; registration?: string }
): GradingRecord | undefined {
  if (candidate.studentRef) {
    const found = records.find((r) => r.studentRef === candidate.studentRef);
    if (found) return found;
  }

  if (candidate.classId && candidate.registration) {
    const normCandReg = normalizeRegistration(candidate.registration);
    if (normCandReg) {
      const found = records.find(
        (r) =>
          r.classId === candidate.classId &&
          r.studentId &&
          normalizeRegistration(r.studentId) === normCandReg
      );
      if (found) return found;
    }
  }

  return undefined;
}

export function missingStudents(c: Classroom, records: GradingRecord[]): Student[] {
  const coveredRefs = new Set<string>();
  const coveredRegs = new Set<string>();

  for (const r of records) {
    if (r.classId === c.id || !r.classId) {
      if (r.studentRef) coveredRefs.add(r.studentRef);
      if (r.classId === c.id && r.studentId) {
        coveredRegs.add(normalizeRegistration(r.studentId));
      }
    }
  }

  return c.students.filter((st) => {
    if (coveredRefs.has(st.id)) return false;
    if (st.registration && coveredRegs.has(normalizeRegistration(st.registration))) {
      return false;
    }
    return true;
  });
}

/**
 * Lê um arquivo de texto com fallback automático de codificação (UTF-8 com fallback para Windows-1252).
 */
export async function readTextFile(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();

  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    return utf8Decoder.decode(buffer);
  } catch {
    const winDecoder = new TextDecoder('windows-1252');
    return winDecoder.decode(buffer);
  }
}
