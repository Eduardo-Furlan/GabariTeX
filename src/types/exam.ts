export type QuestionType = 'objective' | 'subjective';

export interface QuestionOption {
  id: string;
  label: 'A' | 'B' | 'C' | 'D' | 'E';
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  points: number;
  imageUrl?: string;
  imageCaption?: string;
  options?: QuestionOption[];
  linesForAnswer?: number;
  annulled?: 'give_points' | 'discard';
}

export interface ExamHeader {
  institution: string;
  course: string;
  professor: string;
  examTitle: string;
  date: string;
  instructions: string;
}

export interface Exam {
  id: string;
  header: ExamHeader;
  questions: Question[];
  password: string;
  versionCount: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  twoColumns: boolean;
}

export interface ExamVersion {
  versionLetter: string;
  seed: number;
  questions: Question[];
  objectiveAnswerKey: Record<number, string>;
  encryptedQrPayload: string;
}

export type OptionLabel = 'A' | 'B' | 'C' | 'D' | 'E';

export interface GradedAnswer {
  questionNumber: number;
  markedOption: string | null;
  correctOption: string;
  isCorrect: boolean;
  status: 'correct' | 'wrong' | 'blank' | 'multiple';
  pointsEarned: number;
  maxPoints: number;
  detectedOption?: string | null;
  fillRatios?: Record<OptionLabel, number>;
  needsReview?: boolean;
  manualOverride?: boolean;
  annulled?: boolean;
}

export interface SubjectiveAnswer {
  questionNumber: number;
  maxPoints: number;
  pointsEarned: number | null; // null = ainda não corrigida
}

export interface Student {
  id: string; // identificador interno estável
  name: string;
  registration?: string; // matrícula/RA, opcional, sempre como texto (preserva zeros à esquerda)
}

export interface Classroom {
  id: string;
  name: string; // ex.: "2º B — Física 2026"
  students: Student[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface GradingRecord {
  id: string;
  timestamp: number;
  studentName: string;
  studentId: string;
  versionLetter: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  answers: GradedAnswer[];
  subjectiveAnswers?: SubjectiveAnswer[];
  classId?: string; // turma no momento do salvamento
  studentRef?: string; // Student.id quando escolhido na turma; ausente se digitado à mão
  examId?: string;
  examFingerprint?: string;
}
