import type { OutreachSendResult, PriorityPatient } from '@ts-sm/shared';
import { Mail, Phone } from 'lucide-react';
import { useState } from 'react';

import { useOutreachDraft } from '../api/useOutreach';

import { CallScriptModal } from './CallScriptModal';
import { EmailDraftModal } from './EmailDraftModal';

type OutreachChannel = 'call' | 'email';

interface OutreachActionsProps {
  patient: PriorityPatient;
}

function sentMessage(result: OutreachSendResult): string {
  const action = result.channel === 'email' ? 'Correo enviado' : 'Llamada iniciada';
  const overrideNote =
    result.overridden &&
    (result.channel === 'email'
      ? ' — cuenta Resend en tier gratuito, se envió a la dirección de demo'
      : ' — cuenta Twilio en tier gratuito, se marcó al número de demo');
  return `${action} a ${result.to}${overrideNote || ''}.`;
}

export function OutreachActions({ patient }: OutreachActionsProps) {
  const [openChannel, setOpenChannel] = useState<OutreachChannel | null>(null);
  const [lastSent, setLastSent] = useState<OutreachSendResult | null>(null);
  const draft = useOutreachDraft();

  function handleOpen(channel: OutreachChannel): void {
    setLastSent(null);
    setOpenChannel(channel);
    draft.mutate(patient.id);
  }

  function handleClose(): void {
    setOpenChannel(null);
    draft.reset();
  }

  function handleSent(result: OutreachSendResult): void {
    setLastSent(result);
    handleClose();
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => handleOpen('call')}
        disabled={draft.isPending}
        className="flex items-center gap-2 rounded-full bg-accent px-[16px] py-[9px] text-[13.5px] font-medium text-on-accent disabled:opacity-60"
      >
        <Phone size={14} strokeWidth={1.7} />
        {draft.isPending && openChannel === 'call' ? 'Generando guion…' : 'Simular llamada'}
      </button>
      <button
        type="button"
        onClick={() => handleOpen('email')}
        disabled={draft.isPending}
        className="flex items-center gap-2 rounded-full border border-border-mid bg-surface-2 px-[16px] py-[9px] text-[13.5px] font-medium text-fg transition-colors duration-150 hover:border-accent hover:text-accent disabled:opacity-60"
      >
        <Mail size={14} strokeWidth={1.7} />
        {draft.isPending && openChannel === 'email' ? 'Redactando…' : 'Enviar correo (Resend)'}
      </button>

      {draft.isError && openChannel && (
        <p className="text-[12.5px] text-danger" role="alert">
          No fue posible generar el mensaje. Intenta de nuevo.
        </p>
      )}

      {lastSent && <p className="text-[12.5px] text-fg">{sentMessage(lastSent)}</p>}

      {openChannel === 'call' && draft.isSuccess && (
        <CallScriptModal patient={patient} draft={draft.data} onClose={handleClose} onSent={handleSent} />
      )}
      {openChannel === 'email' && draft.isSuccess && (
        <EmailDraftModal patient={patient} draft={draft.data} onClose={handleClose} onSent={handleSent} />
      )}
    </div>
  );
}
