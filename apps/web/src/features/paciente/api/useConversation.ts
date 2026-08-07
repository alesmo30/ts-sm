import { ServerEventSchema, SessionDetailSchema, type ClientEvent, type TranscriptTurn } from '@ts-sm/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiClient } from '../../../shared/lib/apiClient';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const WS_URL = `${API_URL.replace(/^http/, 'ws')}/ws`;

export interface UseConversationResult {
  turns: TranscriptTurn[];
  streamingText: string;
  isStreaming: boolean;
  error: string | null;
  send: (text: string) => void;
}

export function useConversation(sessionId: string | null): UseConversationResult {
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    setTurns([]);
    setStreamingText('');
    setIsStreaming(false);
    setError(null);

    apiClient
      .get(`/sessions/${sessionId}`, SessionDetailSchema)
      .then((detail) => {
        if (!cancelled) setTurns(detail.turns);
      })
      .catch(() => {
        if (!cancelled) setError('No fue posible cargar la conversación previa.');
      });

    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.onmessage = (message: MessageEvent<string>) => {
      let raw: unknown;
      try {
        raw = JSON.parse(message.data);
      } catch {
        return;
      }

      const parsed = ServerEventSchema.safeParse(raw);
      if (!parsed.success) {
        console.error('Evento de servidor inválido, descartado', parsed.error.issues);
        return;
      }

      const event = parsed.data;
      switch (event.type) {
        case 'turn_saved':
          setTurns((prev) => [...prev, event.turn]);
          setIsStreaming(true);
          setStreamingText('');
          break;
        case 'delta':
          setStreamingText((prev) => prev + event.text);
          break;
        case 'done':
          setTurns((prev) => [...prev, event.turn]);
          setStreamingText('');
          setIsStreaming(false);
          break;
        case 'error':
          setError(event.message);
          setStreamingText('');
          setIsStreaming(false);
          break;
      }
    };

    socket.onerror = () => {
      if (!cancelled) setError('Se perdió la conexión con el asistente.');
    };

    return () => {
      cancelled = true;
      socket.close();
      socketRef.current = null;
    };
  }, [sessionId]);

  const send = useCallback(
    (text: string) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !sessionId || !text.trim()) return;

      setError(null);
      const event: ClientEvent = { type: 'user_message', sessionId, text };
      socket.send(JSON.stringify({ event: 'user_message', data: event }));
    },
    [sessionId],
  );

  return { turns, streamingText, isStreaming, error, send };
}
