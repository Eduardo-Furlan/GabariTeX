import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { GeneratorScreen } from '../src/screens/GeneratorScreen';
import { BankProvider } from '../src/context/BankContext';
import { ProfileProvider } from '../src/context/ProfileContext';
import { MemoryProfileStore } from '../src/storage/memoryProfileStore';
import { Blueprint, BankGroup, BankQuestion } from '../src/types/bank';

describe('GeneratorScreen UI Integration (Plano 15 §6.4, Fase 8)', () => {
  it('renderiza tela de geração com cabeçalho, seletor de modelos, construtor e barra de ações', () => {
    const store = new MemoryProfileStore();
    const group: BankGroup = {
      id: 'g-1',
      parentId: null,
      name: 'Física',
      order: 0,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const question: BankQuestion = {
      id: 'q-1',
      groupId: 'g-1',
      type: 'objective',
      prompt: 'Calcule a velocidade média.',
      points: 2,
      options: [
        { id: 'o1', label: 'A', text: '10 m/s', isCorrect: true },
        { id: 'o2', label: 'B', text: '20 m/s', isCorrect: false },
      ],
      tagIds: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const html = renderToString(
      <ProfileProvider store={store}>
        <BankProvider store={store} initialData={{ groups: [group], questions: [question] }}>
          <GeneratorScreen onNavigate={() => {}} />
        </BankProvider>
      </ProfileProvider>
    );

    expect(html).toContain('Gerar Prova');
    expect(html).toContain('Salvar');
    expect(html).toContain('Novo');
    expect(html).toContain('Visual');
    expect(html).toContain('Texto');
    expect(html).toContain('Evitar questões usadas em:');
    expect(html).toContain('Pré-visualizar Sorteio');
  });

  it('carrega modelo existente quando blueprintId é fornecido', () => {
    const store = new MemoryProfileStore();
    const bp: Blueprint = {
      id: 'bp-simulado',
      name: 'Simulado ENEM',
      blocks: [
        {
          id: 'b-1',
          source: { kind: 'all' },
          quotas: [{ id: 'q-1', count: 5, filter: { tagIds: [], notTagIds: [] } }],
        },
      ],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const html = renderToString(
      <ProfileProvider store={store}>
        <BankProvider store={store} initialData={{ blueprints: [bp] }}>
          <GeneratorScreen blueprintId="bp-simulado" onNavigate={() => {}} />
        </BankProvider>
      </ProfileProvider>
    );

    expect(html).toContain('Gerar Prova');
    expect(html).toContain('Simulado ENEM');
    expect(html).toContain('5/40');
  });
});
