import { Exam, Classroom, GradingRecord } from '../types/exam';
import { ProfileSettings, ExamMeta, ProfileData } from '../types/profile';
import { BankMeta, BankQuestion, BankData } from '../types/bank';
import { SaveResult } from '../utils/storage';
import { ProfileStore } from './profileStore';
import { MemoryProfileStore } from './memoryProfileStore';

const DB_NAME = 'gabaritex_profile_db';
const DB_VERSION = 2;

const STORE_EXAMS = 'exams';
const STORE_RECORDS = 'records';
const STORE_CLASSES = 'classes';
const STORE_SETTINGS = 'settings';
const STORE_BANK_META = 'bank_meta';
const STORE_BANK_QUESTIONS = 'bank_questions';

const SETTINGS_KEY = 'profile_settings';
const BANK_META_KEY = 'meta';

export class IndexedDbProfileStore implements ProfileStore {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private fallbackMemory: MemoryProfileStore | null = null;

  private isSupported(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  private getFallback(): MemoryProfileStore {
    if (!this.fallbackMemory) {
      this.fallbackMemory = new MemoryProfileStore();
    }
    return this.fallbackMemory;
  }

  private async openDb(): Promise<IDBDatabase> {
    if (!this.isSupported()) {
      throw new Error('IndexedDB não suportado');
    }
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_EXAMS)) {
          db.createObjectStore(STORE_EXAMS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_RECORDS)) {
          db.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_CLASSES)) {
          db.createObjectStore(STORE_CLASSES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_BANK_META)) {
          db.createObjectStore(STORE_BANK_META, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_BANK_QUESTIONS)) {
          db.createObjectStore(STORE_BANK_QUESTIONS, { keyPath: 'id' });
        }
      };

      request.onblocked = () => {
        console.warn('[IndexedDB] Abertura do banco bloqueada por outra conexão aberta.');
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          this.dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        reject(request.error || new Error('Erro ao abrir IndexedDB'));
      };
    });

    return this.dbPromise;
  }

  async listExams(): Promise<ExamMeta[]> {
    if (!this.isSupported()) {
      return this.getFallback().listExams();
    }
    try {
      const db = await this.openDb();
      const [exams, records] = await Promise.all([
        new Promise<Exam[]>((resolve, reject) => {
          const tx = db.transaction(STORE_EXAMS, 'readonly');
          const store = tx.objectStore(STORE_EXAMS);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        }),
        new Promise<GradingRecord[]>((resolve, reject) => {
          const tx = db.transaction(STORE_RECORDS, 'readonly');
          const store = tx.objectStore(STORE_RECORDS);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        }),
      ]);

      const countsByExam: Record<string, number> = {};
      for (const r of records) {
        if (r.examId) {
          countsByExam[r.examId] = (countsByExam[r.examId] || 0) + 1;
        }
      }

      const list: ExamMeta[] = exams.map((exam) => ({
        id: exam.id,
        name: exam.header.examTitle || 'Sem título',
        updatedAt: exam.updatedAt || new Date().toISOString(),
        questionCount: exam.questions ? exam.questions.length : 0,
        recordCount: countsByExam[exam.id] || 0,
      }));

      list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return list;
    } catch {
      return this.getFallback().listExams();
    }
  }

  async getExam(id: string): Promise<Exam | undefined> {
    if (!this.isSupported()) {
      return this.getFallback().getExam(id);
    }
    try {
      const db = await this.openDb();
      return new Promise<Exam | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_EXAMS, 'readonly');
        const store = tx.objectStore(STORE_EXAMS);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || undefined);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return this.getFallback().getExam(id);
    }
  }

  async putExam(exam: Exam): Promise<SaveResult> {
    if (!this.isSupported()) {
      return this.getFallback().putExam(exam);
    }
    try {
      const db = await this.openDb();
      const cloned = JSON.parse(JSON.stringify(exam));
      if (!cloned.updatedAt) {
        cloned.updatedAt = new Date().toISOString();
      }

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_EXAMS, 'readwrite');
        const store = tx.objectStore(STORE_EXAMS);
        const req = store.put(cloned);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      return { ok: true };
    } catch (err: unknown) {
      const errorObj = err as { name?: string };
      const isQuota = errorObj && errorObj.name === 'QuotaExceededError';
      return {
        ok: false,
        error: err,
        reason: isQuota ? 'quota' : 'unknown',
      };
    }
  }

  async deleteExam(id: string): Promise<void> {
    if (!this.isSupported()) {
      return this.getFallback().deleteExam(id);
    }
    try {
      const db = await this.openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_EXAMS, STORE_RECORDS], 'readwrite');
        const examStore = tx.objectStore(STORE_EXAMS);
        const recordStore = tx.objectStore(STORE_RECORDS);

        examStore.delete(id);

        const recReq = recordStore.getAll();
        recReq.onsuccess = () => {
          const recs: GradingRecord[] = recReq.result || [];
          for (const r of recs) {
            if (r.examId === id) {
              recordStore.delete(r.id);
            }
          }
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      return this.getFallback().deleteExam(id);
    }
  }

  async getRecords(): Promise<GradingRecord[]> {
    if (!this.isSupported()) {
      return this.getFallback().getRecords();
    }
    try {
      const db = await this.openDb();
      return new Promise<GradingRecord[]>((resolve, reject) => {
        const tx = db.transaction(STORE_RECORDS, 'readonly');
        const store = tx.objectStore(STORE_RECORDS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return this.getFallback().getRecords();
    }
  }

  async putRecords(records: GradingRecord[]): Promise<SaveResult> {
    if (!this.isSupported()) {
      return this.getFallback().putRecords(records);
    }
    try {
      const db = await this.openDb();
      const cloned = JSON.parse(JSON.stringify(records));
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_RECORDS, 'readwrite');
        const store = tx.objectStore(STORE_RECORDS);
        store.clear();
        for (const r of cloned) {
          store.put(r);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return { ok: true };
    } catch (err: unknown) {
      const errorObj = err as { name?: string };
      const isQuota = errorObj && errorObj.name === 'QuotaExceededError';
      return {
        ok: false,
        error: err,
        reason: isQuota ? 'quota' : 'unknown',
      };
    }
  }

  async getClasses(): Promise<Classroom[]> {
    if (!this.isSupported()) {
      return this.getFallback().getClasses();
    }
    try {
      const db = await this.openDb();
      return new Promise<Classroom[]>((resolve, reject) => {
        const tx = db.transaction(STORE_CLASSES, 'readonly');
        const store = tx.objectStore(STORE_CLASSES);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return this.getFallback().getClasses();
    }
  }

  async putClasses(classes: Classroom[]): Promise<SaveResult> {
    if (!this.isSupported()) {
      return this.getFallback().putClasses(classes);
    }
    try {
      const db = await this.openDb();
      const cloned = JSON.parse(JSON.stringify(classes));
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_CLASSES, 'readwrite');
        const store = tx.objectStore(STORE_CLASSES);
        store.clear();
        for (const c of cloned) {
          store.put(c);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return { ok: true };
    } catch (err: unknown) {
      const errorObj = err as { name?: string };
      const isQuota = errorObj && errorObj.name === 'QuotaExceededError';
      return {
        ok: false,
        error: err,
        reason: isQuota ? 'quota' : 'unknown',
      };
    }
  }

  async getSettings(): Promise<ProfileSettings> {
    if (!this.isSupported()) {
      return this.getFallback().getSettings();
    }
    try {
      const db = await this.openDb();
      return new Promise<ProfileSettings>((resolve, reject) => {
        const tx = db.transaction(STORE_SETTINGS, 'readonly');
        const store = tx.objectStore(STORE_SETTINGS);
        const req = store.get(SETTINGS_KEY);
        req.onsuccess = () => {
          resolve(req.result ? req.result.settings : {});
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return this.getFallback().getSettings();
    }
  }

  async putSettings(s: ProfileSettings): Promise<void> {
    if (!this.isSupported()) {
      return this.getFallback().putSettings(s);
    }
    try {
      const db = await this.openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_SETTINGS, 'readwrite');
        const store = tx.objectStore(STORE_SETTINGS);
        const req = store.put({ key: SETTINGS_KEY, settings: s });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      return this.getFallback().putSettings(s);
    }
  }

  async replaceProfile(data: ProfileData, settings?: ProfileSettings): Promise<SaveResult> {
    if (!this.isSupported()) {
      return this.getFallback().replaceProfile(data, settings);
    }
    try {
      const db = await this.openDb();
      const stores = [STORE_EXAMS, STORE_RECORDS, STORE_CLASSES, STORE_SETTINGS];
      if (data.bank !== undefined) {
        stores.push(STORE_BANK_META, STORE_BANK_QUESTIONS);
      }

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(stores, 'readwrite');
        const storeExams = tx.objectStore(STORE_EXAMS);
        const storeRecords = tx.objectStore(STORE_RECORDS);
        const storeClasses = tx.objectStore(STORE_CLASSES);
        const storeSettings = tx.objectStore(STORE_SETTINGS);

        storeExams.clear();
        for (const e of data.exams) {
          storeExams.put(e);
        }

        storeRecords.clear();
        for (const r of data.records) {
          storeRecords.put(r);
        }

        storeClasses.clear();
        for (const c of data.classes) {
          storeClasses.put(c);
        }

        storeSettings.clear();
        if (settings) {
          storeSettings.put({ key: SETTINGS_KEY, settings });
        }

        if (data.bank !== undefined) {
          const storeMeta = tx.objectStore(STORE_BANK_META);
          const storeQs = tx.objectStore(STORE_BANK_QUESTIONS);
          storeMeta.put({
            key: BANK_META_KEY,
            meta: {
              schema: 1,
              groups: data.bank.groups || [],
              tags: data.bank.tags || [],
              blueprints: data.bank.blueprints || [],
            },
          });
          storeQs.clear();
          for (const q of data.bank.questions || []) {
            storeQs.put(q);
          }
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return { ok: true };
    } catch (err: unknown) {
      const errorObj = err as { name?: string };
      const isQuota = errorObj && errorObj.name === 'QuotaExceededError';
      return {
        ok: false,
        error: err,
        reason: isQuota ? 'quota' : 'unknown',
      };
    }
  }

  async getBankMeta(): Promise<BankMeta> {
    if (!this.isSupported()) {
      return this.getFallback().getBankMeta();
    }
    try {
      const db = await this.openDb();
      return new Promise<BankMeta>((resolve, reject) => {
        const tx = db.transaction(STORE_BANK_META, 'readonly');
        const store = tx.objectStore(STORE_BANK_META);
        const req = store.get(BANK_META_KEY);
        req.onsuccess = () => {
          if (req.result && req.result.meta) {
            resolve(req.result.meta);
          } else {
            resolve({ schema: 1, groups: [], tags: [], blueprints: [] });
          }
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return this.getFallback().getBankMeta();
    }
  }

  async putBankMeta(meta: BankMeta): Promise<SaveResult> {
    if (!this.isSupported()) {
      return this.getFallback().putBankMeta(meta);
    }
    try {
      const db = await this.openDb();
      const cloned = JSON.parse(JSON.stringify(meta));
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_BANK_META, 'readwrite');
        const store = tx.objectStore(STORE_BANK_META);
        const req = store.put({ key: BANK_META_KEY, meta: cloned });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      return { ok: true };
    } catch (err: unknown) {
      const errorObj = err as { name?: string };
      const isQuota = errorObj && errorObj.name === 'QuotaExceededError';
      return { ok: false, error: err, reason: isQuota ? 'quota' : 'unknown' };
    }
  }

  async listBankQuestions(): Promise<BankQuestion[]> {
    if (!this.isSupported()) {
      return this.getFallback().listBankQuestions();
    }
    try {
      const db = await this.openDb();
      return new Promise<BankQuestion[]>((resolve, reject) => {
        const tx = db.transaction(STORE_BANK_QUESTIONS, 'readonly');
        const store = tx.objectStore(STORE_BANK_QUESTIONS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return this.getFallback().listBankQuestions();
    }
  }

  async putBankQuestions(qs: BankQuestion[]): Promise<SaveResult> {
    if (!this.isSupported()) {
      return this.getFallback().putBankQuestions(qs);
    }
    try {
      const db = await this.openDb();
      const cloned = JSON.parse(JSON.stringify(qs));
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_BANK_QUESTIONS, 'readwrite');
        const store = tx.objectStore(STORE_BANK_QUESTIONS);
        for (const q of cloned) {
          store.put(q);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return { ok: true };
    } catch (err: unknown) {
      const errorObj = err as { name?: string };
      const isQuota = errorObj && errorObj.name === 'QuotaExceededError';
      return { ok: false, error: err, reason: isQuota ? 'quota' : 'unknown' };
    }
  }

  async deleteBankQuestions(ids: string[]): Promise<void> {
    if (!this.isSupported()) {
      return this.getFallback().deleteBankQuestions(ids);
    }
    try {
      const db = await this.openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_BANK_QUESTIONS, 'readwrite');
        const store = tx.objectStore(STORE_BANK_QUESTIONS);
        for (const id of ids) {
          store.delete(id);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      return this.getFallback().deleteBankQuestions(ids);
    }
  }

  async replaceBank(bank: BankData): Promise<SaveResult> {
    if (!this.isSupported()) {
      return this.getFallback().replaceBank(bank);
    }
    try {
      const db = await this.openDb();
      const metaToSave: BankMeta = {
        schema: 1,
        groups: JSON.parse(JSON.stringify(bank.groups || [])),
        tags: JSON.parse(JSON.stringify(bank.tags || [])),
        blueprints: JSON.parse(JSON.stringify(bank.blueprints || [])),
      };
      const qsToSave = JSON.parse(JSON.stringify(bank.questions || []));

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_BANK_META, STORE_BANK_QUESTIONS], 'readwrite');
        const storeMeta = tx.objectStore(STORE_BANK_META);
        const storeQs = tx.objectStore(STORE_BANK_QUESTIONS);

        storeMeta.put({ key: BANK_META_KEY, meta: metaToSave });
        storeQs.clear();
        for (const q of qsToSave) {
          storeQs.put(q);
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return { ok: true };
    } catch (err: unknown) {
      const errorObj = err as { name?: string };
      const isQuota = errorObj && errorObj.name === 'QuotaExceededError';
      return { ok: false, error: err, reason: isQuota ? 'quota' : 'unknown' };
    }
  }
}
