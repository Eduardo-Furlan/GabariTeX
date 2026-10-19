import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryProfileStore } from '../src/storage/memoryProfileStore';
import { IndexedDbProfileStore } from '../src/storage/indexedDbProfileStore';
import { Exam, GradingRecord, Classroom } from '../src/types/exam';
import { initialSampleExam } from '../src/utils/sampleExam';

describe('ProfileStore (Plano 08 §2.1 e §6)', () => {
  let store: MemoryProfileStore;

  const sampleExam1: Exam = {
    ...initialSampleExam,
    id: 'exam-1',
    header: { ...initialSampleExam.header, examTitle: 'Física I' },
    updatedAt: '2026-10-15T12:00:00.000Z',
  };

  const sampleExam2: Exam = {
    ...initialSampleExam,
    id: 'exam-2',
    header: { ...initialSampleExam.header, examTitle: 'Química Geral' },
    updatedAt: '2026-10-14T12:00:00.000Z',
  };

  const sampleRecords: GradingRecord[] = [
    {
      id: 'rec-1',
      examId: 'exam-1',
      studentName: 'Ana',
      studentId: '1',
      timestamp: 1000,
      versionLetter: 'A',
      totalScore: 8,
      maxScore: 10,
      percentage: 80,
      answers: [],
    },
    {
      id: 'rec-2',
      examId: 'exam-1',
      studentName: 'Beto',
      studentId: '2',
      timestamp: 2000,
      versionLetter: 'B',
      totalScore: 6,
      maxScore: 10,
      percentage: 60,
      answers: [],
    },
    {
      id: 'rec-3',
      examId: 'exam-2',
      studentName: 'Carla',
      studentId: '3',
      timestamp: 3000,
      versionLetter: 'A',
      totalScore: 9,
      maxScore: 10,
      percentage: 90,
      answers: [],
    },
  ];

  const sampleClasses: Classroom[] = [
    {
      id: 'cls-1',
      name: 'Turma A',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      students: [],
    },
  ];

  beforeEach(() => {
    store = new MemoryProfileStore();
  });

  it('deve salvar exames e listá-los com contagem correta de questões e notas', async () => {
    await store.putExam(sampleExam1);
    await store.putExam(sampleExam2);
    await store.putRecords(sampleRecords);

    const metas = await store.listExams();
    expect(metas.length).toBe(2);

    const meta1 = metas.find((m) => m.id === 'exam-1');
    expect(meta1).toBeDefined();
    expect(meta1?.name).toBe('Física I');
    expect(meta1?.questionCount).toBe(sampleExam1.questions.length);
    expect(meta1?.recordCount).toBe(2);

    const meta2 = metas.find((m) => m.id === 'exam-2');
    expect(meta2).toBeDefined();
    expect(meta2?.name).toBe('Química Geral');
    expect(meta2?.recordCount).toBe(1);
  });

  it('excluir uma prova deve apagar suas notas e apenas as notas dela (Plano 08 §2.2 e §6)', async () => {
    await store.putExam(sampleExam1);
    await store.putExam(sampleExam2);
    await store.putRecords(sampleRecords);

    expect((await store.getRecords()).length).toBe(3);

    // Exclui exam-1
    await store.deleteExam('exam-1');

    // exam-1 não existe mais
    expect(await store.getExam('exam-1')).toBeUndefined();
    // exam-2 ainda existe
    expect(await store.getExam('exam-2')).toBeDefined();

    // Notas de exam-1 sumiram, nota de exam-2 permanece intacta
    const remainingRecords = await store.getRecords();
    expect(remainingRecords.length).toBe(1);
    expect(remainingRecords[0].id).toBe('rec-3');
    expect(remainingRecords[0].examId).toBe('exam-2');
  });

  it('deve persistir e recuperar turmas e configurações', async () => {
    await store.putClasses(sampleClasses);
    const classes = await store.getClasses();
    expect(classes.length).toBe(1);
    expect(classes[0].name).toBe('Turma A');

    await store.putSettings({ activeExamId: 'exam-1', activeClassId: 'cls-1' });
    const settings = await store.getSettings();
    expect(settings.activeExamId).toBe('exam-1');
    expect(settings.activeClassId).toBe('cls-1');
  });

  it('IndexedDbProfileStore com fallback em memória deve respeitar as mesmas operações', async () => {
    const idbStore = new IndexedDbProfileStore();
    await idbStore.putExam(sampleExam1);
    const loaded = await idbStore.getExam('exam-1');
    expect(loaded?.header.examTitle).toBe('Física I');

    await idbStore.putRecords([sampleRecords[0]]);
    const metas = await idbStore.listExams();
    expect(metas[0].recordCount).toBe(1);

    await idbStore.deleteExam('exam-1');
    expect(await idbStore.getExam('exam-1')).toBeUndefined();
    expect((await idbStore.getRecords()).length).toBe(0);
  });

  it('replaceProfile no MemoryProfileStore deve substituir completamente todos os dados', async () => {
    // Seed 3 exams, 500 records, 2 classes
    await store.putExam(sampleExam1);
    await store.putExam(sampleExam2);
    await store.putExam({ ...sampleExam1, id: 'exam-3' });

    const fiveHundredRecords: GradingRecord[] = Array.from({ length: 500 }, (_, i) => ({
      ...sampleRecords[0],
      id: `rec-seed-${i}`,
      examId: i % 2 === 0 ? 'exam-1' : 'exam-2',
    }));
    await store.putRecords(fiveHundredRecords);
    await store.putClasses([
      sampleClasses[0],
      { id: 'cls-2', name: 'Turma B', createdAt: '2026-10-02T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z', students: [] },
    ]);

    expect((await store.listExams()).length).toBe(3);
    expect((await store.getRecords()).length).toBe(500);
    expect((await store.getClasses()).length).toBe(2);

    // Replace with 1 exam, 0 records, 0 classes
    await store.replaceProfile({
      exams: [sampleExam1],
      records: [],
      classes: [],
    }, { activeExamId: 'exam-1' });

    expect(await store.getRecords()).toEqual([]);
    const remainingExams = await store.listExams();
    expect(remainingExams.length).toBe(1);
    expect(remainingExams[0].id).toBe('exam-1');
    expect(await store.getClasses()).toEqual([]);
    expect((await store.getSettings()).activeExamId).toBe('exam-1');
  });

  it('replaceProfile no IndexedDbProfileStore deve substituir atomicamente os dados', async () => {
    const idbStore = new IndexedDbProfileStore();
    await idbStore.putExam(sampleExam1);
    await idbStore.putExam(sampleExam2);
    await idbStore.putRecords(sampleRecords);
    await idbStore.putClasses(sampleClasses);

    await idbStore.replaceProfile({
      exams: [sampleExam1],
      records: [],
      classes: [],
    });

    expect(await idbStore.getRecords()).toEqual([]);
    expect((await idbStore.listExams()).length).toBe(1);
    expect(await idbStore.getClasses()).toEqual([]);
  });

  it('replaceProfile no TauriProfileStore deve remover chaves antigas e salvar novo conjunto', async () => {
    const { TauriProfileStore } = await import('../src/storage/tauriProfileStore');
    const tauriStore = new TauriProfileStore();

    // Mock in-memory storage for fake invoke
    const mockStorage: Record<string, Uint8Array> = {};

    const fakeInvoke = async (cmd: string, args?: any, options?: any) => {
      if (cmd === 'store_list') {
        const prefix = args.prefix;
        return Object.keys(mockStorage).filter((k) => k.startsWith(prefix));
      }
      if (cmd === 'store_get') {
        const key = args.key;
        if (!mockStorage[key]) throw new Error('Not found: ' + key);
        return mockStorage[key].buffer;
      }
      if (cmd === 'store_put') {
        const key = options?.headers?.['x-store-key'];
        mockStorage[key] = args instanceof Uint8Array ? args : new TextEncoder().encode(JSON.stringify(args));
        return;
      }
      if (cmd === 'store_delete') {
        const key = args.key;
        delete mockStorage[key];
        return;
      }
      throw new Error('Unknown cmd: ' + cmd);
    };

    (tauriStore as any).getInvoke = async () => fakeInvoke;

    // Seed 3 exams, 500 records, 2 classes
    await tauriStore.putExam(sampleExam1);
    await tauriStore.putExam(sampleExam2);
    await tauriStore.putExam({ ...sampleExam1, id: 'exam-3' });

    const fiveHundredRecords: GradingRecord[] = Array.from({ length: 500 }, (_, i) => ({
      ...sampleRecords[0],
      id: `rec-seed-${i}`,
      examId: i % 2 === 0 ? 'exam-1' : 'exam-2',
    }));
    await tauriStore.putRecords(fiveHundredRecords);
    await tauriStore.putClasses([
      sampleClasses[0],
      { id: 'cls-2', name: 'Turma B', createdAt: '2026-10-02T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z', students: [] },
    ]);

    expect((await tauriStore.listExams()).length).toBe(3);
    expect((await tauriStore.getRecords()).length).toBe(500);
    expect((await tauriStore.getClasses()).length).toBe(2);

    // Replace with 1 exam, 0 records, 0 classes
    await tauriStore.replaceProfile({
      exams: [sampleExam1],
      records: [],
      classes: [],
    }, { activeExamId: 'exam-1' });

    expect(await tauriStore.getRecords()).toEqual([]);
    const remainingExams = await tauriStore.listExams();
    expect(remainingExams.length).toBe(1);
    expect(remainingExams[0].id).toBe('exam-1');
    expect(await tauriStore.getClasses()).toEqual([]);
    expect((await tauriStore.getSettings()).activeExamId).toBe('exam-1');
  });
});

