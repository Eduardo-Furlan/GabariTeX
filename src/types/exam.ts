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

export interface GradedAnswer {
  questionNumber: number;
  markedOption: string | null;
  correctOption: string;
  isCorrect: boolean;
  status: 'correct' | 'wrong' | 'blank' | 'multiple';
  pointsEarned: number;
  maxPoints: number;
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
}
