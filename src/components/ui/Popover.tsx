import React, { useEffect, useRef } from 'react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { cn } from './cn';

export interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  align?: 'start' | 'center' | 'end';
  className?: string;
  children: React.ReactNode;
}

export const Popover: React.FC<PopoverProps> = ({
  open,
  onOpenChange,
  anchorRef,
  align = 'end',
  className,
  children,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
        anchorRef?.current?.focus();
      }
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        (!anchorRef?.current || !anchorRef.current.contains(target))
      ) {
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open, onOpenChange, anchorRef]);

  const alignClasses = {
    start: 'left-0 origin-top-left',
    center: 'left-1/2 -translate-x-1/2 origin-top',
    end: 'right-0 origin-top-right',
  }[align];

  return (
    <AnimatePresence>
      {open && (
        <m.div
          ref={popoverRef}
          role="dialog"
          className={cn(
            'no-print absolute top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-card shadow-raised overflow-hidden',
            alignClasses,
            className
          )}
          initial={{ opacity: 0, scale: 0.98, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -4 }}
          transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
};
