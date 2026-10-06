import { Exam, ExamVersion, Question } from '../types/exam';
import { encryptAnswerKey } from './crypto';

// PRNG determinístico Mulberry32
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleArray<T>(array: T[], prng: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const OPTION_LABELS: ('A' | 'B' | 'C' | 'D' | 'E')[] = ['A', 'B', 'C', 'D', 'E'];

export async function generateExamVersions(exam: Exam): Promise<ExamVersion[]> {
  const versions: ExamVersion[] = [];
  const versionLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  for (let v = 0; v < exam.versionCount; v++) {
    const versionLetter = versionLetters[v] || `V${v + 1}`;
    const seed = (v + 1) * 123456789 + exam.questions.length;
    const prng = mulberry32(seed);

    let processedQuestions: Question[] = exam.questions.map((q) => ({
      ...q,
      options: q.options ? q.options.map((opt) => ({ ...opt })) : undefined,
    }));

    if (exam.shuffleQuestions) {
      processedQuestions = shuffleArray(processedQuestions, prng);
    }

    const answerKey: Record<number, string> = {};
    const pointsMap: Record<number, number> = {};

    processedQuestions = processedQuestions.map((q, idx) => {
      const qNum = idx + 1;
      if (q.type === 'objective' && q.options && q.options.length > 0) {
        let options = [...q.options];
        if (exam.shuffleOptions) {
          options = shuffleArray(options, prng);
        }

        // Reatribui os labels 'A', 'B', 'C', ...
        options = options.map((opt, optIdx) => ({
          ...opt,
          label: OPTION_LABELS[optIdx] || ('A' as const),
        }));

        const correctOpt = options.find((opt) => opt.isCorrect);
        if (correctOpt) {
          answerKey[qNum] = correctOpt.label;
          pointsMap[qNum] = q.points;
        }

        return { ...q, options };
      }
      return q;
    });

    const totalQuestions = processedQuestions.length;
    const subjectiveQuestions = processedQuestions
      .map((q, idx) => ({ qNum: idx + 1, type: q.type }))
      .filter((item) => item.type === 'subjective')
      .map((item) => item.qNum);

    const qrPayload = await encryptAnswerKey(
      {
        examId: exam.id,
        version: versionLetter,
        key: answerKey,
        points: pointsMap,
        totalQuestions,
        subjectiveQuestions,
      },
      exam.password || 'senha123'
    );

    versions.push({
      versionLetter,
      seed,
      questions: processedQuestions,
      objectiveAnswerKey: answerKey,
      encryptedQrPayload: qrPayload,
    });
  }

  return versions;
}
