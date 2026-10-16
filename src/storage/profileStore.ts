import { Exam, Classroom, GradingRecord } from '../types/exam';
import { ProfileSettings, ExamMeta } from '../types/profile';
import { SaveResult } from '../utils/storage';

export interface ProfileStore {
  listExams(): Promise<ExamMeta[]>;
  getExam(id: string): Promise<Exam | undefined>;
  putExam(exam: Exam): Promise<SaveResult>;
  deleteExam(id: string): Promise<void>;
  getRecords(): Promise<GradingRecord[]>;
  putRecords(records: GradingRecord[]): Promise<SaveResult>;
  getClasses(): Promise<Classroom[]>;
  putClasses(classes: Classroom[]): Promise<SaveResult>;
  getSettings(): Promise<ProfileSettings>;
  putSettings(s: ProfileSettings): Promise<void>;
}

