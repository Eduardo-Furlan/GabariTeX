import { Exam, GradingRecord, GradedAnswer, SubjectiveAnswer } from '../types/exam';
import { computeExamFingerprint } from './fingerprint';
import { buildVersionLayouts } from './randomizer';
import { recomputeTotals } from './grading';

export interface RegradeReport {
  updated: number;
  unchanged: number;
  skipped: {
    noFingerprint: number;
    structureChanged: number;
    unknownVersion: number;
  };
  changes: Array<{
    recordId: string;
    studentName?: string;
    before: number;
    after: number;
  }>;
}

export interface RegradeResult {
  records: GradingRecord[];
  report: RegradeReport;
}

/**
 * Recalcula as notas de uma lista de registros com base na versão atual da prova.
 *
 * Aplica:
 * 1. Correções no gabarito oficial de cada versão
 * 2. Anulações de questão (give_points: pontos cheios para todos; discard: questão desconsiderada)
 * 3. Atualizações na pontuação máxima de questões objetivas e dissertativas
 * 4. Preservação de marcações de fotos e intervenções manuais (manualOverride)
 *
 * Registros sem fingerprint ou com estrutura modificada são preservados inalterados e contabilizados em skipped.
 */
export function regradeRecords(records: GradingRecord[], exam: Exam): RegradeResult {
  const currentFingerprint = computeExamFingerprint(exam);
  const layouts = buildVersionLayouts(exam);
  const layoutsByVersion = new Map(layouts.map((l) => [l.versionLetter, l]));
  const questionsById = new Map(exam.questions.map((q) => [q.id, q]));

  const report: RegradeReport = {
    updated: 0,
    unchanged: 0,
    skipped: {
      noFingerprint: 0,
      structureChanged: 0,
      unknownVersion: 0,
    },
    changes: [],
  };

  const newRecords: GradingRecord[] = [];

  for (const record of records) {
    if (!record.examFingerprint) {
      report.skipped.noFingerprint++;
      newRecords.push(record);
      continue;
    }

    if (record.examFingerprint !== currentFingerprint) {
      report.skipped.structureChanged++;
      newRecords.push(record);
      continue;
    }

    const layout = layoutsByVersion.get(record.versionLetter);
    if (!layout) {
      report.skipped.unknownVersion++;
      newRecords.push(record);
      continue;
    }

    // 1. Recalcular respostas objetivas
    const updatedAnswers: GradedAnswer[] = record.answers.map((ans) => {
      const layoutQ = layout.questions[ans.questionNumber - 1];
      if (!layoutQ) return ans;

      const originalQ = questionsById.get(layoutQ.id);
      if (!originalQ) return ans;

      const currentMaxPoints = originalQ.points;
      const currentCorrectOption = layout.objectiveAnswerKey[ans.questionNumber] || '';

      if (originalQ.annulled === 'give_points') {
        return {
          ...ans,
          maxPoints: currentMaxPoints,
          pointsEarned: currentMaxPoints,
          correctOption: currentCorrectOption,
          isCorrect: true,
          annulled: true,
        };
      }

      if (originalQ.annulled === 'discard') {
        return {
          ...ans,
          maxPoints: 0,
          pointsEarned: 0,
          correctOption: currentCorrectOption,
          isCorrect: false,
          annulled: true,
        };
      }

      // Questão válida normal: reavaliar com a opção marcada
      const marked = ans.markedOption;
      if (marked === null) {
        return {
          ...ans,
          maxPoints: currentMaxPoints,
          pointsEarned: 0,
          correctOption: currentCorrectOption,
          isCorrect: false,
          status: ans.status === 'multiple' ? 'multiple' : 'blank',
          annulled: false,
        };
      }

      const isCorrect = marked === currentCorrectOption;
      const pointsEarned = isCorrect ? currentMaxPoints : 0;
      const status: GradedAnswer['status'] = isCorrect ? 'correct' : 'wrong';

      return {
        ...ans,
        maxPoints: currentMaxPoints,
        pointsEarned,
        correctOption: currentCorrectOption,
        isCorrect,
        status,
        annulled: false,
      };
    });

    // 2. Recalcular dissertativas (se houver)
    let updatedSubjective: SubjectiveAnswer[] | undefined = undefined;
    if (record.subjectiveAnswers && record.subjectiveAnswers.length > 0) {
      updatedSubjective = record.subjectiveAnswers.map((subj) => {
        const layoutQ = layout.questions[subj.questionNumber - 1];
        const originalQ = layoutQ ? questionsById.get(layoutQ.id) : undefined;
        if (!originalQ) return subj;

        const newMax = originalQ.points;

        if (originalQ.annulled === 'give_points') {
          return {
            ...subj,
            maxPoints: newMax,
            pointsEarned: newMax,
          };
        }

        if (originalQ.annulled === 'discard') {
          return {
            ...subj,
            maxPoints: 0,
            pointsEarned: 0,
          };
        }

        if (subj.pointsEarned !== null) {
          const clamped = Math.min(newMax, Math.max(0, subj.pointsEarned));
          return {
            ...subj,
            maxPoints: newMax,
            pointsEarned: Number(clamped.toFixed(2)),
          };
        }

        return {
          ...subj,
          maxPoints: newMax,
          pointsEarned: null,
        };
      });
    }

    // 3. Totais via recomputeTotals
    const candidateRecord: GradingRecord = {
      ...record,
      answers: updatedAnswers,
      subjectiveAnswers: updatedSubjective,
    };
    const recomputed = recomputeTotals(candidateRecord);

    const scoreChanged =
      recomputed.totalScore !== record.totalScore || recomputed.maxScore !== record.maxScore;

    const answersChanged = updatedAnswers.some((newA, i) => {
      const oldA = record.answers[i];
      if (!oldA) return true;
      return (
        newA.pointsEarned !== oldA.pointsEarned ||
        newA.isCorrect !== oldA.isCorrect ||
        Boolean(newA.annulled) !== Boolean(oldA.annulled) ||
        newA.maxPoints !== oldA.maxPoints ||
        newA.correctOption !== oldA.correctOption ||
        newA.status !== oldA.status
      );
    });

    const subjectiveChanged = (updatedSubjective || []).some((newS, i) => {
      const oldS = (record.subjectiveAnswers || [])[i];
      if (!oldS) return true;
      return newS.pointsEarned !== oldS.pointsEarned || newS.maxPoints !== oldS.maxPoints;
    });

    const hasChanges = scoreChanged || answersChanged || subjectiveChanged;

    if (hasChanges) {
      report.updated++;
      if (scoreChanged) {
        report.changes.push({
          recordId: record.id,
          studentName: record.studentName,
          before: record.totalScore,
          after: recomputed.totalScore,
        });
      }
      newRecords.push(recomputed);
    } else {
      report.unchanged++;
      newRecords.push(record);
    }
  }

  // Ordena mudanças pelas maiores variações absolutas
  report.changes.sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before));

  return {
    records: newRecords,
    report,
  };
}

