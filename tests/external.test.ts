import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('openExternal', () => {
  const originalWindow = globalThis.window;
  let mockWindowOpen: ReturnType<typeof vi.fn>;
  let mockOpenUrl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    mockWindowOpen = vi.fn();
    mockOpenUrl = vi.fn().mockResolvedValue(undefined);

    vi.doMock('@tauri-apps/plugin-opener', () => ({
      openUrl: mockOpenUrl,
    }));

    // @ts-expect-error Mocking window.open
    globalThis.window = {
      open: mockWindowOpen,
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    globalThis.window = originalWindow;
  });

  it('no ambiente web (__DESKTOP__ = false), chama window.open com noopener,noreferrer', async () => {
    vi.stubGlobal('__DESKTOP__', false);
    const { openExternal } = await import('../src/platform/external');

    await openExternal('https://example.com/docs');

    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    expect(mockWindowOpen).toHaveBeenCalledWith(
      'https://example.com/docs',
      '_blank',
      'noopener,noreferrer'
    );
    expect(mockOpenUrl).not.toHaveBeenCalled();
  });

  it('no ambiente desktop (__DESKTOP__ = true), chama openUrl do plugin-opener', async () => {
    vi.stubGlobal('__DESKTOP__', true);
    const { openExternal } = await import('../src/platform/external');

    await openExternal('https://eduardo-furlan.github.io/GabariTeX/docs/');

    expect(mockOpenUrl).toHaveBeenCalledTimes(1);
    expect(mockOpenUrl).toHaveBeenCalledWith(
      'https://eduardo-furlan.github.io/GabariTeX/docs/'
    );
    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  it('no ambiente desktop, propaga erro caso openUrl rejeite', async () => {
    vi.stubGlobal('__DESKTOP__', true);
    mockOpenUrl.mockRejectedValueOnce(new Error('Navegador padrão não encontrado'));
    const { openExternal } = await import('../src/platform/external');

    await expect(
      openExternal('https://eduardo-furlan.github.io/GabariTeX/docs/')
    ).rejects.toThrow('Navegador padrão não encontrado');
  });
});
