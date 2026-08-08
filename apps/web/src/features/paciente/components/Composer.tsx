import { Mic, MicOff, Send, Square } from 'lucide-react';
import { useLayoutEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';

import { Tooltip } from '../../../shared/components/Tooltip';
import type { MicState } from '../audio/useMicrophone';

interface ComposerProps {
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  micState: MicState;
  onMicPointerDown: () => void;
  onMicPointerUp: () => void;
  /** true mientras el asistente responde (texto o voz): bloquea mic y envío. El texto NUNCA se bloquea. */
  disabled: boolean;
  /** true mientras hay voz activa (Deepgram o fallback local) que tenga sentido poder detener. */
  showStopVoice: boolean;
  onRequestStopVoice: () => void;
}

// 2 líneas a 19px de line-height + 13px de padding vertical arriba y abajo.
const MAX_TEXTAREA_HEIGHT_PX = 19 * 2 + 13 * 2;

// Mensaje amistoso, sin detalle técnico (ni "TTS", ni "streaming"): el
// paciente solo necesita saber que el asistente está hablando y que ya sigue.
const RESPONDING_TOOLTIP = 'El asistente está hablando. Espera un momento para enviar o grabar de nuevo.';

const MIC_TITLE: Record<MicState, string> = {
  off: 'Disponible próximamente',
  idle: 'Mantén presionado para hablar',
  recording: 'Grabando… suelta para agregarlo a tu mensaje',
  processing: RESPONDING_TOOLTIP,
  denied: 'Permiso de micrófono denegado. Habilítalo en la configuración del sitio.',
  unsupported: 'Tu navegador no soporta grabación de voz',
};

function micButtonClassName(state: MicState): string {
  const base = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150';
  if (state === 'recording') {
    return `${base} bg-danger text-on-danger [animation:pulse_1s_infinite]`;
  }
  if (state === 'idle') {
    return `${base} border border-border-mid bg-surface-2 text-muted hover:border-accent hover:text-accent`;
  }
  // processing / denied / unsupported / off: mismo estado visual, "no disponible ahora"
  // — nada de spinner, que se leía como si el mic estuviera haciendo algo por su cuenta.
  return `${base} cursor-not-allowed border border-border-mid bg-surface-2 text-muted opacity-60`;
}

export function Composer({
  value,
  onChange,
  onSend,
  micState,
  onMicPointerDown,
  onMicPointerUp,
  disabled,
  showStopVoice,
  onRequestStopVoice,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT_PX ? 'auto' : 'hidden';
  }, [value]);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    if (disabled || !value.trim()) return;
    onSend();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  }

  // micState ya refleja "disabled" internamente (useMicrophone recibe el mismo
  // busy que llega acá como prop), no hace falta recalcularlo — solo defender
  // el caso borde de que el padre pase disabled sin que micState haya reaccionado aún.
  const micDisabled = disabled || (micState !== 'idle' && micState !== 'recording');
  const micIcon =
    micState === 'denied' || micState === 'unsupported' ? (
      <MicOff size={19} strokeWidth={1.7} />
    ) : (
      <Mic size={19} strokeWidth={1.7} />
    );

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3 border-t border-border px-5 py-4">
      <Tooltip label={MIC_TITLE[micState]}>
        <button
          type="button"
          disabled={micDisabled}
          aria-label="Hablar por micrófono"
          className={micButtonClassName(micState)}
          onPointerDown={(event) => {
            if (disabled || micState !== 'idle') return;
            event.currentTarget.setPointerCapture(event.pointerId);
            onMicPointerDown();
          }}
          onPointerUp={onMicPointerUp}
          onPointerCancel={onMicPointerUp}
          onBlur={() => {
            if (micState === 'recording') onMicPointerUp();
          }}
        >
          {micIcon}
        </button>
      </Tooltip>
      <span role="status" aria-live="polite" className="sr-only">
        {MIC_TITLE[micState]}
      </span>

      {showStopVoice && (
        <Tooltip label="Detener al asistente">
          <button
            type="button"
            aria-label="Detener voz del asistente"
            onClick={onRequestStopVoice}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border-mid bg-surface-2 text-danger transition-colors duration-150 hover:border-danger"
          >
            <Square size={15} strokeWidth={1.7} fill="currentColor" />
          </button>
        </Tooltip>
      )}

      {/* El texto nunca se deshabilita: se puede escribir y editar aunque el
          asistente esté hablando — solo enviar y grabar quedan bloqueados. */}
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escribe o dicta tu pregunta…"
        className="max-h-[64px] flex-1 resize-none overflow-y-hidden rounded-[22px] border border-border-mid bg-surface-2 px-[18px] py-[13px] text-[14px] leading-[19px] text-fg placeholder:text-tx-muted focus:border-accent focus:outline-none"
      />

      {disabled ? (
        <Tooltip label={RESPONDING_TOOLTIP}>
          <button
            type="submit"
            disabled
            aria-label="Enviar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent opacity-60 transition-colors duration-150"
          >
            <Send size={19} strokeWidth={1.7} />
          </button>
        </Tooltip>
      ) : (
        <button
          type="submit"
          aria-label="Enviar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition-colors duration-150 hover:bg-accent-hover"
        >
          <Send size={19} strokeWidth={1.7} />
        </button>
      )}
    </form>
  );
}
