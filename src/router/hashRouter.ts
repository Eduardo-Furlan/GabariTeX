import { useState, useEffect, useCallback } from 'react';

export type StepId = 'criar' | 'versoes' | 'imprimir' | 'corrigir' | 'notas';

export type Route =
  | { type: 'exams' }
  | { type: 'classes' }
  | { type: 'scanner' }
  | { type: 'exam_step'; examId: string; step: StepId };

export const VALID_STEPS: StepId[] = ['criar', 'versoes', 'imprimir', 'corrigir', 'notas'];

export function isValidStep(step: string): step is StepId {
  return VALID_STEPS.includes(step as StepId);
}

/**
 * Converte um hash da URL (ex: "#/prova/123/criar?debug=1") para um objeto Route tipado.
 */
export function parseHash(rawHash: string): Route {
  const clean = rawHash.replace(/^#\/?/, '').trim();
  const [pathPart] = clean.split('?');

  if (!pathPart) {
    return { type: 'exams' };
  }

  const segments = pathPart.split('/').filter(Boolean);

  if (segments.length === 0) {
    return { type: 'exams' };
  }

  const first = segments[0].toLowerCase();

  if (first === 'provas' || first === 'biblioteca') {
    return { type: 'exams' };
  }

  if (first === 'turmas') {
    return { type: 'classes' };
  }

  if (first === 'corretor' || first === 'scanner' || first === 'corrigir') {
    return { type: 'scanner' };
  }

  if (first === 'prova' && segments.length >= 2) {
    const examId = decodeURIComponent(segments[1]);
    const stepPart = segments[2]?.toLowerCase();
    const step: StepId = isValidStep(stepPart) ? stepPart : 'criar';
    return { type: 'exam_step', examId, step };
  }

  return { type: 'exams' };
}

/**
 * Converte um objeto Route de volta para o hash da URL (ex: "#/prova/123/criar"),
 * preservando parâmetros como ?debug=1 caso existam no location atual.
 */
export function formatHash(route: Route, currentSearch?: string): string {
  let path = '';
  switch (route.type) {
    case 'exams':
      path = '/provas';
      break;
    case 'classes':
      path = '/turmas';
      break;
    case 'scanner':
      path = '/corretor';
      break;
    case 'exam_step':
      path = `/prova/${encodeURIComponent(route.examId)}/${route.step}`;
      break;
  }

  const search =
    currentSearch !== undefined
      ? currentSearch
      : typeof window !== 'undefined'
      ? window.location.search
      : '';

  const cleanSearch = search.startsWith('?') ? search : search ? `?${search}` : '';
  return `#${path}${cleanSearch}`;
}

export function useHashRouter() {
  const [route, setRoute] = useState<Route>(() => {
    if (typeof window === 'undefined') return { type: 'exams' };
    return parseHash(window.location.hash);
  });

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHash(window.location.hash));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((target: Route) => {
    if (typeof window === 'undefined') return;
    const newHash = formatHash(target);
    setRoute(target);
    if (window.location.hash !== newHash) {
      window.location.hash = newHash;
    }
  }, []);

  const navigateToExamStep = useCallback(
    (examId: string, step: StepId) => {
      navigate({ type: 'exam_step', examId, step });
    },
    [navigate]
  );

  return { route, navigate, navigateToExamStep };
}

