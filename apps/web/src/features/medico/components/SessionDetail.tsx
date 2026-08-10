import type { Citation } from '@ts-sm/shared';
import { ArrowLeft } from 'lucide-react';

import { useKbState } from '../../../shared/api/useKbState';
import { CitationChips } from '../../../shared/components/CitationChips';
import { KbVersionChip } from '../../../shared/components/KbVersionChip';
import { StatusTag } from '../../../shared/components/StatusTag';
import { formatTime } from '../../../shared/lib/format';
import { useSession } from '../api/useSession';

interface SessionDetailProps {
  id: string;
  onBack: () => void;
}

interface BubbleTurn {
  who: 'patient' | 'assistant' | 'system';
  text: string;
  isVoice: boolean;
  citations: Citation[];
  kbVersion: number;
}

function Bubble({ turn }: { turn: BubbleTurn }) {
  if (turn.who === 'system') {
    return (
      <div className="flex items-center gap-3 py-1" role="separator">
        <span className="h-px flex-1 bg-border" />
        <span className="whitespace-nowrap font-mono text-[10.5px] text-muted">{turn.text}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    );
  }

  const isOutgoing = turn.who === 'assistant';

  return (
    <div className={`flex min-w-0 flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}>
      <div
        className={
          isOutgoing
            ? 'max-w-[76%] min-w-0 rounded-2xl rounded-br-[4px] border border-[rgba(15,232,196,.25)] bg-accent-soft px-[15px] py-[11px] text-[14.5px] text-fg'
            : 'max-w-[76%] min-w-0 rounded-2xl rounded-bl-[4px] border border-border bg-surface-2 px-[15px] py-[11px] text-[14.5px] text-fg'
        }
      >
        {turn.isVoice && (
          <p className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.03em] text-muted">
            🎙 Transcrito de audio
          </p>
        )}
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{turn.text}</p>
      </div>
      {isOutgoing && turn.citations.length > 0 && (
        <CitationChips citations={turn.citations} kbVersion={turn.kbVersion} />
      )}
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
    <div className="mt-4 flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={onBack}
        className="flex shrink-0 items-center gap-2 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
      >
        <ArrowLeft size={14} strokeWidth={1.7} />
        Volver al dashboard
      </button>

      <div className="mt-4 flex shrink-0 flex-wrap items-center gap-2">
        <StatusTag variant={session.status} />
        {kbState && <KbVersionChip version={kbState.version} />}
      </div>

      <p className="mt-3 shrink-0 text-[13.5px] text-fg">
        {session.patientName} · {session.procedure} · {formatTime(session.createdAt)}
      </p>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-[10px] border border-border p-4">
          {session.turns.length === 0 ? (
            <p className="text-[13px] text-muted">Esta sesión no tiene turnos registrados.</p>
          ) : (
            session.turns.map((turn) => <Bubble key={turn.id} turn={turn} />)
          )}
        </div>

        {session.summary && (
          <div className="shrink-0 rounded-[10px] border border-border-mid bg-surface p-4">
            <p className="text-[12.5px] font-medium text-muted">
              Resumen de recomendaciones enviado al paciente
            </p>
            <p className="mt-2 max-h-[57px] overflow-y-auto text-[13.5px] leading-[19px] text-fg">
              {session.summary}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
