import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PhotoUploader } from '../src/components/scanner/PhotoUploader';
import { BatchGrader } from '../src/components/scanner/BatchGrader';
import { App } from '../src/App';
import { ErrorBoundary } from '../src/components/ErrorBoundary';

describe('Scanner components render check', () => {
  it('renders PhotoUploader without crashing', () => {
    const html = renderToString(
      <PhotoUploader
        teacherPassword="test"
        candidatePasswords={['test']}
        activePayload={null}
        onGraded={() => {}}
      />
    );
    expect(html).toContain('hidden-qr-reader');
  });

  it('renders App without crashing', () => {
    const html = renderToString(<App />);
    expect(html).toBeTruthy();
  });

  it('ErrorBoundary renders fallback UI when in error state', () => {
    const boundary = new ErrorBoundary({ children: null, fallbackTitle: 'Erro no Corretor OMR' });
    boundary.state = {
      hasError: true,
      error: new Error('Simulated crash in scanner'),
      errorInfo: null,
      copied: false,
    };
    const html = renderToString(boundary.render() as React.ReactElement);
    expect(html).toContain('Erro no Corretor OMR');
    expect(html).toContain('Simulated crash in scanner');
  });
});
