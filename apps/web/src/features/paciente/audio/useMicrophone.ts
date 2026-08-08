import { useCallback, useEffect, useRef, useState } from 'react';

import { createMicWorkletNode } from './micWorklet';

export type MicState = 'off' | 'idle' | 'recording' | 'processing' | 'denied' | 'unsupported';

export interface UseMicrophoneOptions {
  /** VOICE_PROVIDER !== 'off'. Con false, el estado visual queda fijo en 'off'. */
  enabled: boolean;
  /** true mientras el asistente responde o suena: fuerza 'processing' y bloquea start(). */
  busy: boolean;
  onAudioChunk: (chunk: ArrayBuffer) => void;
  onRecordingStart: () => void;
  onRecordingStop: () => void;
}

export interface UseMicrophoneResult {
  state: MicState;
  start: () => Promise<void>;
  stop: () => void;
}

function isSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== 'undefined' &&
    typeof window.AudioWorkletNode !== 'undefined'
  );
}

export function useMicrophone({
  enabled,
  busy,
  onAudioChunk,
  onRecordingStart,
  onRecordingStop,
}: UseMicrophoneOptions): UseMicrophoneResult {
  const [localState, setLocalState] = useState<'idle' | 'recording' | 'denied' | 'unsupported'>('idle');
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const onAudioChunkRef = useRef(onAudioChunk);
  onAudioChunkRef.current = onAudioChunk;

  const teardown = useCallback(() => {
    nodeRef.current?.disconnect();
    nodeRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  const start = useCallback(async () => {
    if (!enabled || busy || localState === 'recording') return;
    if (!isSupported()) {
      setLocalState('unsupported');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      const context = new AudioContext({ sampleRate: 16000 });
      const node = await createMicWorkletNode(context);
      node.port.onmessage = (event: MessageEvent<ArrayBuffer>) => onAudioChunkRef.current(event.data);
      const source = context.createMediaStreamSource(stream);
      source.connect(node);

      streamRef.current = stream;
      contextRef.current = context;
      nodeRef.current = node;
      setLocalState('recording');
      onRecordingStart();
    } catch {
      setLocalState('denied');
    }
  }, [enabled, busy, localState, onRecordingStart]);

  const stop = useCallback(() => {
    if (localState !== 'recording') return;
    teardown();
    setLocalState('idle');
    onRecordingStop();
  }, [localState, teardown, onRecordingStop]);

  let state: MicState;
  if (!enabled) {
    state = 'off';
  } else if (localState === 'denied' || localState === 'unsupported') {
    state = localState;
  } else if (busy && localState !== 'recording') {
    state = 'processing';
  } else {
    state = localState;
  }

  return { state, start, stop };
}
