import type { TranscriptTurn } from '@ts-sm/shared';
import { useEffect, useRef } from 'react';

import { Bubble } from './Bubble';
import { TypingIndicator } from './TypingIndicator';

interface ChatViewProps {
  turns: TranscriptTurn[];
  streamingText: string;
  isStreaming: boolean;
  error: string | null;
}

const NEAR_BOTTOM_THRESHOLD_PX = 80;

export function ChatView({ turns, streamingText, isStreaming, error }: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !stickToBottom.current) return;
    container.scrollTop = container.scrollHeight;
  }, [turns, streamingText, isStreaming]);

  return (
    <div
      ref={scrollRef}
      onScroll={(event) => {
        const el = event.currentTarget;
        stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD_PX;
      }}
      className="flex-1 space-y-3 overflow-y-auto px-5 py-5"
    >
      {turns.map((turn) => (
        <Bubble key={turn.id} turn={turn} />
      ))}

      {isStreaming && streamingText === '' && <TypingIndicator />}

      {isStreaming && streamingText !== '' && (
        <div className="flex justify-start">
          <div className="max-w-[76%] rounded-2xl rounded-bl-[4px] border border-border bg-surface-2 px-[15px] py-[11px] text-[14.5px] text-fg">
            <p className="whitespace-pre-wrap">{streamingText}</p>
          </div>
        </div>
      )}

      {error && (
        <p className="text-center text-[12.5px] text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
