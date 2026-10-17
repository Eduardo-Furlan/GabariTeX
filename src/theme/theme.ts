export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'mcorr_theme';

export function parseStoredTheme(raw: string | null): ThemePreference {
  if (raw === 'light' || raw === 'dark' || raw === 'system') {
    return raw;
  }
  return 'system';
}

export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (pref === 'light') return 'light';
  if (pref === 'dark') return 'dark';
  return systemPrefersDark ? 'dark' : 'light';
}

export function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', resolved === 'dark' ? '#0f172a' : '#ffffff');
  }
}

export const THEME_TRANSITION_CLASS = 'theme-transitioning';
export const THEME_TRANSITION_MS = 220;

let transitionTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Aplica o tema com uma transição uniforme de cores.
 * Sem animação quando: SSR, usuário prefere menos movimento ou o tema não mudou.
 */
export function applyThemeAnimated(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark = root.classList.contains('dark');
  if (isDark === (resolved === 'dark')) {
    applyTheme(resolved);
    return;
  }
  const reduce =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    applyTheme(resolved);
    return;
  }
  if (transitionTimer) clearTimeout(transitionTimer);
  root.classList.add(THEME_TRANSITION_CLASS);
  applyTheme(resolved);
  transitionTimer = setTimeout(() => {
    root.classList.remove(THEME_TRANSITION_CLASS);
    transitionTimer = null;
  }, THEME_TRANSITION_MS + 30);
}

