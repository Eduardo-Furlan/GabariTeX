import { SHEET } from './sheetLayout';

export const MAX_QUESTIONS = SHEET.MAX_QUESTIONS; // 40
export const remainingQuestions = (n: number): number => Math.max(0, MAX_QUESTIONS - n);
export const isWithinLimit = (n: number): boolean => n <= MAX_QUESTIONS;

export class ExamTooLargeError extends Error {
  count: number;
  max: number;

  constructor(count: number, max: number = MAX_QUESTIONS) {
    super(`A prova possui ${count} questões, mas o limite máximo permitido é de ${max} questões.`);
    this.name = 'ExamTooLargeError';
    this.count = count;
    this.max = max;
  }
}

export function validateExamQuestionCount(count: number): void {
  if (!isWithinLimit(count)) {
    throw new ExamTooLargeError(count, MAX_QUESTIONS);
  }
}

