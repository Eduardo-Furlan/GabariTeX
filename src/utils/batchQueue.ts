import { PhotoResult } from './photoPipeline';

export type ItemStatus =
  | 'queued'
  | 'processing'
  | 'ok'
  | 'review'
  | 'error'
  | 'saved'
  | 'discarded';

export interface BatchItem {
  id: string;
  file: File;
  signature: string; // `${name}|${size}|${lastModified}`
  status: ItemStatus;
  result?: PhotoResult;
  reason?: string;
  studentName?: string;
  studentId?: string;
  studentRef?: string;
  classId?: string;
}

export interface BatchState {
  items: BatchItem[];
  isProcessing: boolean;
  activeItemId: string | null;
  lastAddedCount?: number;
  lastDuplicateCount?: number;
}

export interface BatchSummary {
  total: number;
  queued: number;
  processing: number;
  ok: number;
  review: number;
  error: number;
  saved: number;
  discarded: number;
  pendingReview: number;
  canSaveOkCount: number;
  processedCount: number;
}

export function getFileSignature(file: { name: string; size: number; lastModified: number }): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export function classifyPhotoResult(
  result: PhotoResult
): { status: 'ok' | 'review' | 'error'; reason?: string } {
  if (result.status === 'error') {
    return { status: 'error', reason: result.error || 'Erro no processamento da imagem.' };
  }

  if (result.status === 'qr_only') {
    return {
      status: 'error',
      reason: 'A foto contém apenas o QR Code (sem a grade de respostas).',
    };
  }

  if (!result.record) {
    return { status: 'error', reason: 'Nenhum resultado de correção gerado.' };
  }

  const record = result.record;

  if (result.versionMismatch) {
    return {
      status: 'review',
      reason: `Versão da folha (${record.versionLetter}) difere da versão travada.`,
    };
  }

  // Verifica questões com needsReview (dúvida OMR ou rasura)
  const needsReviewQuestions = record.answers.filter((a) => a.needsReview);
  if (needsReviewQuestions.length > 0) {
    return {
      status: 'review',
      reason: `${needsReviewQuestions.length} ${
        needsReviewQuestions.length === 1 ? 'questão requer' : 'questões requerem'
      } revisão humana.`,
    };
  }

  // Suspeita global: >= 50% em branco com >= 4 questões
  const blankCount = record.answers.filter((a) => a.status === 'blank').length;
  if (record.answers.length >= 4 && blankCount / record.answers.length >= 0.5) {
    return {
      status: 'review',
      reason: `Suspeita de enquadramento: ${blankCount} de ${record.answers.length} questões em branco.`,
    };
  }

  return { status: 'ok' };
}

export function getBatchSummary(items: BatchItem[]): BatchSummary {
  let queued = 0;
  let processing = 0;
  let ok = 0;
  let review = 0;
  let error = 0;
  let saved = 0;
  let discarded = 0;

  for (const item of items) {
    switch (item.status) {
      case 'queued':
        queued++;
        break;
      case 'processing':
        processing++;
        break;
      case 'ok':
        ok++;
        break;
      case 'review':
        review++;
        break;
      case 'error':
        error++;
        break;
      case 'saved':
        saved++;
        break;
      case 'discarded':
        discarded++;
        break;
    }
  }

  return {
    total: items.length,
    queued,
    processing,
    ok,
    review,
    error,
    saved,
    discarded,
    pendingReview: review,
    canSaveOkCount: ok,
    processedCount: ok + review + error + saved,
  };
}

export const initialBatchState: BatchState = {
  items: [],
  isProcessing: false,
  activeItemId: null,
};

export type BatchAction =
  | { type: 'ADD_FILES'; files: File[] }
  | { type: 'START_PROCESSING' }
  | { type: 'SET_ITEM_PROCESSING'; id: string }
  | { type: 'FINISH_ITEM'; id: string; result: PhotoResult }
  | { type: 'CANCEL_PROCESSING' }
  | { type: 'DISCARD_ITEM'; id: string }
  | { type: 'MARK_SAVED'; id: string }
  | { type: 'MARK_ITEMS_SAVED'; ids: string[] }
  | { type: 'RETRY_ITEM'; id: string }
  | {
      type: 'UPDATE_STUDENT_INFO';
      id: string;
      studentName?: string;
      studentId?: string;
      studentRef?: string;
      classId?: string;
    }
  | { type: 'CLEAR_COMPLETED' }
  | { type: 'RESET' };

export function batchReducer(state: BatchState, action: BatchAction): BatchState {
  switch (action.type) {
    case 'ADD_FILES': {
      let added = 0;
      let duplicates = 0;
      const existingSignatures = new Set(
        state.items.filter((it) => it.status !== 'discarded').map((it) => it.signature)
      );

      const newItems: BatchItem[] = [];
      for (const file of action.files) {
        const sig = getFileSignature(file);
        if (existingSignatures.has(sig)) {
          duplicates++;
          continue;
        }
        existingSignatures.add(sig);
        newItems.push({
          id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          file,
          signature: sig,
          status: 'queued',
        });
        added++;
      }

      return {
        ...state,
        items: [...state.items, ...newItems],
        lastAddedCount: added,
        lastDuplicateCount: duplicates,
      };
    }

    case 'START_PROCESSING':
      return {
        ...state,
        isProcessing: true,
      };

    case 'SET_ITEM_PROCESSING':
      return {
        ...state,
        activeItemId: action.id,
        items: state.items.map((it) =>
          it.id === action.id ? { ...it, status: 'processing' } : it
        ),
      };

    case 'FINISH_ITEM': {
      const { status, reason } = classifyPhotoResult(action.result);
      return {
        ...state,
        activeItemId: null,
        items: state.items.map((it) => {
          if (it.id !== action.id) return it;
          return {
            ...it,
            status,
            result: action.result,
            reason,
          };
        }),
      };
    }

    case 'CANCEL_PROCESSING':
      return {
        ...state,
        isProcessing: false,
        activeItemId: null,
        items: state.items.map((it) => {
          // Se estava sendo processado, volta para a fila
          if (it.status === 'processing') {
            return { ...it, status: 'queued' };
          }
          return it;
        }),
      };

    case 'DISCARD_ITEM':
      return {
        ...state,
        items: state.items.map((it) =>
          it.id === action.id ? { ...it, status: 'discarded' } : it
        ),
      };

    case 'MARK_SAVED':
      return {
        ...state,
        items: state.items.map((it) =>
          it.id === action.id ? { ...it, status: 'saved' } : it
        ),
      };

    case 'MARK_ITEMS_SAVED': {
      const idSet = new Set(action.ids);
      return {
        ...state,
        items: state.items.map((it) =>
          idSet.has(it.id) ? { ...it, status: 'saved' } : it
        ),
      };
    }

    case 'RETRY_ITEM':
      return {
        ...state,
        items: state.items.map((it) =>
          it.id === action.id
            ? { ...it, status: 'queued', result: undefined, reason: undefined }
            : it
        ),
      };

    case 'UPDATE_STUDENT_INFO':
      return {
        ...state,
        items: state.items.map((it) => {
          if (it.id !== action.id) return it;
          const updated = {
            ...it,
            studentName: action.studentName !== undefined ? action.studentName : it.studentName,
            studentId: action.studentId !== undefined ? action.studentId : it.studentId,
            studentRef:
              'studentRef' in action ? action.studentRef : it.studentRef,
            classId: 'classId' in action ? action.classId : it.classId,
          };
          if (updated.result?.record) {
            updated.result = {
              ...updated.result,
              record: {
                ...updated.result.record,
                studentName: updated.studentName ?? updated.result.record.studentName,
                studentId: updated.studentId ?? updated.result.record.studentId,
                studentRef: updated.studentRef,
                classId: updated.classId ?? updated.result.record.classId,
              },
            };
          }
          return updated;
        }),
      };

    case 'CLEAR_COMPLETED':
      return {
        ...state,
        items: state.items.filter((it) => it.status !== 'saved' && it.status !== 'discarded'),
      };

    case 'RESET':
      return { ...initialBatchState };

    default:
      return state;
  }
}

