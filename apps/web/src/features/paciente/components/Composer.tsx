import { Mic, Send } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

interface ComposerProps {
  onSend: (text: string) => void;
}

// 2 líneas a 19px de line-height + 13px de padding vertical arriba y abajo.
const MAX_TEXTAREA_HEIGHT_PX = 19 * 2 + 13 * 2;

export function Composer({ onSend }: ComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT_PX ? 'auto' : 'hidden';
  }, [text]);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3 border-t border-border px-5 py-4">
      <button
        type="button"
        disabled
        title="Disponible próximamente"
        aria-label="Hablar por micrófono"
        className="flex h-11 w-11 shrink-0 cursor-not-allowed items-center justify-center rounded-full border border-border-mid bg-surface-2 text-muted opacity-60"
      >
        <Mic size={16} strokeWidth={1.7} />
      </button>

      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escribe tu pregunta…"
        className="max-h-[64px] flex-1 resize-none overflow-y-hidden rounded-[22px] border border-border-mid bg-surface-2 px-[18px] py-[13px] text-[14px] leading-[19px] text-fg placeholder:text-tx-muted focus:border-accent focus:outline-none"
      />

      <button
        type="submit"
        aria-label="Enviar"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition-colors duration-150 hover:bg-accent-hover"
      >
        <Send size={16} strokeWidth={1.7} />
      </button>
    </form>
  );
}
