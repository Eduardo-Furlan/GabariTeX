import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  subscribeConfirm,
  getConfirmSnapshot,
  getConfirmServerSnapshot,
  setConfirmHostMounted,
} from './confirmStore';
import { Modal } from './Modal';
import { Button } from './Button';

export const ConfirmHost: React.FC = () => {
  const confirmState = useSyncExternalStore(
    subscribeConfirm,
    getConfirmSnapshot,
    getConfirmServerSnapshot
  );

  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setConfirmHostMounted(true);
    return () => {
      setConfirmHostMounted(false);
    };
  }, []);

  useEffect(() => {
    if (confirmState && confirmState.tone === 'danger') {
      // Focus Cancel button first for danger actions to prevent accidental deletion
      setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 50);
    }
  }, [confirmState]);

  if (!confirmState) return null;

  const {
    title,
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    tone = 'default',
    resolve,
  } = confirmState;

  return (
    <Modal
      open={true}
      onOpenChange={(open) => {
        if (!open) resolve(false);
      }}
      title={title}
      size="sm"
      footer={
        <>
          <Button
            ref={cancelButtonRef}
            variant="secondary"
            onClick={() => resolve(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => resolve(true)}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-body text-slate-600 leading-relaxed whitespace-pre-line">
        {message}
      </p>
    </Modal>
  );
};
