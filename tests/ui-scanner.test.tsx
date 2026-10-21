import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ScannerScreen } from '../src/screens/ScannerScreen';
import { PhotoUploader } from '../src/components/scanner/PhotoUploader';
import { BatchGrader } from '../src/components/scanner/BatchGrader';
import { GradingModal } from '../src/components/scanner/GradingModal';
import { AnswerChoiceGroup } from '../src/components/scanner/AnswerChoiceGroup';
import { SubjectiveScoreInput } from '../src/components/scanner/SubjectiveScoreInput';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { ProfileProvider } from '../src/context/ProfileContext';
import { GradingRecord } from '../src/types/exam';

const dummyRecord: GradingRecord = {
  id: 'rec-1',
  examId: 'exam-1',
  versionLetter: 'A',
  studentName: 'Maria Silva',
  studentId: '2026-101',
  timestamp: 1700000000,
  totalScore: 8.5,
  maxScore: 10,
  percentage: 85,
  answers: [
    {
      questionNumber: 1,
      markedOption: 'B',
      detectedOption: 'B',
      correctOption: 'B',
      isCorrect: true,
      pointsEarned: 2,
      maxPoints: 2,
      status: 'correct',
      needsReview: false,
    },
    {
      questionNumber: 2,
      markedOption: 'A',
      detectedOption: 'A',
      correctOption: 'C',
      isCorrect: false,
      pointsEarned: 0,
      maxPoints: 2,
      status: 'wrong',
      needsReview: false,
    },
  ],
};

describe('UI Scanner (Phase 7: Folha Óptica)', () => {
  it('ScannerScreen no ambiente web renderiza tela de aviso para download do app desktop', () => {
    vi.stubGlobal('__DESKTOP__', false);
    const html = renderToString(
      <ProfileProvider>
        <ScannerScreen onNavigate={() => {}} />
      </ProfileProvider>
    );

    expect(html).toContain('Corretor Óptico (OMR) no GabariTeX Desktop');
    expect(html).toContain('Baixar GabariTeX Desktop (GitHub Releases)');
    expect(html).toContain('Continuar na Versão Web');
    expect(html).toContain('100% de Compatibilidade entre Web e Desktop');
    expect(html).not.toContain('Sessão de Correção');
  });

  it('ScannerScreen no ambiente desktop renderiza painel de Sessão de Correção e modos', () => {
    vi.stubGlobal('__DESKTOP__', true);
    const html = renderToString(
      <ProfileProvider>
        <ScannerScreen onNavigate={() => {}} />
      </ProfileProvider>
    );

    expect(html).toContain('Sessão de Correção');
    expect(html).toContain('Foto Individual');
    expect(html).toContain('Em Lote');
    expect(html).toContain('hidden-qr-reader');
  });

  it('PhotoUploader renders hidden-qr-reader id, dropzone, and QR target option', () => {
    const html = renderToString(
      <PhotoUploader
        teacherPassword="secret-password"
        candidatePasswords={['secret-password']}
        activePayload={null}
        onGraded={() => {}}
      />
    );

    expect(html).toContain('id="hidden-qr-reader"');
    expect(html).toContain('Leitor Óptico de Gabaritos');
    expect(html).toContain('1. Ler QR Code da Prova');
    expect(html).toContain('2. Ler Folha de Gabarito');
  });

  it('AnswerChoiceGroup renders option bubbles, Branco, and Rasura with radiogroup semantics', () => {
    const html = renderToString(
      <AnswerChoiceGroup
        value="B"
        onChange={() => {}}
      />
    );

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Opções de resposta"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('Branco');
    expect(html).toContain('Rasura');
  });

  it('SubjectiveScoreInput renders question number, max points, and quick grade buttons', () => {
    const html = renderToString(
      <SubjectiveScoreInput
        questionNumber={3}
        maxPoints={2.5}
        pointsEarned={1.5}
        onChange={() => {}}
      />
    );

    expect(html).toContain('Q3');
    expect(html).toContain('máx 2,5');
    expect(html).toContain('value="1,5"');
    expect(html).toContain('Lançada');
  });

  it('BatchGrader renders summary header and file dropzone', () => {
    const html = renderToString(
      <BatchGrader
        teacherPassword="test"
        activePayload={null}
        onSaveRecords={() => {}}
      />
    );

    expect(html).toContain('Correção Contínua em Lote');
    expect(html).toContain('Clique aqui ou arraste várias fotos das folhas de respostas');
  });

  it('GradingModal renders via SSR without throwing', () => {
    expect(() => {
      renderToString(
        <GradingModal
          initialRecord={dummyRecord}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );
    }).not.toThrow();
  });

  it('ErrorBoundary renders fallback title and error message', () => {
    const boundary = new ErrorBoundary({ children: null, fallbackTitle: 'Falha no OMR' });
    boundary.state = {
      hasError: true,
      error: new Error('Erro de teste do scanner'),
      errorInfo: null,
      copied: false,
    };
    const html = renderToString(boundary.render() as React.ReactElement);
    expect(html).toContain('Falha no OMR');
    expect(html).toContain('Erro de teste do scanner');
  });
});
