import { Exam, Classroom, GradingRecord } from './exam';

export interface ProfileData {
  exams: Exam[];
  classes: Classroom[];
  records: GradingRecord[];
}

export interface ProfileSettings {
  activeExamId?: string;
  activeClassId?: string;
}

export interface ExamMeta {
  id: string;
  name: string;
  updatedAt: string;
  questionCount: number;
  recordCount: number;
}

export interface ProfileManifest {
  app: 'gabaritex';
  kind: 'profile';
  schema: 1;
  exportedAt: string;
  counts: {
    exams: number;
    classes: number;
    records: number;
    assets: number;
  };
  includes: {
    records: boolean;
    classes: boolean;
    passwords: boolean;
  };
  files: Record<string, string>;
}

export interface ProfileExportOptions {
  includeRecords?: boolean;
  includeClasses?: boolean;
  includePasswords?: boolean;
  examIds?: string[];
  classIds?: string[];
}

export interface ProfileImportSummary {
  examsCount: number;
  classesCount: number;
  recordsCount: number;
  newExams: number;
  existingExams: number;
  newerExams: number;
  newClasses: number;
  newRecords: number;
}

