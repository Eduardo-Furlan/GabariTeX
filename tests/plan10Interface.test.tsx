import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { App } from '../src/App';
import { StepTabs } from '../src/components/navigation/StepTabs';
import { MobileTabBar } from '../src/components/navigation/MobileTabBar';
import { AppHeader } from '../src/components/navigation/AppHeader';
import { ContextBar } from '../src/components/navigation/ContextBar';
import { ClassroomManager } from '../src/components/classrooms/ClassroomManager';
import { ProfileProvider } from '../src/context/ProfileContext';
import { Route } from '../src/router/hashRouter';

describe('Plano 10 — Estrutura da Interface e Navegação', () => {
  it('renderiza o App com ProfileProvider e Router sem falhas no SSR / Node', () => {
    const html = renderToString(<App />);
    expect(html).toBeTruthy();
    expect(html).toContain('Carregando avaliações e perfil...');
  });

  it('StepTabs destaca aria-current="page" na etapa ativa', () => {
    const route: Route = {
      type: 'exam_step',
      examId: 'mat-1',
      step: 'corrigir',
    };

    const html = renderToString(
      <ProfileProvider>
        <StepTabs currentRoute={route} onNavigate={() => {}} />
      </ProfileProvider>
    );

    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Corrigir');
    expect(html).toContain('Criar');
    expect(html).toContain('Versões');
    expect(html).toContain('Imprimir');
    expect(html).toContain('Notas');
  });

  it('MobileTabBar renderiza as 5 etapas com alvos de toque e rótulos curtos', () => {
    const route: Route = {
      type: 'exam_step',
      examId: 'mat-1',
      step: 'imprimir',
    };

    const html = renderToString(
      <ProfileProvider>
        <MobileTabBar currentRoute={route} onNavigate={() => {}} />
      </ProfileProvider>
    );

    expect(html).toContain('aria-label="Navegação móvel"');
    expect(html).toContain('Criar');
    expect(html).toContain('Versões');
    expect(html).toContain('Imprimir');
    expect(html).toContain('Corrigir');
    expect(html).toContain('Notas');
    expect(html).toContain('min-h-[44px]');
  });

  it('AppHeader renderiza as áreas de Provas e Turmas e o menu de Perfil', () => {
    const route: Route = { type: 'exams' };

    const html = renderToString(
      <ProfileProvider>
        <AppHeader
          currentRoute={route}
          onNavigate={() => {}}
          onOpenExportImport={() => {}}
        />
      </ProfileProvider>
    );

    expect(html).toContain('Provas');
    expect(html).toContain('Turmas');
    expect(html).toContain('Perfil');
  });

  it('ContextBar exibe seletores de Prova e Turma', () => {
    const route: Route = { type: 'exams' };

    const html = renderToString(
      <ProfileProvider>
        <ContextBar currentRoute={route} onNavigate={() => {}} />
      </ProfileProvider>
    );

    expect(html).toContain('Prova:');
    expect(html).toContain('Turma:');
  });

  it('ClassroomManager renderiza com segurança mesmo se a turma tiver students undefined', () => {
    const malformedClass = {
      id: 'c-legacy-1',
      name: '3º Ano B (Legado)',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    expect(() => {
      renderToString(
        <ClassroomManager
          isOpen={true}
          onClose={() => {}}
          classes={[malformedClass as any]}
          activeClassId={'c-legacy-1'}
          onSelectActiveClass={() => {}}
          onUpdateClasses={() => {}}
          records={[]}
          onDisassociateRecordsFromClass={() => {}}
          asScreen={true}
        />
      );
    }).not.toThrow();
  });
});

