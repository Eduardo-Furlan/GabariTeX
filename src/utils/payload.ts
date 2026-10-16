import { Question } from '../types/exam';
import { DecryptedQrPayload } from '../types/omr';
import { validateExamQuestionCount } from './examLimits';

export interface BuildPayloadParams {
  examId: string;
  versionLetter: string;
  questions: Question[];
  objectiveAnswerKey: Record<number, string>;
}

/**
 * Constrói o payload decodificado do QR Code unificando a montagem dos gabaritos,
 * incluindo mapeamento de pontos de questões objetivas e pontuação máxima das dissertativas.
 */
export function buildPayload(params: BuildPayloadParams): DecryptedQrPayload {
  const { examId, versionLetter, questions, objectiveAnswerKey } = params;
  validateExamQuestionCount(questions.length);
  const pointsMap: Record<number, number> = {};
  const subjectiveQuestions: number[] = [];
  const subjectivePoints: Record<number, number> = {};

  questions.forEach((q, idx) => {
    const qNum = idx + 1;
    if (q.type === 'subjective') {
      subjectiveQuestions.push(qNum);
      if (typeof q.points === 'number' && q.points > 0) {
        subjectivePoints[qNum] = q.points;
      }
    } else {
      pointsMap[qNum] = q.points;
    }
  });

  const hasSubjPoints = Object.keys(subjectivePoints).length > 0;

  return {
    examId,
    version: versionLetter,
    key: objectiveAnswerKey,
    points: pointsMap,
    totalQuestions: questions.length,
    subjectiveQuestions,
    subjectivePoints: hasSubjPoints ? subjectivePoints : undefined,
  };
}

