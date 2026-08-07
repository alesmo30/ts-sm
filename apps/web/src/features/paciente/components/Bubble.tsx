import { formatTime } from '../../../shared/lib/format';

interface BubbleProps {
  who: 'patient' | 'assistant' | 'system';
  text: string;
  isVoice?: boolean;
  at?: Date;
}

export function Bubble({ who, text, isVoice, at }: BubbleProps) {
  // En /paciente el paciente es "yo": va a la derecha. Invertido respecto a la
  // vista médico (DESIGN.md §3.2, asimetría intencional — no unificar).
  const isOutgoing = who === 'patient';

  return (
    <div className={`flex min-w-0 ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      <div
        className={
          isOutgoing
            ? 'max-w-[76%] min-w-0 rounded-2xl rounded-br-[4px] border border-[rgba(15,232,196,.25)] bg-accent-soft px-[15px] py-[11px] text-[14.5px] text-fg'
            : 'max-w-[76%] min-w-0 rounded-2xl rounded-bl-[4px] border border-border bg-surface-2 px-[15px] py-[11px] text-[14.5px] text-fg'
        }
      >
        {isVoice && (
          <p className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.03em] text-muted">
            🎙 Transcrito de audio
          </p>
        )}
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{text}</p>
        {at && (
          <p className="mt-1 text-right font-mono text-[10.5px] text-tx-muted">{formatTime(at)}</p>
        )}
      </div>
    </div>
  );
}
