export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

export interface ToastOptions {
  title?: string;
  duration?: number;
}

type Listener = () => void;
const listeners = new Set<Listener>();

let toasts: ToastItem[] = [];
let counter = 0;

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToastsSnapshot(): ToastItem[] {
  return toasts;
}

export function getToastsServerSnapshot(): ToastItem[] {
  return [];
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

function addToast(type: ToastType, message: string, options?: ToastOptions): string {
  const id = `toast-${++counter}-${Date.now()}`;
  const duration = options?.duration ?? (type === 'error' ? 6000 : 4000);
  const newToast: ToastItem = {
    id,
    type,
    message,
    title: options?.title,
    duration,
  };

  // Keep at most 3 visible
  toasts = [...toasts.slice(-2), newToast];
  notify();

  if (typeof window !== 'undefined' && duration > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }

  return id;
}

export const toast = {
  success: (message: string, options?: ToastOptions) => addToast('success', message, options),
  error: (message: string, options?: ToastOptions) => addToast('error', message, options),
  info: (message: string, options?: ToastOptions) => addToast('info', message, options),
  dismiss: dismissToast,
};
