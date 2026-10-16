import { Exam, ExamVersion, Question } from '../types/exam';
import { encryptAnswerKey } from './crypto';
import { buildPayload } from './payload';
import { validateExamQuestionCount } from './examLimits';
import { computeExamFingerprint } from './fingerprint';

export { computeExamFingerprint } from './fingerprint';

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

export interface VersionLayout {
  versionLetter: string;
  seed: number;
  questions: Question[]; // já embaralhadas, com id originais e rótulos A..E reatribuídos
  objectiveAnswerKey: Record<number, string>;
}

export interface MappedAnswer {
  originalQuestionId: string;
  originalOptionId?: string;
}

/**
 * Constrói a estrutura e o gabarito de todas as versões do exame de forma
 * puramente síncrona, determinística e sem dependência de criptografia.
 */
export function buildVersionLayouts(exam: Exam): VersionLayout[] {
  validateExamQuestionCount(exam.questions.length);
  const layouts: VersionLayout[] = [];
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
        }

        return { ...q, options };
      }
      return q;
    });

    layouts.push({
      versionLetter,
      seed,
      questions: processedQuestions,
      objectiveAnswerKey: answerKey,
    });
  }

  return layouts;
}

/**
 * Mapeia o número da questão e a opção marcada em uma versão específica
 * para o id da questão original e o id da opção original.
 */
export function mapVersionAnswerToOriginal(
  layout: VersionLayout,
  qNum: number,
  markedOptionLabel?: string | null
): MappedAnswer | null {
  const question = layout.questions[qNum - 1];
  if (!question) return null;

  let originalOptionId: string | undefined;
  if (markedOptionLabel && question.options) {
    const opt = question.options.find((o) => o.label === markedOptionLabel);
    if (opt) {
      originalOptionId = opt.id;
    }
  }

  return {
    originalQuestionId: question.id,
    originalOptionId,
  };
}

/**
 * Gera as versões completas do exame, incluindo os QR codes criptografados com a senha do exame.
 */
export async function generateExamVersions(exam: Exam): Promise<ExamVersion[]> {
  const layouts = buildVersionLayouts(exam);
  const fingerprint = computeExamFingerprint(exam);
  const versions: ExamVersion[] = [];

  for (const layout of layouts) {
    const payload = buildPayload({
      examId: exam.id,
      versionLetter: layout.versionLetter,
      questions: layout.questions,
      objectiveAnswerKey: layout.objectiveAnswerKey,
      examFingerprint: fingerprint,
    });

    const qrPayload = await encryptAnswerKey(payload, exam.password);

    versions.push({
      versionLetter: layout.versionLetter,
      seed: layout.seed,
      questions: layout.questions,
      objectiveAnswerKey: layout.objectiveAnswerKey,
      encryptedQrPayload: qrPayload,
    });
  }

  return versions;
}
