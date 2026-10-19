export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

export interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

type Listener = () => void;
const listeners = new Set<Listener>();

let currentConfirm: ConfirmState | null = null;
let isHostMounted = false;

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function setConfirmHostMounted(mounted: boolean) {
  isHostMounted = mounted;
}

export function subscribeConfirm(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getConfirmSnapshot(): ConfirmState | null {
  return currentConfirm;
}

export function getConfirmServerSnapshot(): ConfirmState | null {
  return null;
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (!isHostMounted) {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return Promise.resolve(window.confirm(`${options.title}\n\n${options.message}`));
    }
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    currentConfirm = {
      ...options,
      resolve: (result: boolean) => {
        currentConfirm = null;
        notify();
        resolve(result);
      },
    };
    notify();
  });
}
