import * as Dialog from '@radix-ui/react-dialog';
import React from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';

const SIZE = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const;

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  hideTitle?: boolean;
  hideCloseButton?: boolean;
  size?: keyof typeof SIZE;
  dismissible?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  hideTitle = false,
  hideCloseButton = false,
  size = 'md',
  dismissible = true,
  footer,
  children,
  className,
}) => {
  const block = (e: Event) => {
    if (!dismissible) e.preventDefault();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (dismissible || next) onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="no-print fixed inset-0 z-50 bg-scrim/60 modal-overlay" />
        <div className="no-print pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <Dialog.Content
            aria-describedby={description ? undefined : undefined}
            onEscapeKeyDown={block}
            onPointerDownOutside={block}
            onInteractOutside={block}
            className={cn(
              'modal-content pointer-events-auto flex max-h-[90vh] w-full flex-col overflow-hidden border border-slate-200 bg-white shadow-overlay',
              'rounded-t-sheet sm:rounded-sheet',
              SIZE[size],
              className
            )}
          >
            <div className="flex items-start justify-between px-5 pb-3 pt-5 gap-3">
              <div className="min-w-0 flex-1">
                <Dialog.Title
                  className={
                    hideTitle
                      ? 'sr-only'
                      : 'font-display text-title font-semibold text-slate-900 leading-tight'
                  }
                >
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description className="mt-1 text-body text-slate-600">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              {dismissible && !hideCloseButton && (
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition focus-visible:outline-none"
                    aria-label="Fechar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
            {footer && (
              <div className="border-t border-slate-200 px-5 py-3 bg-slate-50/50 flex items-center justify-end gap-2.5">
                {footer}
              </div>
            )}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
