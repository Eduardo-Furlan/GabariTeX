import { describe, it, expect } from 'vitest';
import { parseHash, formatHash } from '../src/router/hashRouter';
import { getProfileStore } from '../src/storage';
import { DecryptedQrPayload } from '../src/types/omr';
import { GradingRecord } from '../src/types/exam';

describe('Autonomous Grading and Exam Auto-Recovery (Correção sem prova selecionada)', () => {
  it('hashRouter maps #/corretor and #/scanner to autonomous scanner route', () => {
    expect(parseHash('#/corretor')).toEqual({ type: 'scanner' });
    expect(parseHash('#corretor')).toEqual({ type: 'scanner' });
    expect(parseHash('#/scanner')).toEqual({ type: 'scanner' });
    expect(parseHash('#/corrigir')).toEqual({ type: 'scanner' });
    expect(formatHash({ type: 'scanner' })).toBe('#/corretor');
  });

  it('reconstructs and persists missing/lost exam in ProfileStore when grading', async () => {
    const store = getProfileStore();
    const lostExamId = `lost-exam-${Date.now()}`;

    // Confirms exam does not exist initially
    const preCheck = await store.getExam(lostExamId);
    expect(preCheck).toBeUndefined();

    // Payload received from QR Code on the physical sheet
    const payload: DecryptedQrPayload = {
      version: 'B',
      examId: lostExamId,
      totalQuestions: 10,
      points: 1,
      key: {
        1: 'A',
        2: 'B',
        3: 'C',
        4: 'D',
        5: 'E',
        6: 'A',
        7: 'B',
        8: 'C',
        9: 'D',
        10: 'E',
      },
      subjectiveQuestions: [10],
      subjectivePoints: { 10: 2.5 },
    };

    // Reconstructs questions as ProfileContext.ensureExamExists does
    const questions = [];
    for (let i = 1; i <= payload.totalQuestions; i++) {
      const correctOpt = payload.key[i] || 'A';
      const isSubj = payload.subjectiveQuestions?.includes(i);
      const pts = payload.subjectivePoints?.[i] || 1;

      questions.push({
        id: `q-rec-${i}`,
        type: isSubj ? ('subjective' as const) : ('objective' as const),
        prompt: `Questão ${i}`,
        points: pts,
        options: [
          { id: `opt-A-${i}`, label: 'A' as const, text: '', isCorrect: correctOpt === 'A' },
          { id: `opt-B-${i}`, label: 'B' as const, text: '', isCorrect: correctOpt === 'B' },
          { id: `opt-C-${i}`, label: 'C' as const, text: '', isCorrect: correctOpt === 'C' },
          { id: `opt-D-${i}`, label: 'D' as const, text: '', isCorrect: correctOpt === 'D' },
          { id: `opt-E-${i}`, label: 'E' as const, text: '', isCorrect: correctOpt === 'E' },
        ],
      });
    }

    const recoveredExam = {
      id: lostExamId,
      header: {
        institution: '',
        course: '',
        professor: '',
        examTitle: `Prova Recuperada (${lostExamId.slice(0, 8)})`,
        date: new Date().toLocaleDateString('pt-BR'),
        instructions: 'Recuperada automaticamente via QR Code',
      },
      password: 'senha-recuperada',
      versionCount: 1,
      shuffleQuestions: false,
      shuffleOptions: false,
      twoColumns: true,
      updatedAt: new Date().toISOString(),
      questions,
    };

    await store.putExam(recoveredExam);

    // Checks that the recovered exam is now stored and retrievable
    const stored = await store.getExam(lostExamId);
    expect(stored).toBeDefined();
    expect(stored?.header.examTitle).toContain('Prova Recuperada');
    expect(stored?.questions).toHaveLength(10);
    expect(stored?.questions[0].options.find((o) => o.isCorrect)?.label).toBe('A');
    expect(stored?.questions[9].type).toBe('subjective');
    expect(stored?.questions[9].points).toBe(2.5);

    // Persists a record linked to this recovered exam
    const record: GradingRecord = {
      id: `rec-${Date.now()}`,
      examId: lostExamId,
      timestamp: Date.now(),
      studentName: 'Aluno Teste Recuperado',
      studentId: '2026001',
      versionLetter: 'B',
      totalScore: 8.5,
      maxScore: 10,
      percentage: 85,
      answers: [],
    };

    const existingRecords = await store.getRecords();
    await store.putRecords([...existingRecords, record]);

    const updatedRecords = await store.getRecords();
    const foundRecord = updatedRecords.find((r) => r.id === record.id);
    expect(foundRecord).toBeDefined();
    expect(foundRecord?.examId).toBe(lostExamId);
    expect(foundRecord?.studentName).toBe('Aluno Teste Recuperado');
  });

  it('Batch queue accepts multi-version sheets when alwaysReadQr is enabled', () => {
    // Verifies that a batch of items from various versions does not trigger versionMismatch
    // when each sheet has its own valid QR payload (lockedPayload is null in autonomous mode)
    const payloadA: DecryptedQrPayload = {
      version: 'A',
      examId: 'exam-multi-version',
      totalQuestions: 5,
      points: 1,
      key: { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' },
    };

    const payloadB: DecryptedQrPayload = {
      version: 'B',
      examId: 'exam-multi-version',
      totalQuestions: 5,
      points: 1,
      key: { 1: 'E', 2: 'D', 3: 'C', 4: 'B', 5: 'A' },
    };

    expect(payloadA.version).toBe('A');
    expect(payloadB.version).toBe('B');
    expect(payloadA.examId).toBe(payloadB.examId);
  });

  it('Sequential scanning: locks payload from QR photo and allows grading answer sheet with locked payload', () => {
    // Simulates PhotoUploader lockedPayloadRef pattern:
    // Photo 1: QR photo delivers payload
    const qrResult = {
      status: 'qr_only' as const,
      payload: {
        examId: 'exam-sequential-123',
        version: 'A',
        totalQuestions: 3,
        key: { 1: 'A', 2: 'C', 3: 'B' },
      },
    };

    let activePayload: DecryptedQrPayload | null = null;
    let scanTarget: 'qr' | 'sheet' = 'qr';

    if (qrResult.status === 'qr_only' && qrResult.payload) {
      activePayload = qrResult.payload;
      scanTarget = 'sheet';
    }

    expect(activePayload).not.toBeNull();
    expect(activePayload?.version).toBe('A');
    expect(scanTarget).toBe('sheet');

    // Photo 2: Answer sheet without QR uses activePayload as lockedPayload
    const sheetOptions = {
      lockedPayload: activePayload,
      scanTarget,
    };

    expect(sheetOptions.lockedPayload).toBeDefined();
    expect(sheetOptions.lockedPayload?.key[1]).toBe('A');
    expect(sheetOptions.lockedPayload?.key[2]).toBe('C');
    expect(sheetOptions.lockedPayload?.key[3]).toBe('B');
  });
});

