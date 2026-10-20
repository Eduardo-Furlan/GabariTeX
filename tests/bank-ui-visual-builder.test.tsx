import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  VisualRuleBuilder,
  sourceExprToVisual,
  visualToSourceExpr,
} from '../src/components/generator/VisualRuleBuilder';
import { Blueprint, BankGroup, BankTag, BankQuestion, SourceExpr } from '../src/types/bank';

describe('VisualRuleBuilder UI & SourceExpr Mapping (Plano 15 §6.4, Fase 8)', () => {
  it('converte SourceExpr para estado visual e vice-versa com operadores e exceções', () => {
    // 1. All
    const allExpr: SourceExpr = { kind: 'all' };
    const allVis = sourceExprToVisual(allExpr);
    expect(allVis.groups).toHaveLength(0);
    expect(visualToSourceExpr(allVis)).toEqual({ kind: 'all' });

    // 2. Single group
    const singleExpr: SourceExpr = { kind: 'group', groupId: 'g1', descendants: true };
    const singleVis = sourceExprToVisual(singleExpr);
    expect(singleVis.groups).toEqual([{ groupId: 'g1', descendants: true }]);
    expect(visualToSourceExpr(singleVis)).toEqual(singleExpr);

    // 3. AND of groups with EXCEPT
    const complexExpr: SourceExpr = {
      kind: 'except',
      base: {
        kind: 'and',
        operands: [
          { kind: 'group', groupId: 'g1', descendants: true },
          { kind: 'group', groupId: 'g2', descendants: false },
        ],
      },
      excluded: { kind: 'group', groupId: 'g3', descendants: false },
    };

    const complexVis = sourceExprToVisual(complexExpr);
    expect(complexVis.op).toBe('and');
    expect(complexVis.groups).toHaveLength(2);
    expect(complexVis.exceptGroupIds).toEqual(['g3']);

    const backToExpr = visualToSourceExpr(complexVis);
    expect(backToExpr).toEqual(complexExpr);
  });

  it('renderiza blocos, operadores, linhas de cota e disponibilidade em tempo real', () => {
    const group: BankGroup = {
      id: 'g-mat',
      parentId: null,
      name: 'Matemática',
      order: 0,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const question: BankQuestion = {
      id: 'q-1',
      groupId: 'g-mat',
      type: 'objective',
      prompt: 'Quanto é 2 + 2?',
      points: 1,
      options: [
        { id: 'o1', label: 'A', text: '4', isCorrect: true },
        { id: 'o2', label: 'B', text: '5', isCorrect: false },
      ],
      tagIds: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const bp: Blueprint = {
      id: 'bp-1',
      name: 'Modelo de Teste',
      blocks: [
        {
          id: 'b-1',
          source: { kind: 'group', groupId: 'g-mat', descendants: true },
          quotas: [
            {
              id: 'qline-1',
              count: 2,
              filter: { tagIds: [], notTagIds: [] },
            },
          ],
        },
      ],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const html = renderToString(
      <VisualRuleBuilder
        blueprint={bp}
        onChange={() => {}}
        groups={[group]}
        tags={[]}
        questions={[question]}
      />
    );

    expect(html).toContain('Bloco 1');
    expect(html).toContain('Sortear de qualquer um (OU)');
    expect(html).toContain('Matemática');
    expect(html).toContain('1 disponíveis (insuficiente)');
    expect(html).toContain('necessárias 2 questões, mas apenas 1 estão disponíveis');
  });
});
