import { describe, it, expect } from 'vitest';
import {
  batchReducer,
  initialBatchState,
  classifyPhotoResult,
  getFileSignature,
  getBatchSummary,
  BatchState,
} from '../src/utils/batchQueue';
import { PhotoResult } from '../src/utils/photoPipeline';
import { GradingRecord } from '../src/types/exam';

function makeMockFile(name: string, size = 1000, lastModified = 12345678): File {
  return {
    name,
    size,
    lastModified,
  } as unknown as File;
}

function makeMockRecord(opts: {
  versionLetter?: string;
  hasNeedsReview?: boolean;
  blankCount?: number;
  totalQuestions?: number;
} = {}): GradingRecord {
  const total = opts.totalQuestions ?? 6;
  const blank = opts.blankCount ?? 0;
  const versionLetter = opts.versionLetter ?? 'A';

  const answers = Array.from({ length: total }, (_, i) => {
    const qNum = i + 1;
    const isBlank = i < blank;
    return {
      questionNumber: qNum,
      markedOption: isBlank ? null : 'A',
      correctOption: 'A',
      isCorrect: !isBlank,
      status: isBlank ? ('blank' as const) : ('correct' as const),
      pointsEarned: isBlank ? 0 : 1,
      maxPoints: 1,
      needsReview: opts.hasNeedsReview && i === 0 ? true : false,
    };
  });

  return {
    id: `rec-${Math.random()}`,
    timestamp: Date.now(),
    examId: 'test-exam',
    versionLetter,
    studentName: '',
    studentId: '',
    answers,
    totalScore: total - blank,
    maxScore: total,
    percentage: ((total - blank) / total) * 100,
  };
}

describe('batchQueue logic', () => {
  describe('getFileSignature', () => {
    it('gera assinatura determinística baseada em nome, tamanho e data', () => {
      const file = makeMockFile('prova1.jpg', 2048, 17000000);
      expect(getFileSignature(file)).toBe('prova1.jpg|2048|17000000');
    });
  });

  describe('classifyPhotoResult', () => {
    it('classifica status error como error', () => {
      const res: PhotoResult = {
        status: 'error',
        payloadSource: 'none',
        error: 'Arquivo corrompido',
      };
      const classification = classifyPhotoResult(res);
      expect(classification.status).toBe('error');
      expect(classification.reason).toBe('Arquivo corrompido');
    });

    it('classifica qr_only como error informando falta de respostas', () => {
      const res: PhotoResult = {
        status: 'qr_only',
        payloadSource: 'qr',
      };
      const classification = classifyPhotoResult(res);
      expect(classification.status).toBe('error');
      expect(classification.reason).toContain('apenas o QR Code');
    });

    it('classifica como review quando há versionMismatch', () => {
      const record = makeMockRecord({ versionLetter: 'B' });
      const res: PhotoResult = {
        status: 'graded',
        record,
        payloadSource: 'qr',
        versionMismatch: true,
      };
      const classification = classifyPhotoResult(res);
      expect(classification.status).toBe('review');
      expect(classification.reason).toContain('difere da versão travada');
    });

    it('classifica como review quando há questões com needsReview', () => {
      const record = makeMockRecord({ hasNeedsReview: true });
      const res: PhotoResult = {
        status: 'graded',
        record,
        payloadSource: 'locked',
      };
      const classification = classifyPhotoResult(res);
      expect(classification.status).toBe('review');
      expect(classification.reason).toContain('revisão humana');
    });

    it('classifica como review quando há suspeita global de folha em branco (>= 50% em branco)', () => {
      const record = makeMockRecord({ totalQuestions: 6, blankCount: 4 });
      const res: PhotoResult = {
        status: 'graded',
        record,
        payloadSource: 'locked',
      };
      const classification = classifyPhotoResult(res);
      expect(classification.status).toBe('review');
      expect(classification.reason).toContain('Suspeita de enquadramento');
    });

    it('classifica como ok quando a folha foi lida com clareza sem pendências', () => {
      const record = makeMockRecord({ totalQuestions: 10, blankCount: 1 });
      const res: PhotoResult = {
        status: 'graded',
        record,
        payloadSource: 'locked',
      };
      const classification = classifyPhotoResult(res);
      expect(classification.status).toBe('ok');
      expect(classification.reason).toBeUndefined();
    });
  });

  describe('batchReducer', () => {
    it('adiciona arquivos e ignora duplicatas pela assinatura', () => {
      const file1 = makeMockFile('f1.jpg', 100, 1);
      const file2 = makeMockFile('f2.jpg', 200, 2);
      const fileDuplicate = makeMockFile('f1.jpg', 100, 1);

      let state = batchReducer(initialBatchState, {
        type: 'ADD_FILES',
        files: [file1, file2, fileDuplicate],
      });

      expect(state.items.length).toBe(2);
      expect(state.lastAddedCount).toBe(2);
      expect(state.lastDuplicateCount).toBe(1);
      expect(state.items[0].file.name).toBe('f1.jpg');
      expect(state.items[0].status).toBe('queued');
      expect(state.items[1].file.name).toBe('f2.jpg');

      // Tenta adicionar f2 novamente
      state = batchReducer(state, {
        type: 'ADD_FILES',
        files: [file2],
      });
      expect(state.items.length).toBe(2);
      expect(state.lastAddedCount).toBe(0);
      expect(state.lastDuplicateCount).toBe(1);
    });

    it('gerencia transição de status para processing e finish', () => {
      const file = makeMockFile('prova.jpg');
      let state = batchReducer(initialBatchState, {
        type: 'ADD_FILES',
        files: [file],
      });
      const itemId = state.items[0].id;

      state = batchReducer(state, { type: 'START_PROCESSING' });
      expect(state.isProcessing).toBe(true);

      state = batchReducer(state, { type: 'SET_ITEM_PROCESSING', id: itemId });
      expect(state.activeItemId).toBe(itemId);
      expect(state.items[0].status).toBe('processing');

      const mockRecord = makeMockRecord();
      state = batchReducer(state, {
        type: 'FINISH_ITEM',
        id: itemId,
        result: {
          status: 'graded',
          record: mockRecord,
          payloadSource: 'locked',
        },
      });

      expect(state.activeItemId).toBeNull();
      expect(state.items[0].status).toBe('ok');
      expect(state.items[0].result?.record?.totalScore).toBe(6);
    });

    it('ao cancelar, preserva itens já processados e reverte o item em processamento para queued', () => {
      const f1 = makeMockFile('f1.jpg');
      const f2 = makeMockFile('f2.jpg');
      let state = batchReducer(initialBatchState, {
        type: 'ADD_FILES',
        files: [f1, f2],
      });

      // f1 finalizado com ok
      state = batchReducer(state, {
        type: 'FINISH_ITEM',
        id: state.items[0].id,
        result: {
          status: 'graded',
          record: makeMockRecord(),
          payloadSource: 'locked',
        },
      });

      // f2 está em processamento
      state = batchReducer(state, { type: 'START_PROCESSING' });
      state = batchReducer(state, { type: 'SET_ITEM_PROCESSING', id: state.items[1].id });

      // Cancelar
      state = batchReducer(state, { type: 'CANCEL_PROCESSING' });
      expect(state.isProcessing).toBe(false);
      expect(state.activeItemId).toBeNull();
      expect(state.items[0].status).toBe('ok');
      expect(state.items[1].status).toBe('queued');
    });

    it('permite descartar item e marcar como salvo', () => {
      const f1 = makeMockFile('f1.jpg');
      let state = batchReducer(initialBatchState, {
        type: 'ADD_FILES',
        files: [f1],
      });
      const id = state.items[0].id;

      state = batchReducer(state, { type: 'DISCARD_ITEM', id });
      expect(state.items[0].status).toBe('discarded');

      state = batchReducer(state, { type: 'MARK_SAVED', id });
      expect(state.items[0].status).toBe('saved');
    });

    it('permite tentar de novo um item com erro ou review', () => {
      const f1 = makeMockFile('f1.jpg');
      let state = batchReducer(initialBatchState, {
        type: 'ADD_FILES',
        files: [f1],
      });
      const id = state.items[0].id;

      state = batchReducer(state, {
        type: 'FINISH_ITEM',
        id,
        result: { status: 'error', error: 'Falha', payloadSource: 'none' },
      });
      expect(state.items[0].status).toBe('error');

      state = batchReducer(state, { type: 'RETRY_ITEM', id });
      expect(state.items[0].status).toBe('queued');
      expect(state.items[0].result).toBeUndefined();
      expect(state.items[0].reason).toBeUndefined();
    });

    it('atualiza nome e matrícula do aluno inline e no record', () => {
      const f1 = makeMockFile('f1.jpg');
      let state = batchReducer(initialBatchState, {
        type: 'ADD_FILES',
        files: [f1],
      });
      const id = state.items[0].id;

      state = batchReducer(state, {
        type: 'FINISH_ITEM',
        id,
        result: {
          status: 'graded',
          record: makeMockRecord(),
          payloadSource: 'locked',
        },
      });

      state = batchReducer(state, {
        type: 'UPDATE_STUDENT_INFO',
        id,
        studentName: 'Ana Clara',
        studentId: '20261099',
      });

      expect(state.items[0].studentName).toBe('Ana Clara');
      expect(state.items[0].studentId).toBe('20261099');
      expect(state.items[0].result?.record?.studentName).toBe('Ana Clara');
      expect(state.items[0].result?.record?.studentId).toBe('20261099');
    });

    it('clearCompleted remove apenas itens salvos e descartados', () => {
      const state: BatchState = {
        items: [
          { id: '1', file: makeMockFile('1'), signature: '1', status: 'saved' },
          { id: '2', file: makeMockFile('2'), signature: '2', status: 'discarded' },
          { id: '3', file: makeMockFile('3'), signature: '3', status: 'ok' },
          { id: '4', file: makeMockFile('4'), signature: '4', status: 'review' },
        ],
        isProcessing: false,
        activeItemId: null,
      };

      const cleaned = batchReducer(state, { type: 'CLEAR_COMPLETED' });
      expect(cleaned.items.map((i) => i.id)).toEqual(['3', '4']);
    });
  });

  describe('getBatchSummary', () => {
    it('calcula sumário correto de status', () => {
      const items = [
        { id: '1', file: makeMockFile('1'), signature: '1', status: 'ok' as const },
        { id: '2', file: makeMockFile('2'), signature: '2', status: 'ok' as const },
        { id: '3', file: makeMockFile('3'), signature: '3', status: 'review' as const },
        { id: '4', file: makeMockFile('4'), signature: '4', status: 'error' as const },
        { id: '5', file: makeMockFile('5'), signature: '5', status: 'queued' as const },
        { id: '6', file: makeMockFile('6'), signature: '6', status: 'saved' as const },
        { id: '7', file: makeMockFile('7'), signature: '7', status: 'discarded' as const },
      ];

      const summary = getBatchSummary(items);
      expect(summary.total).toBe(7);
      expect(summary.ok).toBe(2);
      expect(summary.canSaveOkCount).toBe(2);
      expect(summary.review).toBe(1);
      expect(summary.pendingReview).toBe(1);
      expect(summary.error).toBe(1);
      expect(summary.queued).toBe(1);
      expect(summary.saved).toBe(1);
      expect(summary.discarded).toBe(1);
      expect(summary.processedCount).toBe(5); // 2 ok + 1 review + 1 error + 1 saved
    });
  });
});

