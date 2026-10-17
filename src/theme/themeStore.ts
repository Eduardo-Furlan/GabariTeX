import {
  ThemePreference,
  THEME_STORAGE_KEY,
  parseStoredTheme,
  resolveTheme,
  applyThemeAnimated,
} from './theme';

export interface ThemeState {
  preference: ThemePreference;
  systemDark: boolean;
}

type Listener = () => void;

const listeners = new Set<Listener>();

function readInitialPreference(): ThemePreference {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'system';
  }
  try {
    return parseStoredTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

function readInitialSystemDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

let currentState: ThemeState = {
  preference: readInitialPreference(),
  systemDark: readInitialSystemDark(),
};

const serverSnapshot: ThemeState = {
  preference: 'system',
  systemDark: false,
};

let mediaQueryList: MediaQueryList | null = null;
let mediaQueryHandler: ((e: MediaQueryListEvent) => void) | null = null;
let storageHandler: ((e: StorageEvent) => void) | null = null;

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function updateState(partial: Partial<ThemeState>, animate = true) {
  const nextPreference = partial.preference !== undefined ? partial.preference : currentState.preference;
  const nextSystemDark = partial.systemDark !== undefined ? partial.systemDark : currentState.systemDark;

  if (nextPreference === currentState.preference && nextSystemDark === currentState.systemDark) {
    return;
  }

  currentState = {
    preference: nextPreference,
    systemDark: nextSystemDark,
  };

  const resolved = resolveTheme(currentState.preference, currentState.systemDark);
  if (animate) {
    applyThemeAnimated(resolved);
  }

  notify();
}

function setupGlobalListeners() {
  if (typeof window === 'undefined') return;

  if (typeof window.matchMedia === 'function') {
    try {
      mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQueryHandler = (e: MediaQueryListEvent) => {
        updateState({ systemDark: e.matches }, true);
      };
      if (typeof mediaQueryList.addEventListener === 'function') {
        mediaQueryList.addEventListener('change', mediaQueryHandler);
      } else if (typeof (mediaQueryList as any).addListener === 'function') {
        (mediaQueryList as any).addListener(mediaQueryHandler);
      }
    } catch {
      // Ignore
    }
  }

  storageHandler = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) {
      const nextPref = parseStoredTheme(e.newValue);
      updateState({ preference: nextPref }, true);
    }
  };
  window.addEventListener('storage', storageHandler);
}

function teardownGlobalListeners() {
  if (typeof window === 'undefined') return;

  if (mediaQueryList && mediaQueryHandler) {
    if (typeof mediaQueryList.removeEventListener === 'function') {
      mediaQueryList.removeEventListener('change', mediaQueryHandler);
    } else if (typeof (mediaQueryList as any).removeListener === 'function') {
      (mediaQueryList as any).removeListener(mediaQueryHandler);
    }
  }
  mediaQueryList = null;
  mediaQueryHandler = null;

  if (storageHandler) {
    window.removeEventListener('storage', storageHandler);
    storageHandler = null;
  }
}

export function subscribe(listener: Listener): () => void {
  if (listeners.size === 0) {
    setupGlobalListeners();
  }
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      teardownGlobalListeners();
    }
  };
}

export function getSnapshot(): ThemeState {
  return currentState;
}

export function getServerSnapshot(): ThemeState {
  return serverSnapshot;
}

export function setPreference(next: ThemePreference): void {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignora falhas de escrita
    }
  }

  updateState({ preference: next }, true);
}

export function __resetThemeStoreForTests(): void {
  teardownGlobalListeners();
  listeners.clear();
  currentState = {
    preference: readInitialPreference(),
    systemDark: readInitialSystemDark(),
  };
}

