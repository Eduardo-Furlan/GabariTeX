import { lazy, type ComponentType } from 'react';

const KEY = 'gabaritex:chunk-reload';

export function lazyWithRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await factory();
      if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(KEY);
      }
      return mod;
    } catch (err) {
      if (
        typeof window !== 'undefined' &&
        typeof sessionStorage !== 'undefined' &&
        !sessionStorage.getItem(KEY)
      ) {
        sessionStorage.setItem(KEY, '1');
        window.location.reload();
        return new Promise<never>(() => {}); // page is reloading
      }
      throw err; // second failure triggers ErrorBoundary
    }
  });
}
