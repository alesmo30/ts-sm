import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseAudioPlaybackResult {
  /** true mientras hay audio sonando o pendiente de sonar en la cola. */
  isPlaying: boolean;
  enqueue: (bytes: ArrayBuffer) => void;
  /** 0.5 | 1 | 1.5 | 2 — aplica a los chunks encolados desde este punto en adelante. */
  rate: number;
  setRate: (rate: number) => void;
  /** Corta el audio en curso y silencia los chunks que sigan llegando de este turno. */
  stop: () => void;
  /** Vuelve a habilitar la reproducción — se llama al arrancar un turno nuevo. */
  reset: () => void;
}

/**
 * Cola de reproducción con Web Audio API: cada chunk de TTS se decodifica y se
 * agenda para sonar apenas termina el anterior, sin esperar a que llegue el
 * audio completo de la respuesta (streaming por frase, ver SPEC 06 decisión 10).
 */
export function useAudioPlayback(): UseAudioPlaybackResult {
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRateState] = useState(1);
  const rateRef = useRef(1);
  const contextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const pendingCountRef = useRef(0);
  const activeSourcesRef = useRef(new Set<AudioBufferSourceNode>());
  // true tras un stop() manual: silencia chunks que ya estaban en vuelo del
  // servidor para este turno, hasta que reset() los vuelva a habilitar.
  const mutedRef = useRef(false);

  useEffect(
    () => () => {
      void contextRef.current?.close();
      contextRef.current = null;
    },
    [],
  );

  const setRate = useCallback((next: number) => {
    rateRef.current = next;
    setRateState(next);
  }, []);

  const getContext = useCallback((): AudioContext => {
    if (!contextRef.current) {
      contextRef.current = new AudioContext();
      nextStartTimeRef.current = 0;
    }
    return contextRef.current;
  }, []);

  const enqueue = useCallback(
    (bytes: ArrayBuffer) => {
      if (mutedRef.current) return;
      const context = getContext();
      const activeRate = rateRef.current;
      pendingCountRef.current += 1;
      setIsPlaying(true);

      context.decodeAudioData(bytes).then(
        (audioBuffer) => {
          if (mutedRef.current) return;
          const source = context.createBufferSource();
          source.buffer = audioBuffer;
          source.playbackRate.value = activeRate;
          source.connect(context.destination);

          const startAt = Math.max(context.currentTime, nextStartTimeRef.current);
          source.start(startAt);
          nextStartTimeRef.current = startAt + audioBuffer.duration / activeRate;
          activeSourcesRef.current.add(source);

          source.onended = () => {
            activeSourcesRef.current.delete(source);
            pendingCountRef.current -= 1;
            if (pendingCountRef.current <= 0) setIsPlaying(false);
          };
        },
        () => {
          if (mutedRef.current) return;
          pendingCountRef.current -= 1;
          if (pendingCountRef.current <= 0) setIsPlaying(false);
        },
      );
    },
    [getContext],
  );

  const stop = useCallback(() => {
    mutedRef.current = true;
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
      } catch {
        // ya pudo haber terminado por su cuenta entre el chequeo y el stop().
      }
    }
    activeSourcesRef.current.clear();
    pendingCountRef.current = 0;
    nextStartTimeRef.current = 0;
    setIsPlaying(false);
  }, []);

  const reset = useCallback(() => {
    mutedRef.current = false;
  }, []);

  return { isPlaying, enqueue, rate, setRate, stop, reset };
}
