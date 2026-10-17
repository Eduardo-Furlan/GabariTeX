import { describe, it, expect } from 'vitest';
import { decideRouteSync } from '../src/router/examSync';
import { Route } from '../src/router/hashRouter';

describe('decideRouteSync', () => {
  const dummyExams = [{ id: 'exam-1' }, { id: 'exam-2' }];

  it('rota nova exam_step com prova existente dispara select_exam e atualiza lastSynced', () => {
    const route: Route = { type: 'exam_step', examId: 'exam-1', step: 'criar' };
    const res = decideRouteSync({
      route,
      exams: dummyExams,
      lastSyncedExamId: null,
      currentExamId: '',
      activeExamId: null,
    });

    expect(res.action).toEqual({ type: 'select_exam', examId: 'exam-1' });
    expect(res.nextLastSyncedExamId).toBe('exam-1');
  });

  it('mesma rota exam_step já sincronizada retorna noop sem alterar lastSynced', () => {
    const route: Route = { type: 'exam_step', examId: 'exam-1', step: 'criar' };
    const res = decideRouteSync({
      route,
      exams: dummyExams,
      lastSyncedExamId: 'exam-1',
      currentExamId: 'exam-1',
      activeExamId: 'exam-1',
    });

    expect(res.action).toEqual({ type: 'noop' });
    expect(res.nextLastSyncedExamId).toBe('exam-1');
  });

  it('regressão da disputa: currentExamId diferente da rota sem mudança de rota gera noop', () => {
    // Cenário onde o handler já trocou o estado exam.id para exam-2 antes da rota atualizar, ou vice-versa
    const route: Route = { type: 'exam_step', examId: 'exam-1', step: 'criar' };
    const res = decideRouteSync({
      route,
      exams: dummyExams,
      lastSyncedExamId: 'exam-1',
      currentExamId: 'exam-2', // divergência temporária
      activeExamId: 'exam-2',
    });

    // Não deve disparar select_exam('exam-1') de volta!
    expect(res.action).toEqual({ type: 'noop' });
    expect(res.nextLastSyncedExamId).toBe('exam-1');
  });

  it('prova inexistente na lista de exames redireciona para exams', () => {
    const route: Route = { type: 'exam_step', examId: 'exam-inexistente', step: 'criar' };
    const res = decideRouteSync({
      route,
      exams: dummyExams,
      lastSyncedExamId: null,
      currentExamId: '',
      activeExamId: null,
    });

    expect(res.action).toEqual({ type: 'redirect_to_exams' });
    expect(res.nextLastSyncedExamId).toBeNull();
  });

  it('lista de exames vazia (carregando) não redireciona e retorna noop', () => {
    const route: Route = { type: 'exam_step', examId: 'exam-1', step: 'criar' };
    const res = decideRouteSync({
      route,
      exams: [],
      lastSyncedExamId: null,
      currentExamId: '',
      activeExamId: null,
    });

    expect(res.action).toEqual({ type: 'noop' });
    expect(res.nextLastSyncedExamId).toBeNull();
  });

  it('rota scanner com prova ativa dispara select_none e limpa lastSynced', () => {
    const route: Route = { type: 'scanner' };
    const res = decideRouteSync({
      route,
      exams: dummyExams,
      lastSyncedExamId: 'exam-1',
      currentExamId: 'exam-1',
      activeExamId: 'exam-1',
    });

    expect(res.action).toEqual({ type: 'select_none' });
    expect(res.nextLastSyncedExamId).toBeNull();
  });

  it('rota scanner sem prova ativa retorna noop e limpa lastSynced', () => {
    const route: Route = { type: 'scanner' };
    const res = decideRouteSync({
      route,
      exams: dummyExams,
      lastSyncedExamId: null,
      currentExamId: '',
      activeExamId: null,
    });

    expect(res.action).toEqual({ type: 'noop' });
    expect(res.nextLastSyncedExamId).toBeNull();
  });

  it('demais rotas (ex: exams, classes) retornam noop e limpam lastSynced', () => {
    const route: Route = { type: 'exams' };
    const res = decideRouteSync({
      route,
      exams: dummyExams,
      lastSyncedExamId: 'exam-1',
      currentExamId: 'exam-1',
      activeExamId: 'exam-1',
    });

    expect(res.action).toEqual({ type: 'noop' });
    expect(res.nextLastSyncedExamId).toBeNull();
  });
});

