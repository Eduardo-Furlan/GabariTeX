import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  saveExamToStorage,
  saveGradebookToStorage,
  loadExamFromStorage,
  loadGradebookFromStorage,
  isQuotaExceededError,
  saveLastBackupDate,
  loadLastBackupDate,
  EXAM_STORAGE_KEY,
  GRADEBOOK_STORAGE_KEY,
} from '../src/utils/storage';
import { emptyExam } from '../src/utils/sampleExam';
import { GradingRecord } from '../src/types/exam';

describe('Armazenamento Local Seguro (storage.ts)', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    const localStorageMock = {
      getItem: vi.fn((key: string) => mockStore[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStore[key];
      }),
      clear: vi.fn(() => {
        mockStore = {};
      }),
    };
    vi.stubGlobal('localStorage', localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('deve salvar e carregar exame com retorno { ok: true }', () => {
    const res = saveExamToStorage(emptyExam);
    expect(res).toEqual({ ok: true });
    expect(localStorage.setItem).toHaveBeenCalledWith(EXAM_STORAGE_KEY, JSON.stringify(emptyExam));

    const loaded = loadExamFromStorage();
    expect(loaded).toEqual(emptyExam);
  });

  it('deve salvar e carregar livro de notas com retorno { ok: true }', () => {
    const records: GradingRecord[] = [
      {
        id: 'rec-1',
        timestamp: Date.now(),
        studentName: 'Ana Silva',
        studentId: '12345',
        versionLetter: 'A',
        totalScore: 8.5,
        maxScore: 10,
        percentage: 85,
        answers: [],
      },
    ];

    const res = saveGradebookToStorage(records);
    expect(res).toEqual({ ok: true });
    expect(localStorage.setItem).toHaveBeenCalledWith(
      GRADEBOOK_STORAGE_KEY,
      JSON.stringify(records)
    );

    const loaded = loadGradebookFromStorage();
    expect(loaded).toEqual(records);
  });

  it('deve detectar QuotaExceededError e retornar { ok: false, reason: "quota" }', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      const err = new DOMException('The quota has been exceeded', 'QuotaExceededError');
      throw err;
    });

    const examRes = saveExamToStorage(emptyExam);
    expect(examRes).toEqual({ ok: false, reason: 'quota' });

    const gradeRes = saveGradebookToStorage([]);
    expect(gradeRes).toEqual({ ok: false, reason: 'quota' });
  });

  it('deve identificar reason "unknown" para erros genéricos no storage', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Disco desconectado ou permissão negada');
    });

    const res = saveExamToStorage(emptyExam);
    expect(res).toEqual({ ok: false, reason: 'unknown' });
  });

  it('isQuotaExceededError deve reconhecer diferentes formatos de exceção de cota', () => {
    const domEx = new DOMException('Quota', 'QuotaExceededError');
    expect(isQuotaExceededError(domEx)).toBe(true);

    const oldFirefox = { name: 'NS_ERROR_DOM_QUOTA_REACHED', code: 1014 };
    expect(isQuotaExceededError(oldFirefox)).toBe(true);

    const oldWebkit = { name: 'QuotaExceededError', code: 22 };
    expect(isQuotaExceededError(oldWebkit)).toBe(true);

    const genericError = new Error('Random error');
    expect(isQuotaExceededError(genericError)).toBe(false);
  });

  it('deve salvar e recuperar a data do último backup', () => {
    expect(loadLastBackupDate()).toBeNull();

    const now = new Date('2026-10-15T12:00:00Z');
    saveLastBackupDate(now);

    const loaded = loadLastBackupDate();
    expect(loaded).not.toBeNull();
    expect(loaded?.toISOString()).toBe(now.toISOString());
  });
});

