import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { VersionsScreen } from '../src/screens/VersionsScreen';
import { PrintScreen } from '../src/screens/PrintScreen';
import * as ProfileContextModule from '../src/context/ProfileContext';
import { ExamVersion } from '../types/exam';

const mockVersionA: ExamVersion = {
  versionLetter: 'A',
  questions: [
    {
      id: 'q1',
      type: 'objective',
      prompt: 'Questão 1',
      points: 1,
      options: [
        { id: 'opt1', label: 'A', text: 'Opção 1', isCorrect: true },
        { id: 'opt2', label: 'B', text: 'Opção 2', isCorrect: false },
      ],
    },
    {
      id: 'q2',
      type: 'subjective',
      prompt: 'Questão 2',
      points: 2,
      linesForAnswer: 6,
    },
  ],
  objectiveAnswerKey: { 1: 'A' },
  encryptedPayload: 'ENCRYPTED_PAYLOAD_TEST',
};

describe('UI Versions & Print Screens (Phase 6)', () => {
  it('renders VersionsScreen in SSR with Segmented version selector, Surface, and Bubble answer key', () => {
    vi.spyOn(ProfileContextModule, 'useProfile').mockReturnValue({
      exam: { header: { examTitle: 'Prova 1' }, questions: [] },
      versions: [mockVersionA],
      selectedVersionLetter: 'A',
      setSelectedVersionLetter: vi.fn(),
    } as any);

    const html = renderToString(<VersionsScreen />);

    expect(html).toBeTruthy();
    expect(html).toContain('screen-enter');
    expect(html).toContain('Versões Randomizadas');
    expect(html).toContain('Visualizar Versão:');
    expect(html).toContain('radiogroup');
    expect(html).toContain('Gabarito Oficial (Versão A)');
    expect(html).toContain('Protegido por Senha');
    expect(html).toContain('Q1');
    expect(html).toContain('Dissertativa');

    vi.restoreAllMocks();
  });

  it('renders PrintScreen in SSR with Segmented print-mode picker, desk-surface, and Print button', () => {
    vi.spyOn(ProfileContextModule, 'useProfile').mockReturnValue({
      exam: { header: { examTitle: 'Prova 1' }, questions: [] },
      versions: [mockVersionA],
      selectedVersionLetter: 'A',
      setSelectedVersionLetter: vi.fn(),
      isExamCorrupted: false,
    } as any);

    const html = renderToString(<PrintScreen />);

    expect(html).toBeTruthy();
    expect(html).toContain('screen-enter');
    expect(html).toContain('Central de Impressão A4 / Exportação PDF');
    expect(html).toContain('Prova Completa');
    expect(html).toContain('Apenas Caderno');
    expect(html).toContain('Apenas Cartão');
    expect(html).toContain('Imprimir / Salvar PDF');
    expect(html).toContain('print-area-wrapper');
    expect(html).toContain('desk-surface');

    vi.restoreAllMocks();
  });
});
