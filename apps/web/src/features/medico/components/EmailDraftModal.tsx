import type { OutreachDraft, OutreachSendResult, PriorityPatient } from '@ts-sm/shared';
import { useState } from 'react';

import { Modal } from '../../../shared/components/Modal';
import { useSendOutreachEmail } from '../api/useOutreach';

interface EmailDraftModalProps {
  patient: PriorityPatient;
  draft: OutreachDraft;
  onClose: () => void;
  onSent: (result: OutreachSendResult) => void;
}

export function EmailDraftModal({ patient, draft, onClose, onSent }: EmailDraftModalProps) {
  const [to, setTo] = useState(draft.suggestedEmail || patient.email);
  const [subject, setSubject] = useState(draft.subject);
  const [message, setMessage] = useState(draft.emailBody);
  const mutation = useSendOutreachEmail();

  function handleSend(): void {
    mutation.mutate({ patientId: patient.id, to, subject, message }, { onSuccess: onSent });
  }

  return (
    <Modal title="Enviar correo (Resend)" onClose={onClose}>
      {draft.severity === 'grave' && (
        <p className="mb-3 rounded-[8px] bg-danger-soft px-3 py-2 text-[12.5px] font-medium text-danger">
          Caso grave — el mensaje recomienda acudir a urgencias de inmediato.
        </p>
      )}

      <label className="block text-[12px] text-muted" htmlFor="email-to">
        Para
      </label>
      <input
        id="email-to"
        type="email"
        value={to}
        onChange={(event) => setTo(event.target.value)}
        disabled={mutation.isPending}
        className="mt-1 w-full rounded-[8px] border border-border-mid bg-surface-2 px-3 py-2 text-[13.5px] text-fg disabled:opacity-60"
      />

      <label className="mt-4 block text-[12px] text-muted" htmlFor="email-subject">
        Asunto
      </label>
      <input
        id="email-subject"
        type="text"
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
        disabled={mutation.isPending}
        className="mt-1 w-full rounded-[8px] border border-border-mid bg-surface-2 px-3 py-2 text-[13.5px] text-fg disabled:opacity-60"
      />

      <label className="mt-4 block text-[12px] text-muted" htmlFor="email-message">
        Mensaje
      </label>
      <textarea
        id="email-message"
        rows={12}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
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
          onClick={handleSend}
          disabled={mutation.isPending || to.trim().length === 0 || subject.trim().length === 0 || message.trim().length === 0}
          className="rounded-full bg-accent px-[16px] py-[9px] text-[13.5px] font-medium text-on-accent disabled:opacity-60"
        >
          {mutation.isPending ? 'Enviando…' : 'Enviar correo'}
        </button>
      </div>
    </Modal>
  );
}
