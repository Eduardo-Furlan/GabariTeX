import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  saveExamToStorage,
  saveGradebookToStorage,
  loadExamFromStorage,
  loadGradebookFromStorage,
  isQuotaExceededError,
  saveLastBackupDate,
  loadLastBackupDate,
  generateGradebookCsv,
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

  describe('generateGradebookCsv (Plano 02)', () => {
    it('retorna string vazia para lista vazia de registros', () => {
      expect(generateGradebookCsv([])).toBe('');
    });

    it('gera colunas de Objetivas, Dissertativas, Pendências e Dn antes de Data com vírgula decimal e escape de aspas', () => {
      const records: GradingRecord[] = [
        {
          id: 'rec-csv-1',
          timestamp: new Date('2026-10-15T15:30:00Z').getTime(),
          studentName: 'Lucas "Doutor" Almeida',
          studentId: 'RA12345',
          versionLetter: 'B',
          totalScore: 7.5,
          maxScore: 10.0,
          percentage: 75.0,
          answers: [
            {
              questionNumber: 1,
              markedOption: 'A',
              correctOption: 'A',
              isCorrect: true,
              status: 'correct',
              pointsEarned: 2.5,
              maxPoints: 2.5,
              needsReview: false,
              manualOverride: true,
            },
            {
              questionNumber: 2,
              markedOption: 'C',
              correctOption: 'C',
              isCorrect: true,
              status: 'correct',
              pointsEarned: 2.5,
              maxPoints: 2.5,
              needsReview: false,
            },
          ],
          subjectiveAnswers: [
            {
              questionNumber: 3,
              maxPoints: 2.5,
              pointsEarned: 2.5,
            },
            {
              questionNumber: 4,
              maxPoints: 2.5,
              pointsEarned: null, // pendente
            },
          ],
        },
      ];

      const csv = generateGradebookCsv(records);
      const lines = csv.trim().split('\n');
      expect(lines.length).toBe(2);

      const header = lines[0];
      expect(header).toBe(
        'Aluno;Matrícula;Versão;Nota;Nota Máxima;Porcentagem (%);Q1;Q2;Revisões manuais;Objetivas;Dissertativas;Pendências;D3;D4;Turma;Data'
      );

      const row = lines[1];
      // Verifica o escape de aspas duplas no nome: "Lucas ""Doutor"" Almeida"
      expect(row).toContain('"Lucas ""Doutor"" Almeida"');
      expect(row).toContain('"RA12345"');
      expect(row).toContain('"B"');
      // Verifica vírgula decimal pt-BR
      expect(row).toContain('7,50;10,00;75,0%');
      // Verifica respostas objetivas Q1 e Q2
      expect(row).toContain('A(C);C(C)');
      // Verifica revisões manuais: 1
      expect(row).toContain(';1;');
      // Objetivas: 5,00; Dissertativas: 2,50; Pendências: 1
      expect(row).toContain(';5,00;2,50;1;');
      // D3 = 2,50; D4 = vazio (pois pendente)
      expect(row).toContain(';2,50;;');
      // Turma padrão
      expect(row).toContain('"Sem turma"');
    });

    it('deve incluir alunos faltantes no final do CSV quando options.missingStudents for fornecido', () => {
      const records: GradingRecord[] = [];
      const csv = generateGradebookCsv(records, {
        missingStudents: [{ id: 'st-1', name: 'Zezinho', registration: '999' }],
        filteredClassId: 'c1',
        classrooms: [{ id: 'c1', name: 'Turma Alpha', students: [], createdAt: '', updatedAt: '' }],
      });

      expect(csv).toContain('"Zezinho";"999";-;0,00;0,00;Sem nota');
      expect(csv).toContain('"Turma Alpha"');
    });

    it('deve incluir coluna de nota convertida na escala targetScore quando fornecida', () => {
      const records: GradingRecord[] = [
        {
          id: 'rec-scale-1',
          timestamp: 1000,
          studentName: 'Carlos',
          studentId: 'RA55',
          versionLetter: 'A',
          totalScore: 15,
          maxScore: 30,
          percentage: 50,
          answers: [],
        },
      ];

      const csv = generateGradebookCsv(records, { targetScore: 10 });
      const lines = csv.trim().split('\n');
      expect(lines[0]).toContain('Nota (Escala 10);Pontos Brutos;Nota Máxima');
      expect(lines[1]).toContain('5,00;15,00;30,00;50,0%');
    });
  });

  describe('Armazenamento de Turmas (Plano 06)', () => {
    it('deve salvar e carregar turmas do localStorage', async () => {
      const { saveClassroomsToStorage, loadClassroomsFromStorage, saveActiveClassIdToStorage, loadActiveClassIdFromStorage } = await import('../src/utils/storage');
      const classes = [
        { id: 'c1', name: 'Física I', students: [{ id: 's1', name: 'Fulano' }], createdAt: '', updatedAt: '' },
      ];

      const saveRes = saveClassroomsToStorage(classes);
      expect(saveRes).toEqual({ ok: true });

      const loaded = loadClassroomsFromStorage();
      expect(loaded.length).toBe(1);
      expect(loaded[0].name).toBe('Física I');

      saveActiveClassIdToStorage('c1');
      expect(loadActiveClassIdFromStorage()).toBe('c1');
      saveActiveClassIdToStorage(null);
      expect(loadActiveClassIdFromStorage()).toBeNull();
    });
  });
});

