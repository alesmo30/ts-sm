import { Mic, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';

interface ComposerProps {
  onSend: (text: string) => void;
}

export function Composer({ onSend }: ComposerProps) {
  const [text, setText] = useState('');

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3 border-t border-border px-5 py-4">
      <button
        type="button"
        disabled
        title="Disponible próximamente"
        aria-label="Hablar por micrófono"
        className="flex h-11 w-11 shrink-0 cursor-not-allowed items-center justify-center rounded-full border border-border-mid bg-surface-2 text-muted opacity-60"
      >
        <Mic size={16} strokeWidth={1.7} />
      </button>

      <input
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Escribe tu pregunta…"
        className="flex-1 rounded-full border border-border-mid bg-surface-2 px-[18px] py-[13px] text-[14px] text-fg placeholder:text-tx-muted focus:border-accent focus:outline-none"
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
