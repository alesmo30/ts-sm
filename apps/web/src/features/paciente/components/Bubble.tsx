import type { TranscriptTurn } from '@ts-sm/shared';

function formatTime(at: Date): string {
  return at.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

interface BubbleProps {
  turn: Pick<TranscriptTurn, 'who' | 'text' | 'isVoice' | 'at'>;
}

export function Bubble({ turn }: BubbleProps) {
  // En /paciente el paciente es "yo": va a la derecha. Invertido respecto a la
  // vista médico (DESIGN.md §3.2, asimetría intencional — no unificar).
  const isOutgoing = turn.who === 'patient';

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
        <p className="whitespace-pre-wrap">{turn.text}</p>
        <p className="mt-1 text-right font-mono text-[10.5px] text-tx-muted">{formatTime(turn.at)}</p>
      </div>
    </div>
  );
}
