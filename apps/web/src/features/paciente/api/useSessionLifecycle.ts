import {
  CreateSessionSchema,
  SessionDetailSchema,
  SessionSchema,
  type CreateSessionInput,
  type Session,
} from '@ts-sm/shared';
import { useCallback, useEffect, useState } from 'react';

import { apiClient } from '../../../shared/lib/apiClient';

const STORAGE_KEY = 'ts-sm:paciente:sessionId';

export interface UseSessionLifecycleResult {
  sessionId: string | null;
  isStarting: boolean;
  isClosing: boolean;
  /** true mientras se intenta recuperar una sesión abierta guardada localmente. */
  isRestoring: boolean;
  start: (input: CreateSessionInput) => Promise<Session>;
  close: () => Promise<Session | null>;
  /** Vuelve a la pantalla de inicio sin llamar al backend — usar tras close(). */
  reset: () => void;
}

export function useSessionLifecycle(): UseSessionLifecycleResult {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);

  // Al montar (primera carga o F5), recupera una sesión abierta guardada en
  // este navegador — sin esto, cualquier recarga accidental pierde el hilo
  // completo de la conversación. El backend ya cierra sesiones inactivas a
  // los 10 minutos (ver INACTIVITY_TIMEOUT_MS): si la guardada ya está
  // cerrada o no existe, simplemente se descarta y arranca la pantalla de
  // pre-sesión de siempre.
  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (!savedId) {
      setIsRestoring(false);
      return;
    }

    let cancelled = false;
    apiClient
      .get(`/sessions/${savedId}`, SessionDetailSchema)
      .then((detail) => {
        if (cancelled) return;
        if (detail.closedAt === null) {
          setSessionId(detail.id);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      })
      .catch(() => {
        if (!cancelled) localStorage.removeItem(STORAGE_KEY);
      })
      .finally(() => {
        if (!cancelled) setIsRestoring(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const start = useCallback(async (input: CreateSessionInput) => {
    setIsStarting(true);
    try {
      const session = await apiClient.post('/sessions', SessionSchema, CreateSessionSchema.parse(input));
      localStorage.setItem(STORAGE_KEY, session.id);
      setSessionId(session.id);
      return session;
    } finally {
      setIsStarting(false);
    }
  }, []);

  const close = useCallback(async () => {
    if (!sessionId) return null;
    setIsClosing(true);
    try {
      return await apiClient.post(`/sessions/${sessionId}/close`, SessionSchema.nullable(), {});
    } finally {
      localStorage.removeItem(STORAGE_KEY);
      setIsClosing(false);
    }
  }, [sessionId]);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSessionId(null);
  }, []);

  return { sessionId, isStarting, isClosing, isRestoring, start, close, reset };
}
