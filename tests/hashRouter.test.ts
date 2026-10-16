import { describe, it, expect } from 'vitest';
import { parseHash, formatHash, Route } from '../src/router/hashRouter';

describe('hashRouter (Plano 10 §2.7 & §5)', () => {
  it('converte #/provas para rota de biblioteca de provas', () => {
    expect(parseHash('#/provas')).toEqual({ type: 'exams' });
    expect(parseHash('#provas')).toEqual({ type: 'exams' });
    expect(parseHash('#/biblioteca')).toEqual({ type: 'exams' });
  });

  it('converte #/turmas para rota de turmas', () => {
    expect(parseHash('#/turmas')).toEqual({ type: 'classes' });
    expect(parseHash('#turmas')).toEqual({ type: 'classes' });
  });

  it('converte rotas de etapas da prova ativa', () => {
    expect(parseHash('#/prova/mat-2026/criar')).toEqual({
      type: 'exam_step',
      examId: 'mat-2026',
      step: 'criar',
    });
    expect(parseHash('#/prova/mat-2026/versoes')).toEqual({
      type: 'exam_step',
      examId: 'mat-2026',
      step: 'versoes',
    });
    expect(parseHash('#/prova/mat-2026/imprimir')).toEqual({
      type: 'exam_step',
      examId: 'mat-2026',
      step: 'imprimir',
    });
    expect(parseHash('#/prova/mat-2026/corrigir')).toEqual({
      type: 'exam_step',
      examId: 'mat-2026',
      step: 'corrigir',
    });
    expect(parseHash('#/prova/mat-2026/notas')).toEqual({
      type: 'exam_step',
      examId: 'mat-2026',
      step: 'notas',
    });
  });

  it('assume step criar se a etapa for omitida ou invalida', () => {
    expect(parseHash('#/prova/mat-2026')).toEqual({
      type: 'exam_step',
      examId: 'mat-2026',
      step: 'criar',
    });
    expect(parseHash('#/prova/mat-2026/etapa-inexistente')).toEqual({
      type: 'exam_step',
      examId: 'mat-2026',
      step: 'criar',
    });
  });

  it('redireciona rotas invalidas ou vazias para #/provas', () => {
    expect(parseHash('')).toEqual({ type: 'exams' });
    expect(parseHash('#')).toEqual({ type: 'exams' });
    expect(parseHash('#/')).toEqual({ type: 'exams' });
    expect(parseHash('#/rota-maluca-xyz')).toEqual({ type: 'exams' });
    expect(parseHash('#/prova')).toEqual({ type: 'exams' });
  });

  it('formata rotas corretamente', () => {
    expect(formatHash({ type: 'exams' }, '')).toBe('#/provas');
    expect(formatHash({ type: 'classes' }, '')).toBe('#/turmas');
    expect(
      formatHash({ type: 'exam_step', examId: 'prova-123', step: 'corrigir' }, '')
    ).toBe('#/prova/prova-123/corrigir');
  });

  it('preserva query param ?debug=1 na formatacao e no parsing', () => {
    const route = parseHash('#/prova/mat-1/corrigir?debug=1');
    expect(route).toEqual({
      type: 'exam_step',
      examId: 'mat-1',
      step: 'corrigir',
    });

    const formatted = formatHash(route, '?debug=1');
    expect(formatted).toBe('#/prova/mat-1/corrigir?debug=1');
  });

  it('garante paridade total de ida e volta (round-trip)', () => {
    const routes: Route[] = [
      { type: 'exams' },
      { type: 'classes' },
      { type: 'exam_step', examId: 'fisica-1', step: 'criar' },
      { type: 'exam_step', examId: 'fisica-1', step: 'versoes' },
      { type: 'exam_step', examId: 'fisica-1', step: 'imprimir' },
      { type: 'exam_step', examId: 'fisica-1', step: 'corrigir' },
      { type: 'exam_step', examId: 'fisica-1', step: 'notas' },
    ];

    for (const r of routes) {
      const hash = formatHash(r, '');
      const parsed = parseHash(hash);
      expect(parsed).toEqual(r);
    }
  });
});

