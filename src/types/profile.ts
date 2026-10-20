import { Exam, Classroom, GradingRecord } from './exam';
import { BankData, BankShareManifest } from './bank';

export interface ProfileData {
  exams: Exam[];
  classes: Classroom[];
  records: GradingRecord[];
  bank?: BankData;
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
  // Policy: schema 1 is supported by every 1.x release, and any future schema bump must ship with a migration step.
  schema: 1;
  exportedAt: string;
  counts: {
    exams: number;
    classes: number;
    records: number;
    assets: number;
    bankQuestions?: number;
    bankGroups?: number;
    bankTags?: number;
    bankBlueprints?: number;
  };
  includes: {
    records: boolean;
    classes: boolean;
    passwords: boolean;
    bank?: boolean;
  };
  files: Record<string, string>;
}

export type AnyGabaritexManifest = ProfileManifest | BankShareManifest;

export interface ProfileExportOptions {
  includeRecords?: boolean;
  includeClasses?: boolean;
  includePasswords?: boolean;
  includeBank?: boolean;
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
  newBankQuestions?: number;
  existingBankQuestions?: number;
  bankGroups?: number;
  bankTags?: number;
  bankBlueprints?: number;
}

