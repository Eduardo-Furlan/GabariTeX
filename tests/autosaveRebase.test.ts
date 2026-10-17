import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutosaveManager } from '../src/hooks/useAutosave';

describe('AutosaveManager.rebase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updateValue(A) seguido de rebase(B) grava A uma vez e não agenda gravação de B', () => {
    const savedValues: string[] = [];
    const saveFn = (val: string) => {
      savedValues.push(val);
      return { ok: true };
    };

    const manager = new AutosaveManager<string>('initial', saveFn, 400);

    // Usuário edita A
    manager.updateValue('A-edited');
    expect(manager.hasPendingSave).toBe(true);
    expect(savedValues).toHaveLength(0);

    // Troca para prova B via rebase antes de decorrerem os 400ms
    manager.rebase('B-fresh');

    // A deve ter sido gravado imediatamente via flush
    expect(savedValues).toEqual(['A-edited']);
    // B não deve ter gravação pendente
    expect(manager.hasPendingSave).toBe(false);

    // Avança o tempo do debounce
    vi.advanceTimersByTime(1000);
    // Nenhuma gravação extra deve ter ocorrido
    expect(savedValues).toEqual(['A-edited']);
  });

  it('sem pendência, rebase(B) não chama saveFn', () => {
    const savedValues: string[] = [];
    const saveFn = (val: string) => {
      savedValues.push(val);
      return { ok: true };
    };

    const manager = new AutosaveManager<string>('A', saveFn, 400);

    // Rebase direto sem edições pendentes
    manager.rebase('B');

    expect(savedValues).toHaveLength(0);
    expect(manager.hasPendingSave).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(savedValues).toHaveLength(0);
  });

  it('após rebase, updateValue(B2) volta a gravar normalmente', () => {
    const savedValues: string[] = [];
    const saveFn = (val: string) => {
      savedValues.push(val);
      return { ok: true };
    };

    const manager = new AutosaveManager<string>('A', saveFn, 400);
    manager.rebase('B');

    // Usuário edita B
    manager.updateValue('B-edited');
    expect(manager.hasPendingSave).toBe(true);

    vi.advanceTimersByTime(400);
    expect(savedValues).toEqual(['B-edited']);
    expect(manager.hasPendingSave).toBe(false);
  });
});
