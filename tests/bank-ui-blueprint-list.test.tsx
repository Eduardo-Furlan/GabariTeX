import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { BlueprintList } from '../src/components/bank/BlueprintList';
import { BankProvider } from '../src/context/BankContext';
import { MemoryProfileStore } from '../src/storage/memoryProfileStore';
import { Blueprint, BankGroup, BankTag } from '../src/types/bank';

describe('BlueprintList UI (Plano 15 §6.4, Fase 8)', () => {
  it('renderiza estado vazio quando não há modelos cadastrados', () => {
    const store = new MemoryProfileStore();
    const html = renderToString(
      <BankProvider store={store}>
        <BlueprintList onNavigate={() => {}} />
      </BankProvider>
    );

    expect(html).toContain('Nenhum modelo de prova cadastrado');
    expect(html).toContain('Criar Primeiro Modelo');
  });

  it('renderiza modelos com contagem de blocos, questões e status OK', () => {
    const group: BankGroup = {
      id: 'g-geo',
      parentId: null,
      name: 'Geometria',
      order: 0,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const bp: Blueprint = {
      id: 'bp-1',
      name: 'Simulado de Geometria',
      description: 'Prova cobrindo ângulos e triângulos',
      blocks: [
        {
          id: 'b-1',
          source: { kind: 'group', groupId: 'g-geo', includeSubgroups: true },
          quotas: [
            { id: 'q-1', count: 5, filter: { tagIds: [], notTagIds: [] } },
            { id: 'q-2', count: 3, filter: { tagIds: [], notTagIds: [] } },
          ],
        },
      ],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const html = renderToString(
      <BankProvider initialData={{ groups: [group], blueprints: [bp] }}>
        <BlueprintList onNavigate={() => {}} />
      </BankProvider>
    );

    expect(html).toContain('Simulado de Geometria');
    expect(html).toContain('Prova cobrindo ângulos e triângulos');
    expect(html).toContain('1 bloco');
    expect(html).toContain('8 questões');
    expect(html).toContain('OK');
    expect(html).toContain('Gerar');
  });

  it('exibe alerta de grupo removido quando o modelo referencia grupo que não existe', () => {
    const bp: Blueprint = {
      id: 'bp-broken',
      name: 'Modelo Órfão',
      blocks: [
        {
          id: 'b-1',
          source: { kind: 'group', groupId: 'g-inexistente', includeSubgroups: false },
          quotas: [{ id: 'q-1', count: 4, filter: { tagIds: [], notTagIds: [] } }],
        },
      ],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const html = renderToString(
      <BankProvider initialData={{ groups: [], blueprints: [bp] }}>
        <BlueprintList onNavigate={() => {}} />
      </BankProvider>
    );

    expect(html).toContain('Modelo Órfão');
    expect(html).toContain('Grupo removido');
  });

  it('exibe alerta de etiqueta removida quando o modelo referencia etiqueta que não existe', () => {
    const bp: Blueprint = {
      id: 'bp-tag-broken',
      name: 'Modelo Etiqueta Órfã',
      blocks: [
        {
          id: 'b-1',
          source: { kind: 'all' },
          quotas: [{ id: 'q-1', count: 2, filter: { tagIds: ['tag-inexistente'], notTagIds: [] } }],
        },
      ],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const html = renderToString(
      <BankProvider initialData={{ tags: [], blueprints: [bp] }}>
        <BlueprintList onNavigate={() => {}} />
      </BankProvider>
    );

    expect(html).toContain('Modelo Etiqueta Órfã');
    expect(html).toContain('Etiqueta removida');
  });
});
