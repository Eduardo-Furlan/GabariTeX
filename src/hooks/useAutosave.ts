import { useState, useEffect, useRef, useCallback } from 'react';
import { SaveResult } from '../utils/storage';

export interface AutosaveState {
  status: 'saved' | 'saving' | 'error';
  savedAt?: Date;
  reason?: 'quota' | 'unknown';
}

/**
 * Gerenciador de salvamento com debounce e flush forçado.
 * Desacoplado do DOM para permitir testes unitários determinísticos em Node.
 */
export class AutosaveManager<T> {
  private value: T;
  private saveFn: (val: T) => SaveResult;
  private delay: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  public hasPendingSave = false;
  private onStateChange?: (state: AutosaveState) => void;

  constructor(
    initialValue: T,
    saveFn: (val: T) => SaveResult,
    delay = 400,
    onStateChange?: (state: AutosaveState) => void
  ) {
    this.value = initialValue;
    this.saveFn = saveFn;
    this.delay = delay;
    this.onStateChange = onStateChange;
  }

  public setSaveFn(saveFn: (val: T) => SaveResult) {
    this.saveFn = saveFn;
  }

  public setOnStateChange(cb: (state: AutosaveState) => void) {
    this.onStateChange = cb;
  }

  public updateValue(newValue: T) {
    this.value = newValue;
    this.hasPendingSave = true;
    this.onStateChange?.({ status: 'saving' });

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.performSave();
    }, this.delay);
  }

  public performSave() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.hasPendingSave) return;
    this.hasPendingSave = false;

    const result = this.saveFn(this.value);
    if (result.ok) {
      this.onStateChange?.({
        status: 'saved',
        savedAt: new Date(),
        reason: undefined,
      });
    } else {
      this.onStateChange?.({
        status: 'error',
        reason: result.reason,
      });
    }
  }

  public flush() {
    if (this.hasPendingSave) {
      this.performSave();
    }
  }

  public destroy() {
    this.flush();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

/**
 * Hook para salvamento automático com debounce de dados no localStorage.
 * Garante o salvamento imediato (flush) quando a aba é ocultada (visibilitychange)
 * ou fechada/trocada (pagehide).
 *
 * @param value Valor a ser salvo
 * @param saveFn Função síncrona de salvamento que retorna SaveResult
 * @param delay Atraso em milissegundos para o debounce (padrão: 400ms)
 */
export function useAutosave<T>(
  value: T,
  saveFn: (val: T) => SaveResult,
  delay = 400
): AutosaveState & { flush: () => void } {
  const [state, setState] = useState<AutosaveState>({
    status: 'saved',
    savedAt: new Date(),
  });

  const managerRef = useRef<AutosaveManager<T> | null>(null);
  const isInitialMount = useRef<boolean>(true);

  if (!managerRef.current) {
    managerRef.current = new AutosaveManager(value, saveFn, delay, setState);
  }

  managerRef.current.setSaveFn(saveFn);
  managerRef.current.setOnStateChange(setState);

  const flush = useCallback(() => {
    managerRef.current?.flush();
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    managerRef.current?.updateValue(value);
  }, [value]);

  // Garante flush ao alternar abas, ocultar aplicativo ou descarregar a página
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        managerRef.current?.flush();
      }
    };

    const handlePageHide = () => {
      managerRef.current?.flush();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', handlePageHide);
    }

    return () => {
      managerRef.current?.destroy();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', handlePageHide);
      }
    };
  }, []);

  return { ...state, flush };
}

