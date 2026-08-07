import { ArrowLeft } from 'lucide-react';

import { KbVersionChip } from '../../../shared/components/KbVersionChip';
import { StatusTag } from '../../../shared/components/StatusTag';
import { useKbState } from '../api/useKbState';
import { useSession } from '../api/useSession';

interface SessionDetailProps {
  id: string;
  onBack: () => void;
}

interface BubbleTurn {
  who: 'patient' | 'assistant' | 'system';
  text: string;
  isVoice: boolean;
}

function Bubble({ turn }: { turn: BubbleTurn }) {
  const isOutgoing = turn.who === 'assistant';

  return (
    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      <div
        className={
          isOutgoing
            ? 'max-w-[76%] rounded-2xl rounded-br-[4px] border border-[rgba(15,232,196,.25)] bg-accent-soft px-[15px] py-[11px] text-[14.5px] text-fg'
            : 'max-w-[76%] rounded-2xl rounded-bl-[4px] border border-border bg-surface-2 px-[15px] py-[11px] text-[14.5px] text-fg'
        }
      >
        {turn.isVoice && (
          <p className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.03em] text-muted">
            🎙 Transcrito de audio
          </p>
        )}
        <p>{turn.text}</p>
      </div>
    </div>
  );
}

export function SessionDetail({ id, onBack }: SessionDetailProps) {
  const { data: session, isLoading } = useSession(id);
  const { data: kbState } = useKbState();

  if (isLoading || !session) {
    return <p className="mt-4 text-[13px] text-muted">Cargando sesión…</p>;
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
      >
        <ArrowLeft size={14} strokeWidth={1.7} />
        Volver al dashboard
      </button>

      <div className="mt-4 flex items-center gap-2">
        <StatusTag variant={session.status} />
        {kbState && <KbVersionChip version={kbState.version} />}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {session.turns.map((turn) => (
          <Bubble key={turn.id} turn={turn} />
        ))}
      </div>

      {session.summary && (
        <div className="mt-5 rounded-[10px] border border-border-mid bg-surface p-4">
          <p className="text-[12.5px] font-medium text-muted">
            Resumen de recomendaciones enviado al paciente
          </p>
          <p className="mt-2 text-[13.5px] text-fg">{session.summary}</p>
        </div>
      )}
    </div>
  );
}
