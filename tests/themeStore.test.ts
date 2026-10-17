import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  subscribe,
  getSnapshot,
  setPreference,
  __resetThemeStoreForTests,
} from '../src/theme/themeStore';
import {
  THEME_STORAGE_KEY,
  THEME_TRANSITION_CLASS,
  THEME_TRANSITION_MS,
  applyThemeAnimated,
  resolveTheme,
} from '../src/theme/theme';

describe('themeStore & applyThemeAnimated', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalLocalStorage = globalThis.localStorage;

  let classes: Set<string>;
  let styleObj: { colorScheme: string };
  let storageMap: Map<string, string>;
  let mediaQueryCallbacks: Set<(e: { matches: boolean }) => void>;
  let mediaQueryMatches: boolean;
  let reducedMotionMatches: boolean;
  let windowEventCallbacks: Map<string, Set<(e: any) => void>>;

  beforeEach(() => {
    vi.useFakeTimers();

    classes = new Set<string>();
    styleObj = { colorScheme: '' };
    storageMap = new Map<string, string>();
    mediaQueryCallbacks = new Set();
    mediaQueryMatches = false;
    reducedMotionMatches = false;
    windowEventCallbacks = new Map();

    const fakeDocument = {
      documentElement: {
        classList: {
          add: (c: string) => classes.add(c),
          remove: (c: string) => classes.delete(c),
          contains: (c: string) => classes.has(c),
        },
        style: styleObj,
      },
      querySelector: () => null,
    };

    const fakeLocalStorage = {
      getItem: (key: string) => storageMap.get(key) ?? null,
      setItem: (key: string, val: string) => storageMap.set(key, val),
      removeItem: (key: string) => storageMap.delete(key),
      clear: () => storageMap.clear(),
    };

    const fakeWindow = {
      addEventListener: (type: string, cb: (e: any) => void) => {
        if (!windowEventCallbacks.has(type)) {
          windowEventCallbacks.set(type, new Set());
        }
        windowEventCallbacks.get(type)!.add(cb);
      },
      removeEventListener: (type: string, cb: (e: any) => void) => {
        windowEventCallbacks.get(type)?.delete(cb);
      },
      matchMedia: (query: string) => {
        if (query === '(prefers-reduced-motion: reduce)') {
          return {
            matches: reducedMotionMatches,
            addEventListener: () => {},
            removeEventListener: () => {},
          };
        }
        return {
          matches: mediaQueryMatches,
          addEventListener: (_type: string, cb: (e: any) => void) => {
            mediaQueryCallbacks.add(cb);
          },
          removeEventListener: (_type: string, cb: (e: any) => void) => {
            mediaQueryCallbacks.delete(cb);
          },
        };
      },
    };

    // @ts-expect-error Mocking globals in node env
    globalThis.document = fakeDocument;
    // @ts-expect-error Mocking globals in node env
    globalThis.window = fakeWindow;
    // @ts-expect-error Mocking globals in node env
    globalThis.localStorage = fakeLocalStorage;

    __resetThemeStoreForTests();
  });

  afterEach(() => {
    __resetThemeStoreForTests();
    vi.useRealTimers();
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
  });

  it('dois assinantes recebem a mesma preferência após setPreference', () => {
    let sub1Calls = 0;
    let sub2Calls = 0;

    const unsub1 = subscribe(() => {
      sub1Calls++;
    });
    const unsub2 = subscribe(() => {
      sub2Calls++;
    });

    setPreference('dark');

    expect(sub1Calls).toBe(1);
    expect(sub2Calls).toBe(1);
    expect(getSnapshot().preference).toBe('dark');
    expect(storageMap.get(THEME_STORAGE_KEY)).toBe('dark');

    unsub1();
    unsub2();
  });

  it('sincroniza preferência a partir de evento storage de outra aba', () => {
    const unsub = subscribe(() => {});

    const storageListeners = windowEventCallbacks.get('storage');
    expect(storageListeners).toBeDefined();

    for (const listener of storageListeners!) {
      listener({ key: THEME_STORAGE_KEY, newValue: 'light' });
    }

    expect(getSnapshot().preference).toBe('light');
    unsub();
  });

  it('evento change de matchMedia atualiza systemDark e resolved', () => {
    const unsub = subscribe(() => {});
    expect(getSnapshot().preference).toBe('system');
    expect(resolveTheme(getSnapshot().preference, getSnapshot().systemDark)).toBe('light');

    for (const cb of mediaQueryCallbacks) {
      cb({ matches: true });
    }

    expect(getSnapshot().systemDark).toBe(true);
    expect(resolveTheme(getSnapshot().preference, getSnapshot().systemDark)).toBe('dark');
    unsub();
  });

  describe('applyThemeAnimated', () => {
    it('adiciona classe de transição e remove após THEME_TRANSITION_MS + 30ms', () => {
      applyThemeAnimated('dark');

      expect(classes.has(THEME_TRANSITION_CLASS)).toBe(true);
      expect(classes.has('dark')).toBe(true);

      vi.advanceTimersByTime(THEME_TRANSITION_MS + 29);
      expect(classes.has(THEME_TRANSITION_CLASS)).toBe(true);

      vi.advanceTimersByTime(2);
      expect(classes.has(THEME_TRANSITION_CLASS)).toBe(false);
    });

    it('duas trocas rápidas encadeadas deixam uma única remoção no fim', () => {
      applyThemeAnimated('dark');
      expect(classes.has(THEME_TRANSITION_CLASS)).toBe(true);

      vi.advanceTimersByTime(100);
      applyThemeAnimated('light');
      expect(classes.has(THEME_TRANSITION_CLASS)).toBe(true);

      // Avança mais 200 ms (total 300 ms da primeira, mas a segunda precisa de ~250 ms)
      vi.advanceTimersByTime(200);
      expect(classes.has(THEME_TRANSITION_CLASS)).toBe(true);

      // Avança o restante da segunda troca
      vi.advanceTimersByTime(60);
      expect(classes.has(THEME_TRANSITION_CLASS)).toBe(false);
      expect(classes.has('dark')).toBe(false);
    });

    it('com prefers-reduced-motion a classe de transição não é adicionada', () => {
      reducedMotionMatches = true;
      applyThemeAnimated('dark');

      expect(classes.has(THEME_TRANSITION_CLASS)).toBe(false);
      expect(classes.has('dark')).toBe(true);
    });

    it('não anima quando o tema resolvido não sofreu alteração', () => {
      applyThemeAnimated('dark');
      vi.advanceTimersByTime(500);
      expect(classes.has('dark')).toBe(true);
      expect(classes.has(THEME_TRANSITION_CLASS)).toBe(false);

      // Chama novamente com 'dark'
      applyThemeAnimated('dark');
      expect(classes.has(THEME_TRANSITION_CLASS)).toBe(false);
    });
  });
});

