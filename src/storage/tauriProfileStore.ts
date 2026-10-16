import { Exam, Classroom, GradingRecord } from '../types/exam';
import { ProfileSettings, ExamMeta } from '../types/profile';
import { SaveResult } from '../utils/storage';
import { ProfileStore } from './profileStore';

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
          const recs: GradingRecord[] = JSON.parse(text);
          allRecords.push(...recs);
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
        const eId = r.examId || 'sem_prova';
        if (!grouped[eId]) grouped[eId] = [];
        grouped[eId].push(r);
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
      return JSON.parse(text) as Classroom[];
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
}

