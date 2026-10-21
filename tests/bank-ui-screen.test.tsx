import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { BankScreen } from '../src/screens/BankScreen';
import { BankProvider } from '../src/context/BankContext';
import { MemoryProfileStore } from '../src/storage/memoryProfileStore';
import { BankGroup, BankQuestion } from '../src/types/bank';

describe('BankScreen UI Integration (Plano 15 §6.2, Fase 4)', () => {
  it('renderiza tela com estado vazio quando não há questões', () => {
    const store = new MemoryProfileStore();
    const html = renderToString(
      <BankProvider store={store}>
        <BankScreen onNavigate={() => {}} />
      </BankProvider>
    );

    expect(html).toContain('Banco de Questões');
    expect(html).toContain('Seu banco de questões está vazio');
    expect(html).toContain('Criar Primeira Questão');
  });

  it('renderiza árvore de grupos e lista quando há questões no banco', () => {
    const group: BankGroup = {
      id: 'g-fisica',
      parentId: null,
      name: 'Física',
      order: 0,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
    const question: BankQuestion = {
      id: 'q-dinamica',
      groupId: 'g-fisica',
      type: 'objective',
      prompt: 'Calcule a aceleração de um corpo de massa 2 kg sob força de 10 N.',
      points: 2,
      options: [
        { id: 'o1', label: 'A', text: '5 m/s²', isCorrect: true },
        { id: 'o2', label: 'B', text: '10 m/s²', isCorrect: false },
      ],
      tagIds: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const html = renderToString(
      <BankProvider initialData={{ groups: [group], questions: [question] }}>
        <BankScreen onNavigate={() => {}} />
      </BankProvider>
    );

    expect(html).toContain('Banco de Questões');
    expect(html).toContain('Física');
    expect(html).toContain('Calcule a aceleração');
    expect(html).toContain('Nova Questão');
    expect(html).toContain('Gerar Prova');
    expect(html).toContain('Etiquetas');
  });
});
