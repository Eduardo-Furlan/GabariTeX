import { Exam, Classroom, GradingRecord } from '../types/exam';
import { ProfileSettings, ExamMeta, ProfileData } from '../types/profile';
import { BankMeta, BankQuestion, BankData } from '../types/bank';
import { SaveResult } from '../utils/storage';
import { ProfileStore } from './profileStore';

export class MemoryProfileStore implements ProfileStore {
  private exams: Map<string, Exam> = new Map();
  private records: Map<string, GradingRecord> = new Map();
  private classes: Map<string, Classroom> = new Map();
  private settings: ProfileSettings = {};
  private bankMeta: BankMeta = { schema: 1, groups: [], tags: [], blueprints: [] };
  private bankQuestions: Map<string, BankQuestion> = new Map();

  constructor(initialData?: {
    exams?: Exam[];
    records?: GradingRecord[];
    classes?: Classroom[];
    settings?: ProfileSettings;
    bank?: BankData;
  }) {
    if (initialData?.exams) {
      for (const e of initialData.exams) {
        this.exams.set(e.id, { ...e });
      }
    }
    if (initialData?.records) {
      for (const r of initialData.records) {
        this.records.set(r.id, { ...r });
      }
    }
    if (initialData?.classes) {
      for (const c of initialData.classes) {
        this.classes.set(c.id, { ...c });
      }
    }
    if (initialData?.settings) {
      this.settings = { ...initialData.settings };
    }
    if (initialData?.bank) {
      this.bankMeta = {
        schema: 1,
        groups: JSON.parse(JSON.stringify(initialData.bank.groups || [])),
        tags: JSON.parse(JSON.stringify(initialData.bank.tags || [])),
        blueprints: JSON.parse(JSON.stringify(initialData.bank.blueprints || [])),
      };
      if (initialData.bank.questions) {
        for (const q of initialData.bank.questions) {
          this.bankQuestions.set(q.id, JSON.parse(JSON.stringify(q)));
        }
      }
    }
  }

  async listExams(): Promise<ExamMeta[]> {
    const list: ExamMeta[] = [];
    const recordCountsByExam: Record<string, number> = {};
    for (const r of this.records.values()) {
      if (r.examId) {
        recordCountsByExam[r.examId] = (recordCountsByExam[r.examId] || 0) + 1;
      }
    }

    for (const exam of this.exams.values()) {
      list.push({
        id: exam.id,
        name: exam.header.examTitle || 'Sem título',
        updatedAt: exam.updatedAt || new Date().toISOString(),
        questionCount: exam.questions ? exam.questions.length : 0,
        recordCount: recordCountsByExam[exam.id] || 0,
      });
    }

    // Sort by updatedAt descending
    list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return list;
  }

  async getExam(id: string): Promise<Exam | undefined> {
    const exam = this.exams.get(id);
    return exam ? JSON.parse(JSON.stringify(exam)) : undefined;
  }

  async putExam(exam: Exam): Promise<SaveResult> {
    try {
      const cloned = JSON.parse(JSON.stringify(exam));
      if (!cloned.updatedAt) {
        cloned.updatedAt = new Date().toISOString();
      }
      this.exams.set(cloned.id, cloned);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err, reason: 'unknown' };
    }
  }

  async deleteExam(id: string): Promise<void> {
    this.exams.delete(id);
    // Excluir uma prova apaga também as notas dela (Plano 08 §2.2)
    for (const [recId, rec] of this.records.entries()) {
      if (rec.examId === id) {
        this.records.delete(recId);
      }
    }
  }

  async getRecords(): Promise<GradingRecord[]> {
    return Array.from(this.records.values()).map((r) => JSON.parse(JSON.stringify(r)));
  }

  async putRecords(records: GradingRecord[]): Promise<SaveResult> {
    try {
      this.records.clear();
      for (const r of records) {
        this.records.set(r.id, JSON.parse(JSON.stringify(r)));
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err, reason: 'unknown' };
    }
  }

  async getClasses(): Promise<Classroom[]> {
    return Array.from(this.classes.values()).map((c) => JSON.parse(JSON.stringify(c)));
  }

  async putClasses(classes: Classroom[]): Promise<SaveResult> {
    try {
      this.classes.clear();
      for (const c of classes) {
        this.classes.set(c.id, JSON.parse(JSON.stringify(c)));
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err, reason: 'unknown' };
    }
  }

  async getSettings(): Promise<ProfileSettings> {
    return { ...this.settings };
  }

  async putSettings(s: ProfileSettings): Promise<void> {
    this.settings = { ...s };
  }

  async replaceProfile(data: ProfileData, settings?: ProfileSettings): Promise<SaveResult> {
    try {
      this.exams.clear();
      for (const e of data.exams) {
        this.exams.set(e.id, JSON.parse(JSON.stringify(e)));
      }
      this.records.clear();
      for (const r of data.records) {
        this.records.set(r.id, JSON.parse(JSON.stringify(r)));
      }
      this.classes.clear();
      for (const c of data.classes) {
        this.classes.set(c.id, JSON.parse(JSON.stringify(c)));
      }
      this.settings = settings ? JSON.parse(JSON.stringify(settings)) : {};

      // Only replace bank if data.bank !== undefined
      if (data.bank !== undefined) {
        await this.replaceBank(data.bank);
      }

      return { ok: true };
    } catch (err) {
      return { ok: false, error: err, reason: 'unknown' };
    }
  }

  async getBankMeta(): Promise<BankMeta> {
    return JSON.parse(JSON.stringify(this.bankMeta));
  }

  async putBankMeta(meta: BankMeta): Promise<SaveResult> {
    try {
      this.bankMeta = JSON.parse(JSON.stringify(meta));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err, reason: 'unknown' };
    }
  }

  async listBankQuestions(): Promise<BankQuestion[]> {
    return Array.from(this.bankQuestions.values()).map((q) => JSON.parse(JSON.stringify(q)));
  }

  async putBankQuestions(qs: BankQuestion[]): Promise<SaveResult> {
    try {
      for (const q of qs) {
        this.bankQuestions.set(q.id, JSON.parse(JSON.stringify(q)));
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err, reason: 'unknown' };
    }
  }

  async deleteBankQuestions(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.bankQuestions.delete(id);
    }
  }

  async replaceBank(bank: BankData): Promise<SaveResult> {
    try {
      this.bankMeta = {
        schema: 1,
        groups: JSON.parse(JSON.stringify(bank.groups || [])),
        tags: JSON.parse(JSON.stringify(bank.tags || [])),
        blueprints: JSON.parse(JSON.stringify(bank.blueprints || [])),
      };
      this.bankQuestions.clear();
      if (bank.questions) {
        for (const q of bank.questions) {
          this.bankQuestions.set(q.id, JSON.parse(JSON.stringify(q)));
        }
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err, reason: 'unknown' };
    }
  }
}
