import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import { IndexedDbProfileStore } from '../src/storage/indexedDbProfileStore';
import { parseProfileZip, mergeProfiles } from '../src/utils/profileZip';
import { applyProfileImport } from '../src/utils/profileImportApply';
import { ProfileStore } from '../src/storage/profileStore';
import { ProfileData, ProfileSettings } from '../src/types/profile';
import { BankGroup, BankQuestion, BankTag, GenerationBlueprint } from '../src/types/bank';

describe('Profile Import and Storage Error Handling (Hotfix H2)', () => {
  const DB_NAME = 'gabaritex_profile_db';
  const zipPath = path.resolve('docs/screenshots/assets/escola-exemplo-perfil.zip');
  const zipBytes = new Uint8Array(fs.readFileSync(zipPath));

  beforeEach(async () => {
    // Reset IndexedDB between tests
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  });

  describe('Importação do Perfil Exemplo Oficial no IndexedDbProfileStore', () => {
    it('mesclagem (merge) em perfil vazio importa exatamente 6 questões, 4 grupos, 4 etiquetas e 1 blueprint', async () => {
      const parsed = await parseProfileZip(zipBytes);
      const store = new IndexedDbProfileStore();

      const emptyData: ProfileData = { exams: [], classes: [], records: [] };
      const { mergedData, mergedSettings } = mergeProfiles(
        emptyData,
        parsed.profile,
        {},
        parsed.settings
      );

      const result = await applyProfileImport(store, mergedData, mergedSettings, 'merge');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.counts.exams).toBe(1);
        expect(result.counts.classes).toBe(1);
        expect(result.counts.records).toBe(8);
        expect(result.counts.bank).toEqual({
          questions: 6,
          groups: 4,
          tags: 4,
          blueprints: 1,
        });
      }

      // Verifica persistência real no IndexedDB
      const questions = await store.listBankQuestions();
      expect(questions).toHaveLength(6);

      const meta = await store.getBankMeta();
      expect(meta.groups).toHaveLength(4);
      expect(meta.tags).toHaveLength(4);
      expect(meta.blueprints).toHaveLength(1);
    });

    it('substituição (replace) em perfil vazio importa exatamente 6 questões, 4 grupos, 4 etiquetas e 1 blueprint', async () => {
      const parsed = await parseProfileZip(zipBytes);
      const store = new IndexedDbProfileStore();

      const result = await applyProfileImport(store, parsed.profile, parsed.settings, 'replace');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.counts.exams).toBe(1);
        expect(result.counts.classes).toBe(1);
        expect(result.counts.records).toBe(8);
        expect(result.counts.bank).toEqual({
          questions: 6,
          groups: 4,
          tags: 4,
          blueprints: 1,
        });
      }

      // Verifica persistência real no IndexedDB
      const questions = await store.listBankQuestions();
      expect(questions).toHaveLength(6);

      const meta = await store.getBankMeta();
      expect(meta.groups).toHaveLength(4);
      expect(meta.tags).toHaveLength(4);
      expect(meta.blueprints).toHaveLength(1);
    });

    it('mesclagem em perfil com banco já existente preserva ambos os dados', async () => {
      const store = new IndexedDbProfileStore();

      // Preexistência no banco
      const existingGroup: BankGroup = {
        id: 'g-preexistente',
        parentId: null,
        name: 'Biologia Local',
        order: 0,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };
      const existingTag: BankTag = {
        id: 't-preexistente',
        name: 'ecologia-local',
        color: 'emerald',
      };
      const existingQuestion: BankQuestion = {
        id: 'q-preexistente',
        groupId: 'g-preexistente',
        type: 'objective',
        prompt: 'Questão local preexistente',
        points: 2,
        tagIds: ['t-preexistente'],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };
      const existingBlueprint: GenerationBlueprint = {
        id: 'bp-preexistente',
        name: 'Modelo Local',
        totalQuestions: 1,
        seed: 42,
        rules: [],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };

      await store.putBankMeta({
        groups: [existingGroup],
        tags: [existingTag],
        blueprints: [existingBlueprint],
      });
      await store.putBankQuestions([existingQuestion]);

      // Monta dados do perfil atual a partir do store
      const currentBankMeta = await store.getBankMeta();
      const currentQuestions = await store.listBankQuestions();
      const currentData: ProfileData = {
        exams: [],
        classes: [],
        records: [],
        bank: {
          groups: currentBankMeta.groups,
          tags: currentBankMeta.tags,
          blueprints: currentBankMeta.blueprints,
          questions: currentQuestions,
        },
      };

      const parsed = await parseProfileZip(zipBytes);
      const { mergedData, mergedSettings } = mergeProfiles(
        currentData,
        parsed.profile,
        {},
        parsed.settings
      );

      const result = await applyProfileImport(store, mergedData, mergedSettings, 'merge');
      expect(result.ok).toBe(true);

      // Total de questões: 1 local + 6 importadas = 7
      const finalQuestions = await store.listBankQuestions();
      expect(finalQuestions).toHaveLength(7);
      expect(finalQuestions.some((q) => q.id === 'q-preexistente')).toBe(true);

      // Grupos: 1 local + 4 importados = 5
      const finalMeta = await store.getBankMeta();
      expect(finalMeta.groups).toHaveLength(5);
      expect(finalMeta.groups.some((g) => g.id === 'g-preexistente')).toBe(true);

      // Tags: 1 local + 4 importadas = 5
      expect(finalMeta.tags).toHaveLength(5);
      expect(finalMeta.tags.some((t) => t.id === 't-preexistente')).toBe(true);

      // Blueprints: 1 local + 1 importado = 2
      expect(finalMeta.blueprints).toHaveLength(2);
      expect(finalMeta.blueprints.some((b) => b.id === 'bp-preexistente')).toBe(true);
    });
  });

  describe('Interrupção e Isolamento de Falhas de Armazenamento (applyProfileImport)', () => {
    const dummyData: ProfileData = {
      exams: [
        {
          id: 'ex-1',
          header: {
            institution: 'Escola',
            examTitle: 'Prova 1',
            date: '',
            teacher: '',
            subject: '',
            studentName: '',
            classId: '',
          },
          questions: [],
          scoring: {
            pointsPerQuestion: 1,
            penaltyKind: 'none',
            penaltyAmount: 0,
            partialScore: false,
          },
          updatedAt: '2026-01-01',
        },
      ],
      classes: [{ id: 'c-1', name: 'Turma A', students: [] }],
      records: [],
      bank: {
        groups: [],
        tags: [],
        questions: [],
        blueprints: [],
      },
    };

    const createStubStore = (overrides: Partial<ProfileStore> = {}): ProfileStore => {
      return {
        listExams: vi.fn().mockResolvedValue([]),
        getExam: vi.fn().mockResolvedValue(undefined),
        putExam: vi.fn().mockResolvedValue({ ok: true }),
        deleteExam: vi.fn().mockResolvedValue(undefined),
        getRecords: vi.fn().mockResolvedValue([]),
        putRecords: vi.fn().mockResolvedValue({ ok: true }),
        getClasses: vi.fn().mockResolvedValue([]),
        putClasses: vi.fn().mockResolvedValue({ ok: true }),
        getSettings: vi.fn().mockResolvedValue({}),
        putSettings: vi.fn().mockResolvedValue(undefined),
        replaceProfile: vi.fn().mockResolvedValue({ ok: true }),
        getBankMeta: vi.fn().mockResolvedValue({ groups: [], tags: [], blueprints: [] }),
        putBankMeta: vi.fn().mockResolvedValue({ ok: true }),
        listBankQuestions: vi.fn().mockResolvedValue([]),
        putBankQuestions: vi.fn().mockResolvedValue({ ok: true }),
        deleteBankQuestions: vi.fn().mockResolvedValue(undefined),
        replaceBank: vi.fn().mockResolvedValue({ ok: true }),
        ...overrides,
      };
    };

    it('interrompe se replaceProfile falhar em modo replace', async () => {
      const store = createStubStore({
        replaceProfile: vi.fn().mockResolvedValue({ ok: false, reason: 'disk_full' }),
      });

      const res = await applyProfileImport(store, dummyData, {}, 'replace');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.step).toBe('replaceProfile');
        expect(res.reason).toBe('disk_full');
      }
    });

    it('interrompe em putExam e não executa putClasses, putRecords nem replaceBank', async () => {
      const putClassesMock = vi.fn().mockResolvedValue({ ok: true });
      const putRecordsMock = vi.fn().mockResolvedValue({ ok: true });
      const replaceBankMock = vi.fn().mockResolvedValue({ ok: true });

      const store = createStubStore({
        putExam: vi.fn().mockResolvedValue({ ok: false, reason: 'quota' }),
        putClasses: putClassesMock,
        putRecords: putRecordsMock,
        replaceBank: replaceBankMock,
      });

      const res = await applyProfileImport(store, dummyData, {}, 'merge');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.step).toBe('putExam');
        expect(res.reason).toBe('quota');
      }

      expect(putClassesMock).not.toHaveBeenCalled();
      expect(putRecordsMock).not.toHaveBeenCalled();
      expect(replaceBankMock).not.toHaveBeenCalled();
    });

    it('interrompe em putClasses e não executa putRecords nem replaceBank', async () => {
      const putRecordsMock = vi.fn().mockResolvedValue({ ok: true });
      const replaceBankMock = vi.fn().mockResolvedValue({ ok: true });

      const store = createStubStore({
        putClasses: vi.fn().mockResolvedValue({ ok: false, reason: 'disk_full' }),
        putRecords: putRecordsMock,
        replaceBank: replaceBankMock,
      });

      const res = await applyProfileImport(store, dummyData, {}, 'merge');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.step).toBe('putClasses');
        expect(res.reason).toBe('disk_full');
      }

      expect(putRecordsMock).not.toHaveBeenCalled();
      expect(replaceBankMock).not.toHaveBeenCalled();
    });

    it('interrompe em putRecords e não executa replaceBank', async () => {
      const replaceBankMock = vi.fn().mockResolvedValue({ ok: true });

      const store = createStubStore({
        putRecords: vi.fn().mockResolvedValue({ ok: false, reason: 'permission' }),
        replaceBank: replaceBankMock,
      });

      const res = await applyProfileImport(store, dummyData, {}, 'merge');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.step).toBe('putRecords');
        expect(res.reason).toBe('permission');
      }

      expect(replaceBankMock).not.toHaveBeenCalled();
    });

    it('interrompe em replaceBank e não executa putSettings', async () => {
      const putSettingsMock = vi.fn().mockResolvedValue(undefined);

      const store = createStubStore({
        replaceBank: vi.fn().mockResolvedValue({ ok: false, reason: 'quota' }),
        putSettings: putSettingsMock,
      });

      const res = await applyProfileImport(store, dummyData, { activeExamId: 'ex-1' }, 'merge');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.step).toBe('replaceBank');
        expect(res.reason).toBe('quota');
      }

      expect(putSettingsMock).not.toHaveBeenCalled();
    });

    it('captura exceção em putSettings e relata etapa putSettings', async () => {
      const store = createStubStore({
        putSettings: vi.fn().mockRejectedValue(new Error('IDB transaction abort')),
      });

      const res = await applyProfileImport(store, dummyData, { activeExamId: 'ex-1' }, 'merge');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.step).toBe('putSettings');
        expect(res.reason).toBe('unknown');
      }
    });
  });
});
