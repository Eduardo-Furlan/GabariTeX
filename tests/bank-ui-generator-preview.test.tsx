import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { GeneratorPreview } from '../src/components/generator/GeneratorPreview';
import { Blueprint, BankGroup, BankQuestion } from '../src/types/bank';
import { Pick } from '../src/utils/bank/solver';

describe('GeneratorPreview UI (Plano 15 §6.4, Fase 8)', () => {
  it('renderiza cards de pré-visualização com numeração, enunciado, pontos e ações', () => {
    const group: BankGroup = {
      id: 'g-1',
      parentId: null,
      name: 'Álgebra',
      order: 0,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const question: BankQuestion = {
      id: 'q-1',
      groupId: 'g-1',
      type: 'objective',
      prompt: 'Resolva a equação 2x + 4 = 10.',
      points: 2.5,
      options: [
        { id: 'o1', label: 'A', text: 'x = 3', isCorrect: true },
        { id: 'o2', label: 'B', text: 'x = 4', isCorrect: false },
      ],
      tagIds: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const bp: Blueprint = {
      id: 'bp-1',
      name: 'Modelo de Álgebra',
      blocks: [
        {
          id: 'b-1',
          source: { kind: 'group', groupId: 'g-1', descendants: true },
          quotas: [{ id: 'qline-1', count: 1, filter: { tagIds: [], notTagIds: [] } }],
        },
      ],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const picks: Pick[] = [
      {
        questionId: 'q-1',
        blockId: 'b-1',
        lineId: 'qline-1',
        points: 2.5,
      },
    ];

    const html = renderToString(
      <GeneratorPreview
        blueprint={bp}
        groups={[group]}
        tags={[]}
        questions={[question]}
        picks={picks}
        seed={12345}
        onPicksChange={() => {}}
        onSeedChange={() => {}}
        onCreateExam={() => {}}
      />
    );

    expect(html).toContain('Resolva a equação 2x + 4 = 10.');
    expect(html).toContain('Álgebra');
    expect(html).toContain('Objetiva');
    expect(html).toContain('2.5 pts');
    expect(html).toContain('Sortear de Novo');
    expect(html).toContain('Fixar');
    expect(html).toContain('Trocar');
    expect(html).toContain('Criar Prova');
    expect(html).toContain('Total:');
  });

  it('exibe badge de repetição quando a questão está no conjunto de exclusões', () => {
    const question: BankQuestion = {
      id: 'q-rep',
      groupId: null,
      type: 'subjective',
      prompt: 'Explique a teoria da relatividade.',
      points: 5,
      options: [],
      tagIds: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const bp: Blueprint = {
      id: 'bp-1',
      name: 'Modelo Física',
      blocks: [
        {
          id: 'b-1',
          source: { kind: 'all' },
          quotas: [{ id: 'qline-1', count: 1, filter: { tagIds: [], notTagIds: [] } }],
        },
      ],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const picks: Pick[] = [
      {
        questionId: 'q-rep',
        blockId: 'b-1',
        lineId: 'qline-1',
        points: 5,
      },
    ];

    const html = renderToString(
      <GeneratorPreview
        blueprint={bp}
        groups={[]}
        tags={[]}
        questions={[question]}
        picks={picks}
        seed={42}
        onPicksChange={() => {}}
        onSeedChange={() => {}}
        excludeQuestionIds={new Set(['q-rep'])}
      />
    );

    expect(html).toContain('Já usada em outra prova');
  });
});
