import type { TranscriptTurn } from '@ts-sm/shared';
import { useEffect, useRef } from 'react';

import { Bubble } from './Bubble';
import { TypingIndicator } from './TypingIndicator';

interface ChatViewProps {
  turns: TranscriptTurn[];
  streamingText: string;
  isStreaming: boolean;
  error: string | null;
  isSynthesizingVoice?: boolean;
}

const NEAR_BOTTOM_THRESHOLD_PX = 80;

export function ChatView({ turns, streamingText, isStreaming, error, isSynthesizingVoice }: ChatViewProps) {
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
        <Bubble key={turn.id} who={turn.who} text={turn.text} isVoice={turn.isVoice} at={turn.at} />
      ))}

      {isStreaming && streamingText === '' && <TypingIndicator />}

      {isStreaming && streamingText !== '' && (
        <Bubble who="assistant" text={streamingText} processingAudio={isSynthesizingVoice} />
      )}

      {error && (
        <p className="text-center text-[12.5px] text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
