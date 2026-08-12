import type { OutreachDraft, OutreachSendResult, PriorityPatient } from '@ts-sm/shared';
import { useState } from 'react';

import { Modal } from '../../../shared/components/Modal';
import { useStartOutreachCall } from '../api/useOutreach';

interface CallScriptModalProps {
  patient: PriorityPatient;
  draft: OutreachDraft;
  onClose: () => void;
  onSent: (result: OutreachSendResult) => void;
}

export function CallScriptModal({ patient, draft, onClose, onSent }: CallScriptModalProps) {
  const [to, setTo] = useState(draft.suggestedPhone || patient.phone);
  const [script, setScript] = useState(draft.callScript);
  const mutation = useStartOutreachCall();

  function handleCall(): void {
    mutation.mutate({ patientId: patient.id, to, script }, { onSuccess: onSent });
  }

  return (
    <Modal title="Simular llamada" onClose={onClose}>
      {draft.severity === 'grave' && (
        <p className="mb-3 rounded-[8px] bg-danger-soft px-3 py-2 text-[12.5px] font-medium text-danger">
          Caso grave — el guion recomienda acudir a urgencias de inmediato.
        </p>
      )}

      <label className="block text-[12px] text-muted" htmlFor="call-to">
        Teléfono
      </label>
      <input
        id="call-to"
        type="tel"
        value={to}
        onChange={(event) => setTo(event.target.value)}
        disabled={mutation.isPending}
        className="mt-1 w-full rounded-[8px] border border-border-mid bg-surface-2 px-3 py-2 text-[13.5px] text-fg disabled:opacity-60"
      />

      <label className="mt-4 block text-[12px] text-muted" htmlFor="call-script">
        Guion de la llamada
      </label>
      <textarea
        id="call-script"
        rows={6}
        value={script}
        onChange={(event) => setScript(event.target.value)}
        disabled={mutation.isPending}
        className="mt-1 w-full rounded-[8px] border border-border-mid bg-surface-2 px-3 py-2 text-[13.5px] leading-[1.5] text-fg disabled:opacity-60"
      />

      {mutation.isError && (
        <p className="mt-3 text-[12.5px] text-danger" role="alert">
          {mutation.error.message}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={mutation.isPending}
          className="rounded-full border border-border-mid bg-surface-2 px-[16px] py-[9px] text-[13.5px] font-medium text-fg transition-colors duration-150 hover:border-accent hover:text-accent disabled:opacity-60"
        >
          Cerrar
        </button>
        <button
          type="button"
          onClick={handleCall}
          disabled={mutation.isPending || to.trim().length === 0 || script.trim().length === 0}
          className="rounded-full bg-accent px-[16px] py-[9px] text-[13.5px] font-medium text-on-accent disabled:opacity-60"
        >
          {mutation.isPending ? 'Marcando…' : 'Llamar ahora'}
        </button>
      </div>
    </Modal>
  );
}
