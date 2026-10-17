import { Route } from './hashRouter';

export type RouteSyncAction =
  | { type: 'noop' }
  | { type: 'redirect_to_exams' }
  | { type: 'select_exam'; examId: string }
  | { type: 'select_none' };

export interface DecideRouteSyncInput {
  route: Route;
  exams: { id: string }[];
  lastSyncedExamId: string | null;
  currentExamId: string;
  activeExamId: string | null | undefined;
}

export interface DecideRouteSyncOutput {
  action: RouteSyncAction;
  nextLastSyncedExamId: string | null;
}

/**
 * Decide determinística e puramente a ação de sincronização entre a rota ativa e a prova carregada.
 * Evita disputas e vai-e-volta entre rota e estado de exame ao trocar de prova.
 */
export function decideRouteSync(input: DecideRouteSyncInput): DecideRouteSyncOutput {
  const { route, exams, lastSyncedExamId, currentExamId, activeExamId } = input;

  if (route.type === 'exam_step') {
    const exists = exams.some((e) => e.id === route.examId);
    if (!exists && exams.length > 0) {
      return { action: { type: 'redirect_to_exams' }, nextLastSyncedExamId: null };
    }
    if (exists && lastSyncedExamId !== route.examId) {
      return {
        action: { type: 'select_exam', examId: route.examId },
        nextLastSyncedExamId: route.examId,
      };
    }
    return { action: { type: 'noop' }, nextLastSyncedExamId: lastSyncedExamId };
  }

  if (route.type === 'scanner') {
    if (currentExamId || activeExamId) {
      return { action: { type: 'select_none' }, nextLastSyncedExamId: null };
    }
    return { action: { type: 'noop' }, nextLastSyncedExamId: null };
  }

  return { action: { type: 'noop' }, nextLastSyncedExamId: null };
}
