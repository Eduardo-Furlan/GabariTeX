import { Exam } from '../types/exam';

/**
 * Calcula o hash FNV-1a de 32 bits de uma string e retorna como 8 caracteres hexadecimais minúsculos.
 */
export function fnv1a32(str: string): string {
  let hash = 0x811c9dc5;
  const bytes = new TextEncoder().encode(str);
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Gera uma representação canônica contendo estritamente a estrutura do exame:
 * versionCount, shuffleQuestions, shuffleOptions e, para cada questão na ordem,
 * seu id, type e a lista de id das alternativas.
 *
 * Não inclui: prompt, texto de opções, isCorrect, points ou annulled.
 */
export function canonicalExamStructure(exam: Exam): string {
  const parts: string[] = [
    `v:${exam.versionCount}`,
    `sq:${exam.shuffleQuestions ? 1 : 0}`,
    `so:${exam.shuffleOptions ? 1 : 0}`,
  ];

  for (const q of exam.questions) {
    const optIds = (q.options || []).map((o) => o.id).join(',');
    parts.push(`q:${q.id}:${q.type}:[${optIds}]`);
  }

  return parts.join('|');
}

/**
 * Calcula a impressão digital (fingerprint) da estrutura do exame (8 caracteres hexadecimais).
 */
export function computeExamFingerprint(exam: Exam): string {
  return fnv1a32(canonicalExamStructure(exam));
}

