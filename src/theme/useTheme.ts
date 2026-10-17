import { useSyncExternalStore } from 'react';
import { resolveTheme } from './theme';
import { subscribe, getSnapshot, getServerSnapshot, setPreference } from './themeStore';

export function useTheme() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const resolved = resolveTheme(state.preference, state.systemDark);
  return {
    preference: state.preference,
    resolved,
    setTheme: setPreference,
  };
}
