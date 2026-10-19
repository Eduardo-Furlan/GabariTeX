import { useRef } from 'react';

/**
 * Retains and returns the last non-null / non-undefined value across renders.
 * Useful for dialogs/sheets animating out after the parent resets active state to null.
 */
export function useRetained<T>(value: T): NonNullable<T> | null {
  const ref = useRef<NonNullable<T> | null>(value != null ? (value as NonNullable<T>) : null);

  if (value != null) {
    ref.current = value as NonNullable<T>;
  }

  return ref.current;
}
