import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutosaveManager, AutosaveState } from '../src/hooks/useAutosave';
import { SaveResult } from '../src/utils/storage';

describe('Gerenciador de Autosave (AutosaveManager)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('deve realizar debounce de salvamento e chamar saveFn apenas após o atraso', () => {
    const saveMock = vi.fn((_val: string): SaveResult => ({ ok: true }));
    let currentState: AutosaveState = { status: 'saved' };

    const manager = new AutosaveManager('v0', saveMock, 400, (st) => {
      currentState = st;
    });

    expect(saveMock).not.toHaveBeenCalled();
    expect(currentState.status).toBe('saved');

    // Primeira alteração
    manager.updateValue('v1');
    expect(currentState.status).toBe('saving');
    expect(saveMock).not.toHaveBeenCalled();

    // Avança 250ms (ainda não atingiu 400ms)
    vi.advanceTimersByTime(250);
    expect(saveMock).not.toHaveBeenCalled();

    // Nova alteração antes dos 400ms (reinicia debounce)
    manager.updateValue('v2');
    expect(currentState.status).toBe('saving');

    // Avança 300ms (total desde v2 é 300ms, ainda menor que 400ms)
    vi.advanceTimersByTime(300);
    expect(saveMock).not.toHaveBeenCalled();

    // Avança os 100ms restantes
    vi.advanceTimersByTime(100);
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith('v2');
    expect(currentState.status).toBe('saved');
    expect(currentState.savedAt).toBeInstanceOf(Date);
  });

  it('deve forçar salvamento pendente imediatamente ao chamar flush()', () => {
    const saveMock = vi.fn((_val: string): SaveResult => ({ ok: true }));
    let currentState: AutosaveState = { status: 'saved' };

    const manager = new AutosaveManager('v0', saveMock, 500, (st) => {
      currentState = st;
    });

    manager.updateValue('alteracao-critica');
    expect(saveMock).not.toHaveBeenCalled();

    // Chamada manual de flush() (simulando pagehide ou visibilitychange)
    manager.flush();

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith('alteracao-critica');
    expect(currentState.status).toBe('saved');

    // Avançar o tempo do timer não deve gerar uma segunda chamada
    vi.advanceTimersByTime(1000);
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it('não deve salvar no flush() se não houver alterações pendentes', () => {
    const saveMock = vi.fn((_val: string): SaveResult => ({ ok: true }));
    const manager = new AutosaveManager('v0', saveMock, 400);

    manager.flush();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('deve atualizar o estado para "error" com motivo quando saveFn falhar', () => {
    const saveMock = vi.fn((_val: string): SaveResult => ({ ok: false, reason: 'quota' }));
    let currentState: AutosaveState = { status: 'saved' };

    const manager = new AutosaveManager('v0', saveMock, 200, (st) => {
      currentState = st;
    });

    manager.updateValue('exame-pesado');
    vi.advanceTimersByTime(200);

    expect(saveMock).toHaveBeenCalledWith('exame-pesado');
    expect(currentState.status).toBe('error');
    expect(currentState.reason).toBe('quota');
  });

  it('deve executar flush ao destruir a instância', () => {
    const saveMock = vi.fn((_val: string): SaveResult => ({ ok: true }));
    const manager = new AutosaveManager('v0', saveMock, 400);

    manager.updateValue('final');
    manager.destroy();

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith('final');
  });

  it('flushAsync deve aguardar a resolução assíncrona do salvamento', async () => {
    let resolved = false;
    const saveMock = vi.fn(async (_val: string): Promise<SaveResult> => {
      resolved = true;
      return { ok: true };
    });

    const manager = new AutosaveManager('v0', saveMock, 500);
    manager.updateValue('dados-assincronos');

    const result = await manager.flushAsync();
    expect(result.ok).toBe(true);
    expect(resolved).toBe(true);
    expect(saveMock).toHaveBeenCalledWith('dados-assincronos');
  });
});

