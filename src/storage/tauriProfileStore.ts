import { Exam, Classroom, GradingRecord } from '../types/exam';
import { ProfileSettings, ExamMeta, ProfileData } from '../types/profile';
import { BankMeta, BankQuestion, BankData } from '../types/bank';
import { SaveResult } from '../utils/storage';
import { ProfileStore } from './profileStore';

async function mapConcurrent<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const workerCount = Math.min(limit, items.length);
  if (workerCount <= 0) return [];
  const workers = Array.from({ length: workerCount }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export class TauriProfileStore implements ProfileStore {
  private async getInvoke() {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke;
  }

  async listExams(): Promise<ExamMeta[]> {
    try {
      const invoke = await this.getInvoke();
      const examKeys = await invoke<string[]>('store_list', { prefix: 'exams/' });
      const recordKeys = await invoke<string[]>('store_list', { prefix: 'records/' });

      const recordCountsByExam: Record<string, number> = {};
      for (const rk of recordKeys) {
        const examId = rk.replace(/^records\//, '');
        try {
          const resp = await invoke<ArrayBuffer>('store_get', { key: rk, source: 'main' });
          const text = new TextDecoder().decode(new Uint8Array(resp));
          const recs: GradingRecord[] = JSON.parse(text);
          recordCountsByExam[examId] = recs.length;
        } catch {
          recordCountsByExam[examId] = 0;
        }
      }

      const list: ExamMeta[] = [];
      for (const ek of examKeys) {
        const examId = ek.replace(/^exams\//, '');
        try {
          let resp: ArrayBuffer;
          try {
            resp = await invoke<ArrayBuffer>('store_get', { key: ek, source: 'main' });
          } catch {
            resp = await invoke<ArrayBuffer>('store_get', { key: ek, source: 'bak' });
          }
          const text = new TextDecoder().decode(new Uint8Array(resp));
          const exam: Exam = JSON.parse(text);
          list.push({
            id: exam.id || examId,
            name: exam.header.examTitle || 'Sem título',
            updatedAt: exam.updatedAt || new Date().toISOString(),
            questionCount: exam.questions ? exam.questions.length : 0,
            recordCount: recordCountsByExam[exam.id || examId] || 0,
          });
        } catch {
          // ignore corrupted or unreadable exam
        }
      }

      list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return list;
    } catch {
      return [];
    }
  }

  async getExam(id: string): Promise<Exam | undefined> {
    try {
      const invoke = await this.getInvoke();
      let resp: ArrayBuffer;
      try {
        resp = await invoke<ArrayBuffer>('store_get', { key: `exams/${id}`, source: 'main' });
      } catch {
        resp = await invoke<ArrayBuffer>('store_get', { key: `exams/${id}`, source: 'bak' });
      }
      const text = new TextDecoder().decode(new Uint8Array(resp));
      return JSON.parse(text) as Exam;
    } catch {
      return undefined;
    }
  }

  async putExam(exam: Exam): Promise<SaveResult> {
    try {
      const invoke = await this.getInvoke();
      const cloned = JSON.parse(JSON.stringify(exam));
      if (!cloned.updatedAt) {
        cloned.updatedAt = new Date().toISOString();
      }
      const bytes = new TextEncoder().encode(JSON.stringify(cloned));
      await invoke('store_put', bytes, {
        headers: {
          'x-store-key': `exams/${cloned.id}`,
        },
      });
      return { ok: true };
    } catch (err: unknown) {
      const msg = String(err);
      const isQuota = msg.includes('disk_full') || msg.includes('space');
      return {
        ok: false,
        error: err,
        reason: isQuota ? 'disk_full' : 'unknown',
      };
    }
  }

  async deleteExam(id: string): Promise<void> {
    try {
      const invoke = await this.getInvoke();
      await invoke('store_delete', { key: `exams/${id}` });
      await invoke('store_delete', { key: `records/${id}` });
    } catch {
      // Ignora erro ao deletar
    }
  }

  async getRecords(): Promise<GradingRecord[]> {
    try {
      const invoke = await this.getInvoke();
      const recordKeys = await invoke<string[]>('store_list', { prefix: 'records/' });
      const allRecords: GradingRecord[] = [];
      for (const rk of recordKeys) {
        try {
          const resp = await invoke<ArrayBuffer>('store_get', { key: rk, source: 'main' });
          const text = new TextDecoder().decode(new Uint8Array(resp));
          const recs = JSON.parse(text);
          if (Array.isArray(recs)) {
            for (const item of recs) {
              if (item && typeof item === 'object' && item.id) {
                allRecords.push(item as GradingRecord);
              }
            }
          }
        } catch {
          // ignore corrupted key
        }
      }
      return allRecords;
    } catch {
      return [];
    }
  }

  async putRecords(records: GradingRecord[]): Promise<SaveResult> {
    try {
      const invoke = await this.getInvoke();
      // Agrupa registros por examId para armazenamento isolado
      const grouped: Record<string, GradingRecord[]> = {};
      for (const r of records) {
        if (!r || typeof r !== 'object' || !r.id) continue;
        const eId = r.examId || 'sem_prova';
        if (!grouped[eId]) grouped[eId] = [];
        grouped[eId].push(r);
      }

      const existingRecordKeys = await invoke<string[]>('store_list', { prefix: 'records/' });
      const currentKeys = new Set(Object.keys(grouped).map((id) => `records/${id}`));

      // Remove orphaned or cleared record keys
      for (const rk of existingRecordKeys) {
        if (!currentKeys.has(rk)) {
          try {
            await invoke('store_delete', { key: rk });
          } catch {
            // ignore
          }
        }
      }

      for (const [examId, recs] of Object.entries(grouped)) {
        const bytes = new TextEncoder().encode(JSON.stringify(recs));
        await invoke('store_put', bytes, {
          headers: {
            'x-store-key': `records/${examId}`,
          },
        });
      }
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: err, reason: 'unknown' };
    }
  }

  async getClasses(): Promise<Classroom[]> {
    try {
      const invoke = await this.getInvoke();
      const resp = await invoke<ArrayBuffer>('store_get', { key: 'classes', source: 'main' });
      const text = new TextDecoder().decode(new Uint8Array(resp));
      const raw = JSON.parse(text) as Classroom[];
      return (raw || []).map((c) => ({
        ...c,
        students: Array.isArray(c.students) ? c.students : [],
      }));
    } catch {
      return [];
    }
  }

  async putClasses(classes: Classroom[]): Promise<SaveResult> {
    try {
      const invoke = await this.getInvoke();
      const bytes = new TextEncoder().encode(JSON.stringify(classes));
      await invoke('store_put', bytes, {
        headers: {
          'x-store-key': 'classes',
        },
      });
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: err, reason: 'unknown' };
    }
  }

  async getSettings(): Promise<ProfileSettings> {
    try {
      const invoke = await this.getInvoke();
      const resp = await invoke<ArrayBuffer>('store_get', { key: 'settings', source: 'main' });
      const text = new TextDecoder().decode(new Uint8Array(resp));
      return JSON.parse(text) as ProfileSettings;
    } catch {
      return {};
    }
  }

  async putSettings(s: ProfileSettings): Promise<void> {
    try {
      const invoke = await this.getInvoke();
      const bytes = new TextEncoder().encode(JSON.stringify(s));
      await invoke('store_put', bytes, {
        headers: {
          'x-store-key': 'settings',
        },
      });
    } catch {
      // Ignora erro ao salvar configurações
    }
  }

  async replaceProfile(data: ProfileData, settings?: ProfileSettings): Promise<SaveResult> {
    try {
      const invoke = await this.getInvoke();

      // 1. Remove todas as provas existentes
      const examKeys = await invoke<string[]>('store_list', { prefix: 'exams/' });
      for (const ek of examKeys) {
        try {
          await invoke('store_delete', { key: ek });
        } catch {
          // ignore
        }
      }

      // 2. Remove todas as notas existentes
      const recordKeys = await invoke<string[]>('store_list', { prefix: 'records/' });
      for (const rk of recordKeys) {
        try {
          await invoke('store_delete', { key: rk });
        } catch {
          // ignore
        }
      }

      // 3. Remove turmas e configurações
      try {
        await invoke('store_delete', { key: 'classes' });
      } catch {
        // ignore
      }
      try {
        await invoke('store_delete', { key: 'settings' });
      } catch {
        // ignore
      }

      // 4. Salva novas provas
      for (const ex of data.exams) {
        const res = await this.putExam(ex);
        if (!res.ok) return res;
      }

      // 5. Salva novas turmas
      const classRes = await this.putClasses(data.classes);
      if (!classRes.ok) return classRes;

      // 6. Salva novos registros
      const recRes = await this.putRecords(data.records);
      if (!recRes.ok) return recRes;

      // 7. Salva configurações se presentes
      if (settings) {
        await this.putSettings(settings);
      }

      // 8. Se data.bank foi fornecido, substitui o banco atômico
      if (data.bank !== undefined) {
        const bankRes = await this.replaceBank(data.bank);
        if (!bankRes.ok) return bankRes;
      }

      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: err, reason: 'unknown' };
    }
  }

  async getBankMeta(): Promise<BankMeta> {
    try {
      const invoke = await this.getInvoke();
      let resp: ArrayBuffer;
      try {
        resp = await invoke<ArrayBuffer>('store_get', { key: 'bank-meta', source: 'main' });
      } catch {
        resp = await invoke<ArrayBuffer>('store_get', { key: 'bank-meta', source: 'bak' });
      }
      const text = new TextDecoder().decode(new Uint8Array(resp));
      return JSON.parse(text) as BankMeta;
    } catch {
      return { schema: 1, groups: [], tags: [], blueprints: [] };
    }
  }

  async putBankMeta(meta: BankMeta): Promise<SaveResult> {
    try {
      const invoke = await this.getInvoke();
      const bytes = new TextEncoder().encode(JSON.stringify(meta));
      await invoke('store_put', bytes, {
        headers: {
          'x-store-key': 'bank-meta',
        },
      });
      return { ok: true };
    } catch (err: unknown) {
      const msg = String(err);
      const isQuota = msg.includes('disk_full') || msg.includes('space');
      return { ok: false, error: err, reason: isQuota ? 'disk_full' : 'unknown' };
    }
  }

  async listBankQuestions(): Promise<BankQuestion[]> {
    try {
      const invoke = await this.getInvoke();
      const keys = await invoke<string[]>('store_list', { prefix: 'bank/' });

      const questions = await mapConcurrent(keys, 16, async (key) => {
        try {
          let resp: ArrayBuffer;
          try {
            resp = await invoke<ArrayBuffer>('store_get', { key, source: 'main' });
          } catch {
            resp = await invoke<ArrayBuffer>('store_get', { key, source: 'bak' });
          }
          const text = new TextDecoder().decode(new Uint8Array(resp));
          return JSON.parse(text) as BankQuestion;
        } catch {
          return null;
        }
      });

      return questions.filter((q): q is BankQuestion => q !== null);
    } catch {
      return [];
    }
  }

  async putBankQuestions(qs: BankQuestion[]): Promise<SaveResult> {
    try {
      const invoke = await this.getInvoke();
      for (const q of qs) {
        const bytes = new TextEncoder().encode(JSON.stringify(q));
        await invoke('store_put', bytes, {
          headers: {
            'x-store-key': `bank/${q.id}`,
          },
        });
      }
      return { ok: true };
    } catch (err: unknown) {
      const msg = String(err);
      const isQuota = msg.includes('disk_full') || msg.includes('space');
      return { ok: false, error: err, reason: isQuota ? 'disk_full' : 'unknown' };
    }
  }

  async deleteBankQuestions(ids: string[]): Promise<void> {
    try {
      const invoke = await this.getInvoke();
      for (const id of ids) {
        try {
          await invoke('store_delete', { key: `bank/${id}` });
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  async replaceBank(bank: BankData): Promise<SaveResult> {
    try {
      const invoke = await this.getInvoke();

      // Delete existing bank questions
      const existingKeys = await invoke<string[]>('store_list', { prefix: 'bank/' });
      for (const k of existingKeys) {
        try {
          await invoke('store_delete', { key: k });
        } catch {
          // ignore
        }
      }

      // Save bank meta
      const metaToSave: BankMeta = {
        schema: 1,
        groups: bank.groups || [],
        tags: bank.tags || [],
        blueprints: bank.blueprints || [],
      };
      const metaRes = await this.putBankMeta(metaToSave);
      if (!metaRes.ok) return metaRes;

      // Save questions
      if (bank.questions && bank.questions.length > 0) {
        const qRes = await this.putBankQuestions(bank.questions);
        if (!qRes.ok) return qRes;
      }

      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: err, reason: 'unknown' };
    }
  }
}
