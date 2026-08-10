import { ServerEventSchema, SessionDetailSchema, type ClientEvent, type TranscriptTurn } from '@ts-sm/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiClient } from '../../../shared/lib/apiClient';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const WS_URL = `${API_URL.replace(/^http/, 'ws')}/ws`;

export type SttStatus = 'idle' | 'listening' | 'transcribing' | 'failed';

export interface UseConversationOptions {
  /** Frame binario de audio (TTS) recibido del servidor. */
  onAudioChunk?: (chunk: ArrayBuffer) => void;
  /** Transcripción final de un tramo de audio grabado — no se auto-envía, se acumula en el composer. */
  onTranscript?: (text: string) => void;
  /** Nueva versión de la KB tras una ingesta o un cambio de estado activo/inactivo. */
  onKnowledgeUpdated?: (kbVersion: number) => void;
  /** Bandera roja o petición explícita detectada por el agente. */
  onEscalationStarted?: (reason: 'red_flag' | 'patient_request', countdownSeconds: number) => void;
}

export interface UseConversationResult {
  turns: TranscriptTurn[];
  streamingText: string;
  isStreaming: boolean;
  error: string | null;
  sttStatus: SttStatus;
  /** true entre el primer tts_start y el done: hay audio sintetizándose para este turno. */
  isSynthesizingVoice: boolean;
  send: (text: string, isVoice?: boolean) => void;
  sendAudioStart: () => void;
  sendAudioEnd: () => void;
  sendAudioChunk: (chunk: ArrayBuffer) => void;
  cancelEscalation: () => void;
}

export function useConversation(sessionId: string | null, options: UseConversationOptions = {}): UseConversationResult {
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sttStatus, setSttStatus] = useState<SttStatus>('idle');
  const [isSynthesizingVoice, setIsSynthesizingVoice] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const onAudioChunkRef = useRef(options.onAudioChunk);
  onAudioChunkRef.current = options.onAudioChunk;
  const onTranscriptRef = useRef(options.onTranscript);
  onTranscriptRef.current = options.onTranscript;
  const onKnowledgeUpdatedRef = useRef(options.onKnowledgeUpdated);
  onKnowledgeUpdatedRef.current = options.onKnowledgeUpdated;
  const onEscalationStartedRef = useRef(options.onEscalationStarted);
  onEscalationStartedRef.current = options.onEscalationStarted;

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    let socketOpen = false;
    // Sesión nueva sin turnos: el LLM saluda primero apenas el socket esté
    // listo, en vez de arrancar con el chat vacío. Ver specs/06-capa-de-voz.md.
    // Sesión resumida (con turnos): solo hace falta registrar el socket.
    let pendingAction: 'greet' | 'join' | null = null;
    setTurns([]);
    setStreamingText('');
    setIsStreaming(false);
    setError(null);
    setSttStatus('idle');

    const triggerGreeting = (): void => {
      socketRef.current?.send(
        JSON.stringify({ event: 'start_conversation', data: { type: 'start_conversation', sessionId } }),
      );
    };
    // Sesión resumida (F5, segunda pestaña): no dispara saludo, pero igual
    // registra el socket contra la sesión para recibir server-push como
    // knowledge_updated o escalation_started — sin esto, esas pestañas quedan
    // huérfanas hasta que el paciente escribe su primer mensaje.
    const joinSession = (): void => {
      socketRef.current?.send(JSON.stringify({ event: 'join_session', data: { type: 'join_session', sessionId } }));
    };

    apiClient
      .get(`/sessions/${sessionId}`, SessionDetailSchema)
      .then((detail) => {
        if (cancelled) return;
        setTurns(detail.turns);
        if (detail.turns.length === 0) {
          pendingAction = 'greet';
          if (socketOpen) triggerGreeting();
        } else {
          pendingAction = 'join';
          if (socketOpen) joinSession();
        }
      })
      .catch(() => {
        if (!cancelled) setError('No fue posible cargar la conversación previa.');
      });

    const socket = new WebSocket(WS_URL);
    socket.binaryType = 'arraybuffer';
    socketRef.current = socket;

    socket.onopen = () => {
      socketOpen = true;
      if (pendingAction === 'greet') triggerGreeting();
      else if (pendingAction === 'join') joinSession();
    };

    socket.onmessage = (message: MessageEvent<string | ArrayBuffer>) => {
      if (message.data instanceof ArrayBuffer) {
        onAudioChunkRef.current?.(message.data);
        return;
      }

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
          setIsSynthesizingVoice(false);
          break;
        case 'delta':
          setStreamingText((prev) => prev + event.text);
          break;
        case 'done':
          setTurns((prev) => [...prev, event.turn]);
          setStreamingText('');
          setIsStreaming(false);
          setSttStatus('idle');
          setIsSynthesizingVoice(false);
          break;
        case 'error':
          setError(event.message);
          setStreamingText('');
          setIsStreaming(false);
          setIsSynthesizingVoice(false);
          break;
        case 'stt_status':
          setSttStatus(event.state);
          if (event.state === 'failed' && event.message) setError(event.message);
          break;
        case 'stt_result':
          // El servidor ya cerró su sesión de STT y no vuelve a tocar sttStatus
          // para este tramo — acá se marca como resuelto (deja de bloquear el mic).
          setSttStatus('idle');
          onTranscriptRef.current?.(event.text);
          break;
        case 'tts_start':
          // Primera frase lista para sonar: recién ahí sabemos que viene audio
          // para este turno, sin inventar un evento nuevo solo para esto.
          setIsSynthesizingVoice(true);
          break;
        case 'tts_end':
          break;
        case 'greeting_start':
          // Mismo tratamiento que turn_saved pero sin turno de paciente: no
          // hay nada nuevo que agregar a `turns`, solo arrancar el streaming.
          setIsStreaming(true);
          setStreamingText('');
          setIsSynthesizingVoice(false);
          break;
        case 'knowledge_updated':
          // Separador `who: 'system'` — no es un turno de streaming, se
          // inserta directo en el hilo, igual que lo ve el paciente al recargar.
          setTurns((prev) => [...prev, event.turn]);
          onKnowledgeUpdatedRef.current?.(event.kbVersion);
          break;
        case 'escalation_started':
          onEscalationStartedRef.current?.(event.reason, event.countdownSeconds);
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

  const sendEvent = useCallback(
    (event: ClientEvent) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ event: event.type, data: event }));
    },
    [],
  );

  const send = useCallback(
    (text: string, isVoice = false) => {
      if (!sessionId || !text.trim()) return;
      setError(null);
      // Prende el indicador de "…" ya mismo, no cuando llegue turn_saved: el
      // viaje de ida y vuelta al servidor es exactamente el hueco sin ninguna
      // señal de actividad que generaba ruido — ver feedback en la sesión.
      setIsStreaming(true);
      setStreamingText('');
      sendEvent({ type: 'user_message', sessionId, text, isVoice });
    },
    [sessionId, sendEvent],
  );

  const sendAudioStart = useCallback(() => {
    if (!sessionId) return;
    setError(null);
    sendEvent({ type: 'audio_start', sessionId });
  }, [sessionId, sendEvent]);

  const sendAudioEnd = useCallback(() => {
    if (!sessionId) return;
    sendEvent({ type: 'audio_end', sessionId });
  }, [sessionId, sendEvent]);

  const sendAudioChunk = useCallback((chunk: ArrayBuffer) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(chunk);
  }, []);

  const cancelEscalation = useCallback(() => {
    if (!sessionId) return;
    sendEvent({ type: 'escalation_cancelled', sessionId });
  }, [sessionId, sendEvent]);

  return {
    turns,
    streamingText,
    isStreaming,
    error,
    sttStatus,
    isSynthesizingVoice,
    send,
    sendAudioStart,
    sendAudioEnd,
    sendAudioChunk,
    cancelEscalation,
  };
}
