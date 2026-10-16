import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import 'katex/dist/katex.min.css';

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    console.error('Unhandled runtime error:', event.error || event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary fallbackTitle="Erro inesperado no GabariTeX">
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

