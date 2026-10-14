import { useState, useEffect, useCallback } from 'react';
import {
  ThemePreference,
  THEME_STORAGE_KEY,
  parseStoredTheme,
  resolveTheme,
  applyTheme,
} from './theme';

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') return 'system';
    return parseStoredTheme(localStorage.getItem(THEME_STORAGE_KEY));
  });

  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) {
        setPreference(parseStoredTheme(e.newValue));
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const resolved = resolveTheme(preference, systemDark);

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  const setTheme = useCallback((newPref: ThemePreference) => {
    setPreference(newPref);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newPref);
    } catch {
      // Ignora falhas de escrita
    }
  }, []);

  return {
    preference,
    resolved,
    setTheme,
  };
}

