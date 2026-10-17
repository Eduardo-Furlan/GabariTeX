import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  saveLastBackupDate,
  loadLastBackupDate,
  generateGradebookCsv,
  saveActiveClassIdToStorage,
  loadActiveClassIdFromStorage,
} from '../src/utils/storage';
import { GradingRecord } from '../src/types/exam';

describe('Armazenamento Local e Exportação CSV (storage.ts)', () => {
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

  describe('Turma Ativa (Plano 06)', () => {
    it('deve salvar e carregar turma ativa no localStorage', () => {
      saveActiveClassIdToStorage('c1');
      expect(loadActiveClassIdFromStorage()).toBe('c1');
      saveActiveClassIdToStorage(null);
      expect(loadActiveClassIdFromStorage()).toBeNull();
    });
  });
});


