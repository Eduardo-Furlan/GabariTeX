import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ExamsScreen } from '../src/screens/ExamsScreen';
import * as ProfileContextModule from '../src/context/ProfileContext';
import { ExamMeta } from '../types/profile';

describe('UI ExamsScreen (Library)', () => {
  it('renders the library screen in SSR with empty state and Folha Óptica typography', () => {
    const html = renderToString(
      <ProfileContextModule.ProfileProvider>
        <ExamsScreen onNavigate={() => {}} onOpenExportImport={() => {}} />
      </ProfileContextModule.ProfileProvider>
    );

    expect(html).toBeTruthy();
    expect(html).toContain('Biblioteca de Provas');
    expect(html).toContain('font-display');
    expect(html).toContain('text-headline');
    expect(html).toContain('Nova Prova');
    expect(html).toContain('Importar Perfil');
    expect(html).toContain('Modelo Matemática');
    expect(html).toContain('screen-enter');
    // Empty state should be visible when exams is empty
    expect(html).toContain('Nenhuma avaliação cadastrada ainda');
    expect(html).toContain('Criar Prova do Zero');
    expect(html).toContain('Usar Prova Modelo');
  });

  it('renders exam cards with active rail, Bubble check for notes, and accessible search count', () => {
    const mockExams: ExamMeta[] = [
      {
        id: 'exam-active-1',
        name: 'Avaliação Trimestral de Física',
        createdAt: '2026-03-01T10:00:00.000Z',
        updatedAt: '2026-03-02T15:30:00.000Z',
        questionCount: 10,
        recordCount: 25,
      },
      {
        id: 'exam-other-2',
        name: 'Simulado de Química',
        createdAt: '2026-02-15T08:00:00.000Z',
        updatedAt: '2026-02-20T12:00:00.000Z',
        questionCount: 5,
        recordCount: 0,
      },
    ];

    vi.spyOn(ProfileContextModule, 'useProfile').mockReturnValue({
      exams: mockExams,
      activeExamId: 'exam-active-1',
      selectActiveExam: vi.fn(),
      createExam: vi.fn(),
      loadSampleMathExam: vi.fn(),
      duplicateExam: vi.fn(),
      renameExam: vi.fn(),
      deleteExam: vi.fn(),
      shareExam: vi.fn(),
    } as any);

    const html = renderToString(
      <ExamsScreen onNavigate={() => {}} onOpenExportImport={() => {}} />
    );

    // Search header with tabular-nums and live region
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('tabular-nums');
    expect(html).toContain('2 provas');

    // Cards
    expect(html).toContain('Avaliação Trimestral de Física');
    expect(html).toContain('Simulado de Química');

    // Active rail and badge
    expect(html).toContain('border-l-[3px]');
    expect(html).toContain('Prova Ativa');

    // Notes with Bubble check
    expect(html).toContain('Notas corrigidas');
    expect(html).toContain('25 notas corrigidas');

    // Card action icon buttons
    expect(html).toContain('aria-label="Renomear prova"');
    expect(html).toContain('aria-label="Duplicar prova"');
    expect(html).toContain('aria-label="Exportar esta prova (ZIP)"');
    expect(html).toContain('aria-label="Excluir prova"');

    // Primary action on cards
    expect(html).toContain('Continuar Editando');
    expect(html).toContain('Abrir Prova');

    vi.restoreAllMocks();
  });
});

