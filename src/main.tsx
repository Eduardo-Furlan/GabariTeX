import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/bricolage-grotesque/wght.css';
import '@fontsource-variable/instrument-sans/wght.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import './styles/tokens.css';
import './styles/motion.css';
import 'katex/dist/katex.min.css';
import { MotionProvider } from './ui/motion/MotionProvider';

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
      <MotionProvider>
        <App />
      </MotionProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
