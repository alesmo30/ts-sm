import { SessionSchema, type Session } from '@ts-sm/shared';
import { useCallback, useState } from 'react';

import { apiClient } from '../../../shared/lib/apiClient';

// Paciente fijo de demo: DESIGN.md §8 no define ningún formulario de alta,
// un clic en "Comenzar" debe bastar para empezar a conversar.
const DEMO_PATIENT = {
  patientName: 'Paciente de demostración',
  procedure: 'Seguimiento post-operatorio',
};

export interface UseSessionLifecycleResult {
  sessionId: string | null;
  isStarting: boolean;
  isClosing: boolean;
  start: () => Promise<Session>;
  close: () => Promise<Session | null>;
  /** Vuelve a la pantalla de inicio sin llamar al backend — usar tras close(). */
  reset: () => void;
}

export function useSessionLifecycle(): UseSessionLifecycleResult {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const start = useCallback(async () => {
    setIsStarting(true);
    try {
      const session = await apiClient.post('/sessions', SessionSchema, DEMO_PATIENT);
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
      setIsClosing(false);
    }
  }, [sessionId]);

  const reset = useCallback(() => setSessionId(null), []);

  return { sessionId, isStarting, isClosing, start, close, reset };
}
