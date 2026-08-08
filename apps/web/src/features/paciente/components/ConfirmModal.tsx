import { useState } from 'react';

import { Modal } from '../../../shared/components/Modal';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  /** Etiqueta del botón mientras onConfirm sigue en curso. Sin isPending, el click cierra al instante. */
  pendingLabel?: string;
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel,
  pendingLabel,
  isPending,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const showPending = confirmed && isPending;

  function handleConfirm(): void {
    setConfirmed(true);
    onConfirm();
  }

  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-[14px] leading-[1.5] text-muted">{message}</p>
      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={showPending}
          className="rounded-full border border-border-mid bg-surface-2 px-[16px] py-[9px] text-[13.5px] font-medium text-fg transition-colors duration-150 hover:border-accent hover:text-accent disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={showPending}
          className="rounded-full bg-accent px-[16px] py-[9px] text-[13.5px] font-medium text-on-accent disabled:opacity-60"
        >
          {showPending ? (pendingLabel ?? 'Guardando…') : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
