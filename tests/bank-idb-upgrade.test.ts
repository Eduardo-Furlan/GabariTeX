import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDbProfileStore } from '../src/storage/indexedDbProfileStore';
import { Exam, GradingRecord, Classroom } from '../src/types/exam';
import { initialSampleExam } from '../src/utils/sampleExam';

describe('IndexedDB v1 to v2 Upgrade (src/storage/indexedDbProfileStore.ts)', () => {
  const DB_NAME = 'gabaritex_profile_db';

  beforeEach(async () => {
    // Clean up indexedDB before each test
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  });

  it('upgrades existing v1 database to v2 preserving all data and adding bank stores', async () => {
    const v1Exam: Exam = {
      ...initialSampleExam,
      id: 'exam-v1',
      header: { ...initialSampleExam.header, examTitle: 'Prova Legada v1' },
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const v1Record: GradingRecord = {
      id: 'rec-v1',
      examId: 'exam-v1',
      studentName: 'Aluno Antigo',
      studentId: '100',
      timestamp: 1000,
      versionLetter: 'A',
      totalScore: 7,
      maxScore: 10,
      percentage: 70,
      answers: [],
    };

    const v1Class: Classroom = {
      id: 'cls-v1',
      name: 'Turma Histórica',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      students: [],
    };

    // 1. Manually create v1 database and insert data
    await new Promise<void>((resolve, reject) => {
      const openReq = indexedDB.open(DB_NAME, 1);
      openReq.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        db.createObjectStore('exams', { keyPath: 'id' });
        db.createObjectStore('records', { keyPath: 'id' });
        db.createObjectStore('classes', { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'key' });
      };
      openReq.onsuccess = () => {
        const db = openReq.result;
        const tx = db.transaction(['exams', 'records', 'classes', 'settings'], 'readwrite');
        tx.objectStore('exams').put(v1Exam);
        tx.objectStore('records').put(v1Record);
        tx.objectStore('classes').put(v1Class);
        tx.objectStore('settings').put({ key: 'profile_settings', settings: { activeExamId: 'exam-v1' } });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      openReq.onerror = () => reject(openReq.error);
    });

    // 2. Open via IndexedDbProfileStore (which opens with DB_VERSION = 2)
    const store = new IndexedDbProfileStore();

    // Verify v1 data is preserved
    const loadedExam = await store.getExam('exam-v1');
    expect(loadedExam).toBeDefined();
    expect(loadedExam?.header.examTitle).toBe('Prova Legada v1');

    const records = await store.getRecords();
    expect(records).toHaveLength(1);
    expect(records[0].studentName).toBe('Aluno Antigo');

    const classes = await store.getClasses();
    expect(classes).toHaveLength(1);
    expect(classes[0].name).toBe('Turma Histórica');

    const settings = await store.getSettings();
    expect(settings.activeExamId).toBe('exam-v1');

    // 3. Verify bank stores exist and operate in the upgraded database
    const meta0 = await store.getBankMeta();
    expect(meta0.schema).toBe(1);
    expect(meta0.groups).toEqual([]);

    await store.putBankMeta({
      schema: 1,
      groups: [{ id: 'g1', parentId: null, name: 'G1', order: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
      tags: [],
      blueprints: [],
    });
    const loadedMeta = await store.getBankMeta();
    expect(loadedMeta.groups).toHaveLength(1);
    expect(loadedMeta.groups[0].name).toBe('G1');

    await store.putBankQuestions([
      {
        id: 'bq-v2',
        groupId: 'g1',
        type: 'objective',
        prompt: 'Nova Questão',
        points: 2,
        tagIds: [],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]);
    const bqs = await store.listBankQuestions();
    expect(bqs).toHaveLength(1);
    expect(bqs[0].id).toBe('bq-v2');

    // 4. Test deleteBankQuestions
    await store.deleteBankQuestions(['bq-v2']);
    expect(await store.listBankQuestions()).toHaveLength(0);

    // 5. Test replaceProfile preserving existing bank when data.bank is undefined
    await store.putBankQuestions([
      {
        id: 'bq-keep',
        groupId: null,
        type: 'objective',
        prompt: 'Permanecer',
        points: 1,
        tagIds: [],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]);
    await store.replaceProfile({
      exams: [v1Exam],
      records: [],
      classes: [],
    });
    const keptBq = await store.listBankQuestions();
    expect(keptBq).toHaveLength(1);
    expect(keptBq[0].id).toBe('bq-keep');
  });
});
