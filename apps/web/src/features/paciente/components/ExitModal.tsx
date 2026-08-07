import { useState } from 'react';

import { Modal } from '../../../shared/components/Modal';

interface ExitModalProps {
  isClosing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ExitModal({ isClosing, onCancel, onConfirm }: ExitModalProps) {
  const [confirmed, setConfirmed] = useState(false);

  function handleConfirm(): void {
    setConfirmed(true);
    onConfirm();
  }

  return (
    <Modal title="¿Cambiar a vista médico?" onClose={onCancel}>
      <p className="text-[14px] leading-[1.5] text-muted">
        Esto finaliza tu sesión actual con el asistente. Tu conversación se guardará antes de salir.
      </p>
      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={confirmed && isClosing}
          className="rounded-full border border-border-mid bg-surface-2 px-[16px] py-[9px] text-[13.5px] font-medium text-fg transition-colors duration-150 hover:border-accent hover:text-accent disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={confirmed && isClosing}
          className="rounded-full bg-accent px-[16px] py-[9px] text-[13.5px] font-medium text-on-accent disabled:opacity-60"
        >
          {confirmed && isClosing ? 'Guardando…' : 'Cambiar a vista médico'}
        </button>
      </div>
    </Modal>
  );
}
