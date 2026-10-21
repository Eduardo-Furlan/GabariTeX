import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { GroupTree, areGroupSelectionsEqual, GroupSelection } from '../src/components/bank/GroupTree';
import { GroupPicker } from '../src/components/bank/GroupPicker';
import { GroupDeleteDialog } from '../src/components/bank/GroupDeleteDialog';
import { BankProvider } from '../src/context/BankContext';
import { MemoryProfileStore } from '../src/storage/memoryProfileStore';
import { BankGroup, BankQuestion } from '../src/types/bank';

describe('GroupTree and Group Components (Plano 15 §6.2, Fase 4)', () => {
  const store = new MemoryProfileStore();

  const sampleGroups: BankGroup[] = [
    { id: 'g-mat', parentId: null, name: 'Matemática', order: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    { id: 'g-geo', parentId: 'g-mat', name: 'Geometria', order: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    { id: 'g-euc', parentId: 'g-geo', name: 'Euclidiana', order: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  ];

  const sampleQuestions: BankQuestion[] = [
    {
      id: 'q1',
      groupId: 'g-euc',
      type: 'objective',
      prompt: 'Questão',
      points: 1,
      tagIds: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  it('areGroupSelectionsEqual compara corretamente seleções', () => {
    expect(areGroupSelectionsEqual({ kind: 'all' }, { kind: 'all' })).toBe(true);
    expect(areGroupSelectionsEqual({ kind: 'all' }, { kind: 'orphan' })).toBe(false);
    expect(areGroupSelectionsEqual({ kind: 'group', groupId: 'g1' }, { kind: 'group', groupId: 'g1' })).toBe(true);
    expect(areGroupSelectionsEqual({ kind: 'group', groupId: 'g1' }, { kind: 'group', groupId: 'g2' })).toBe(false);
  });

  it('GroupPicker renderiza opções formatadas com pathOf e respeita exclusões', () => {
    const html = renderToString(
      <GroupPicker
        groups={sampleGroups}
        value="g-euc"
        onChange={() => {}}
        excludeGroupIds={new Set(['g-geo', 'g-euc'])}
      />
    );

    // Contém opção raiz e apenas Matemática (já que Geometria e Euclidiana foram excluídas)
    expect(html).toContain('Raiz (Nível Superior)');
    expect(html).toContain('Matemática');
  });

  it('GroupDeleteDialog renderiza em SSR sem erros', () => {
    expect(() =>
      renderToString(
        <GroupDeleteDialog
          open={true}
          onOpenChange={() => {}}
          group={sampleGroups[0]}
          groups={sampleGroups}
          questions={sampleQuestions}
          onConfirm={async () => true}
        />
      )
    ).not.toThrow();
  });

  it('GroupTree renderiza em SSR sem erros', () => {
    const html = renderToString(
      <BankProvider store={store}>
        <GroupTree
          selected={{ kind: 'all' }}
          onSelect={() => {}}
        />
      </BankProvider>
    );

    expect(html).toContain('Grupos');
    expect(html).toContain('Todas as Questões');
    expect(html).toContain('Sem Grupo');
  });

  it('renderiza nó de grupo com ações ocultas (hidden) em repouso e atributo title no nome longo', () => {
    const longName = 'História Contemporânea e Relações Internacionais';
    const longNameGroup: BankGroup = {
      id: 'g-longo',
      parentId: null,
      name: longName,
      order: 0,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const html = renderToString(
      <BankProvider initialData={{ groups: [longNameGroup], questions: [] }}>
        <GroupTree
          selected={{ kind: 'all' }}
          onSelect={() => {}}
        />
      </BankProvider>
    );

    // O nome possui o atributo title para suportar visualização completa via tooltip
    expect(html).toContain(`title="${longName}"`);
    expect(html).toContain(longName);

    // O container de ações rápidas possui hidden por padrão (não reserva espaço em repouso)
    expect(html).toContain('hidden group-hover:flex group-focus-within:flex');
  });
});
