import { GradedAnswer, GradingRecord, OptionLabel } from '../types/exam';
import { OmrRawDetection } from '../types/omr';

export type ManualChoice = OptionLabel | 'BLANK' | 'INVALID';

/**
 * Constrói um GradedAnswer para uma questão objetiva a partir da leitura OMR bruta.
 */
export function buildObjectiveAnswer(args: {
  questionNumber: number;
  correctOption: string;
  maxPoints: number;
  detection?: OmrRawDetection;
}): GradedAnswer {
  const { questionNumber, correctOption, maxPoints, detection } = args;
  const detectedMark = detection?.detectedMark || null;
  const isMultiple = detection?.status === 'multiple';
  const isBlank = !isMultiple && detectedMark === null;
  const isCorrect = !isMultiple && !isBlank && detectedMark === correctOption;

  const status: GradedAnswer['status'] = isMultiple
    ? 'multiple'
    : isBlank
    ? 'blank'
    : isCorrect
    ? 'correct'
    : 'wrong';

  const pointsEarned = isCorrect ? maxPoints : 0;

  // Regra de needsReview:
  // - status === 'multiple'
  // - ou (status === 'marked' e fillRatio da marcada < 0.75)
  // Questões em branco (< 0.30) não são sinalizadas individualmente
  let needsReview = false;
  if (isMultiple) {
    needsReview = true;
  } else if (detection?.status === 'marked' && detectedMark) {
    const ratio = detection.fillRatios[detectedMark] ?? 1.0;
    if (ratio < 0.75) {
      needsReview = true;
    }
  }

  let fillRatios: Record<OptionLabel, number> | undefined;
  if (needsReview && detection?.fillRatios) {
    fillRatios = {
      A: Number(detection.fillRatios.A.toFixed(2)),
      B: Number(detection.fillRatios.B.toFixed(2)),
      C: Number(detection.fillRatios.C.toFixed(2)),
      D: Number(detection.fillRatios.D.toFixed(2)),
      E: Number(detection.fillRatios.E.toFixed(2)),
    };
  }

  return {
    questionNumber,
    markedOption: detectedMark,
    correctOption,
    isCorrect,
    status,
    pointsEarned,
    maxPoints,
    detectedOption: detectedMark,
    fillRatios,
    needsReview,
    manualOverride: false,
  };
}

/**
 * Aplica uma escolha manual do professor sobre a resposta lida.
 */
export function applyManualOverride(a: GradedAnswer, choice: ManualChoice): GradedAnswer {
  const detectedOption = a.detectedOption !== undefined ? a.detectedOption : a.markedOption;

  if (choice === 'BLANK') {
    return {
      ...a,
      detectedOption,
      markedOption: null,
      isCorrect: false,
      status: 'blank',
      pointsEarned: 0,
      manualOverride: true,
      needsReview: false,
    };
  }

  if (choice === 'INVALID') {
    return {
      ...a,
      detectedOption,
      markedOption: null,
      isCorrect: false,
      status: 'multiple',
      pointsEarned: 0,
      manualOverride: true,
      needsReview: false,
    };
  }

  const isCorrect = choice === a.correctOption;
  return {
    ...a,
    detectedOption,
    markedOption: choice,
    isCorrect,
    status: isCorrect ? 'correct' : 'wrong',
    pointsEarned: isCorrect ? a.maxPoints : 0,
    manualOverride: true,
    needsReview: false,
  };
}

/**
 * Reverte a intervenção manual do professor para a leitura detectada pela máquina.
 */
export function revertOverride(a: GradedAnswer): GradedAnswer {
  const orig = a.detectedOption ?? null;

  if (orig !== null) {
    const isCorrect = orig === a.correctOption;
    const ratio = a.fillRatios ? a.fillRatios[orig as OptionLabel] : undefined;
    const needsReview = ratio !== undefined ? ratio < 0.75 : false;

    return {
      ...a,
      markedOption: orig,
      isCorrect,
      status: isCorrect ? 'correct' : 'wrong',
      pointsEarned: isCorrect ? a.maxPoints : 0,
      manualOverride: false,
      needsReview,
    };
  }

  // Se orig era null, checa se era rasura (múltipla) ou em branco
  const isMultiple = a.fillRatios
    ? Object.values(a.fillRatios).filter((r) => r >= 0.3).length >= 2
    : false;

  return {
    ...a,
    markedOption: null,
    isCorrect: false,
    status: isMultiple ? 'multiple' : 'blank',
    pointsEarned: 0,
    manualOverride: false,
    needsReview: isMultiple,
  };
}

/**
 * Recalcula totais (totalScore, maxScore, percentage) de um GradingRecord sem mutar o objeto.
 * Inclui pontuação máxima de todas as dissertativas e soma pontos das dissertativas já lançadas.
 */
export function recomputeTotals(r: GradingRecord): GradingRecord {
  const objectiveScore = r.answers.reduce((acc, a) => acc + a.pointsEarned, 0);
  const objectiveMax = r.answers.reduce((acc, a) => acc + a.maxPoints, 0);

  const subjectiveScore = (r.subjectiveAnswers || []).reduce(
    (acc, s) => acc + (s.pointsEarned ?? 0),
    0
  );
  const subjectiveMax = (r.subjectiveAnswers || []).reduce(
    (acc, s) => acc + s.maxPoints,
    0
  );

  const totalScore = Number((objectiveScore + subjectiveScore).toFixed(2));
  const maxScore = Number((objectiveMax + subjectiveMax).toFixed(2));
  const percentage = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(2)) : 0;

  return {
    ...r,
    totalScore,
    maxScore,
    percentage,
  };
}

/**
 * Atualiza ou lança a nota de uma questão dissertativa, aplicando clamp no intervalo [0, maxPoints]
 * e arredondando para duas casas decimais. Retorna um novo objeto com os totais recalculados.
 */
export function setSubjectiveScore(
  r: GradingRecord,
  questionNumber: number,
  score: number | null
): GradingRecord {
  if (!r.subjectiveAnswers || r.subjectiveAnswers.length === 0) {
    return r;
  }

  const updatedSubjectiveAnswers = r.subjectiveAnswers.map((s) => {
    if (s.questionNumber !== questionNumber) return s;

    let pointsEarned: number | null = null;
    if (score !== null && !isNaN(score)) {
      const clamped = Math.min(s.maxPoints, Math.max(0, score));
      pointsEarned = Number(clamped.toFixed(2));
    }

    return {
      ...s,
      pointsEarned,
    };
  });

  return recomputeTotals({
    ...r,
    subjectiveAnswers: updatedSubjectiveAnswers,
  });
}

/**
 * Atualiza a pontuação máxima de uma questão dissertativa e recalcula os totais da prova.
 */
export function setSubjectiveMaxPoints(
  r: GradingRecord,
  questionNumber: number,
  newMax: number
): GradingRecord {
  if (!r.subjectiveAnswers || r.subjectiveAnswers.length === 0) {
    return r;
  }

  const clampedMax = Math.max(0.1, Number(newMax.toFixed(2)));
  const updatedSubjectiveAnswers = r.subjectiveAnswers.map((s) => {
    if (s.questionNumber !== questionNumber) return s;
    const pointsEarned = s.pointsEarned !== null ? Math.min(clampedMax, s.pointsEarned) : null;
    return {
      ...s,
      maxPoints: clampedMax,
      pointsEarned,
    };
  });

  return recomputeTotals({
    ...r,
    subjectiveAnswers: updatedSubjectiveAnswers,
  });
}

/**
 * Conta quantas questões de um registro precisam de revisão humana.
 */
export function countNeedsReview(r: GradingRecord): number {
  return r.answers.filter((a) => a.needsReview).length;
}

/**
 * Conta quantas questões dissertativas de um registro ainda estão pendentes de nota (null).
 */
export function countPendingSubjective(r: GradingRecord): number {
  if (!r.subjectiveAnswers) return 0;
  return r.subjectiveAnswers.filter((s) => s.pointsEarned === null).length;
}

/**
 * Indica se o registro é parcial (ou seja, possui ao menos uma dissertativa pendente de correção).
 */
export function isPartial(r: GradingRecord): boolean {
  return countPendingSubjective(r) > 0;
}

export interface GradebookAverages {
  averageScore: number;
  averagePercentage: number;
  totalEvaluated: number;
  excludedPartialCount: number;
}

/**
 * Calcula as médias da turma considerando apenas os registros completos (não parciais),
 * e contabiliza quantos registros parciais ficaram fora da média.
 */
export function computeAverages(records: GradingRecord[]): GradebookAverages {
  const completeRecords = records.filter((r) => !isPartial(r));
  const excludedPartialCount = records.length - completeRecords.length;

  if (completeRecords.length === 0) {
    return {
      averageScore: 0,
      averagePercentage: 0,
      totalEvaluated: 0,
      excludedPartialCount,
    };
  }

  const sumScore = completeRecords.reduce((sum, r) => sum + r.totalScore, 0);
  const sumPercentage = completeRecords.reduce((sum, r) => sum + r.percentage, 0);

  return {
    averageScore: Number((sumScore / completeRecords.length).toFixed(2)),
    averagePercentage: Number((sumPercentage / completeRecords.length).toFixed(2)),
    totalEvaluated: completeRecords.length,
    excludedPartialCount,
  };
}

