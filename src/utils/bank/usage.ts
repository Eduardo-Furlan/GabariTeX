import { Exam } from '../../types/exam';

export interface ExamWithQuestions {
  id: string;
  questions?: { sourceQuestionId?: string }[];
}

/**
 * Builds an index of bank question IDs to the IDs of exams that reference them.
 */
export function buildQuestionUsageMap(
  exams: readonly ExamWithQuestions[]
): Map<string, string[]> {
  const map = new Map<string, Set<string>>();

  for (const ex of exams) {
    if (!ex.questions) continue;
    for (const q of ex.questions) {
      if (q.sourceQuestionId) {
        let set = map.get(q.sourceQuestionId);
        if (!set) {
          set = new Set<string>();
          map.set(q.sourceQuestionId, set);
        }
        set.add(ex.id);
      }
    }
  }

  const result = new Map<string, string[]>();
  for (const [bqId, examSet] of map.entries()) {
    result.set(bqId, Array.from(examSet));
  }
  return result;
}

/**
 * Builds a map of bank question ID to number of exams using it.
 */
export function buildUsageCounts(
  usageMap: Map<string, string[]>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const [bqId, examIds] of usageMap.entries()) {
    counts.set(bqId, examIds.length);
  }
  return counts;
}

/**
 * Builds an exclusion set of bank question IDs used in the chosen exams.
 */
export function buildExclusionSet(
  exams: readonly ExamWithQuestions[],
  chosenExamIds: readonly string[]
): Set<string> {
  const chosenSet = new Set(chosenExamIds);
  const excluded = new Set<string>();

  for (const ex of exams) {
    if (chosenSet.has(ex.id) && ex.questions) {
      for (const q of ex.questions) {
        if (q.sourceQuestionId) {
          excluded.add(q.sourceQuestionId);
        }
      }
    }
  }

  return excluded;
}

/**
 * Returns user-facing pt-BR copy for question usage.
 */
export function formatQuestionUsage(examCount: number): string {
  if (examCount <= 0) {
    return 'Nunca usada';
  }
  if (examCount === 1) {
    return 'Usada em 1 prova';
  }
  return `Usada em ${examCount} provas`;
}
