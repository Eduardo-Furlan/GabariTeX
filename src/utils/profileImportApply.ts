import { ProfileStore } from '../storage/profileStore';
import { ProfileData, ProfileSettings } from '../types/profile';

export interface ImportCounts {
  exams: number;
  classes: number;
  records: number;
  bank?: {
    questions: number;
    groups: number;
    tags: number;
    blueprints: number;
  };
}

export type ApplyProfileImportResult =
  | { ok: true; counts: ImportCounts }
  | { ok: false; step: string; reason?: string; error?: unknown };

/**
 * Executes persistence writes for profile import in either 'merge' or 'replace' mode.
 * Checks the SaveResult of every storage operation and immediately halts on failure,
 * reporting which step failed and the underlying reason.
 */
export async function applyProfileImport(
  store: ProfileStore,
  data: ProfileData,
  settings: ProfileSettings,
  mode: 'merge' | 'replace' = 'merge'
): Promise<ApplyProfileImportResult> {
  const counts: ImportCounts = {
    exams: data.exams?.length ?? 0,
    classes: data.classes?.length ?? 0,
    records: data.records?.length ?? 0,
    bank: data.bank
      ? {
          questions: data.bank.questions?.length ?? 0,
          groups: data.bank.groups?.length ?? 0,
          tags: data.bank.tags?.length ?? 0,
          blueprints: data.bank.blueprints?.length ?? 0,
        }
      : undefined,
  };

  let currentStep = mode === 'replace' ? 'replaceProfile' : 'init';

  try {
    if (mode === 'replace') {
      const res = await store.replaceProfile(data, settings);
      if (!res.ok) {
        return {
          ok: false,
          step: 'replaceProfile',
          reason: res.reason,
          error: res.error,
        };
      }
      return { ok: true, counts };
    }

    // mode === 'merge'
    currentStep = 'putExam';
    for (const ex of data.exams) {
      const res = await store.putExam(ex);
      if (!res.ok) {
        return {
          ok: false,
          step: 'putExam',
          reason: res.reason,
          error: res.error,
        };
      }
    }

    currentStep = 'putClasses';
    const classesRes = await store.putClasses(data.classes);
    if (!classesRes.ok) {
      return {
        ok: false,
        step: 'putClasses',
        reason: classesRes.reason,
        error: classesRes.error,
      };
    }

    currentStep = 'putRecords';
    const recordsRes = await store.putRecords(data.records);
    if (!recordsRes.ok) {
      return {
        ok: false,
        step: 'putRecords',
        reason: recordsRes.reason,
        error: recordsRes.error,
      };
    }

    if (data.bank) {
      currentStep = 'replaceBank';
      const bankRes = await store.replaceBank(data.bank);
      if (!bankRes.ok) {
        return {
          ok: false,
          step: 'replaceBank',
          reason: bankRes.reason,
          error: bankRes.error,
        };
      }
    }

    if (settings) {
      currentStep = 'putSettings';
      await store.putSettings(settings);
    }

    return { ok: true, counts };
  } catch (err: unknown) {
    return {
      ok: false,
      step: currentStep,
      reason: 'unknown',
      error: err,
    };
  }
}
