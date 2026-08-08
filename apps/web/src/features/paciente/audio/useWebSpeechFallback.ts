import { useCallback, useEffect, useRef, useState } from 'react';

import type { MicState } from './useMicrophone';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionConstructor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export interface UseWebSpeechFallbackOptions {
  enabled: boolean;
  busy: boolean;
  onFinalTranscript: (text: string) => void;
}

export interface UseWebSpeechFallbackResult {
  state: MicState;
  start: () => void;
  stop: () => void;
  speak: (text: string, rate?: number) => void;
  /** true mientras speechSynthesis está leyendo la respuesta en voz. */
  isSpeaking: boolean;
  /** Corta la lectura en curso, si la hay. */
  cancel: () => void;
}

/**
 * Fallback simétrico de voz (RA.5): SpeechRecognition para STT y speechSynthesis
 * para TTS, ambos en el navegador. El backend no ve audio en este modo — el
 * texto reconocido viaja por el mismo user_message que si se hubiera escrito.
 */
export function useWebSpeechFallback({
  enabled,
  busy,
  onFinalTranscript,
}: UseWebSpeechFallbackOptions): UseWebSpeechFallbackResult {
  const [localState, setLocalState] = useState<'idle' | 'recording' | 'denied' | 'unsupported'>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onFinalTranscript);
  onFinalRef.current = onFinalTranscript;

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const start = useCallback(() => {
    if (!enabled || busy || localState === 'recording') return;
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setLocalState('unsupported');
      return;
    }

    const recognition = new Ctor();
    recognition.lang = 'es-CO';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1]?.[0]?.transcript?.trim();
      if (transcript) onFinalRef.current(transcript);
    };
    recognition.onerror = () => setLocalState('denied');
    recognition.onend = () => setLocalState((current) => (current === 'recording' ? 'idle' : current));

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setLocalState('recording');
    } catch {
      setLocalState('denied');
    }
  }, [enabled, busy, localState]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const speak = useCallback((text: string, rate = 1) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-CO';
    utterance.rate = rate;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

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

  return { state, start, stop, speak, isSpeaking, cancel };
}
