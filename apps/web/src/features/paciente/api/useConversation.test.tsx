import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useConversation } from './useConversation';

const SESSION_ID = '11111111-1111-1111-1111-111111111111';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static OPEN = 1;

  readyState = FakeWebSocket.OPEN;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    // no-op para el test
  }

  emit(event: unknown): void {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}

function sessionDetailFixture(turns: unknown[] = []) {
  return {
    id: SESSION_ID,
    code: 'SES-4826',
    date: '2026-08-06',
    time: '10:00',
    patientName: 'Paciente Demo',
    procedure: 'Procedimiento demo',
    status: 'ok',
    kbVersion: 1,
    summary: null,
    structuredSummary: null,
    createdAt: '2026-08-06T10:00:00.000Z',
    turns,
  };
}

let turnCounter = 0;

function turnFixture(overrides: Record<string, unknown>) {
  turnCounter += 1;
  return {
    id: `22222222-2222-2222-2222-${String(turnCounter).padStart(12, '0')}`,
    sessionId: SESSION_ID,
    seq: 0,
    who: 'patient',
    text: '',
    isVoice: false,
    at: '2026-08-06T10:00:01.000Z',
    citations: [],
    kbVersion: 1,
    ...overrides,
  };
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sessionDetailFixture()),
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useConversation', () => {
  it('procesa turn_saved → deltas → done dejando el hilo con dos turnos y sin streaming', async () => {
    const { result } = renderHook(() => useConversation(SESSION_ID));

    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0];

    act(() => {
      socket.emit({ type: 'turn_saved', turn: turnFixture({ seq: 0, who: 'patient', text: 'hola' }) });
    });
    expect(result.current.isStreaming).toBe(true);

    act(() => {
      socket.emit({ type: 'delta', text: 'hola ' });
      socket.emit({ type: 'delta', text: 'paciente' });
    });
    expect(result.current.streamingText).toBe('hola paciente');

    act(() => {
      socket.emit({
        type: 'done',
        turn: turnFixture({ seq: 1, who: 'assistant', text: 'hola paciente' }),
      });
    });

    expect(result.current.turns).toHaveLength(2);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamingText).toBe('');
  });

  it('descarta un evento que no valida contra el contrato sin romper el hilo', async () => {
    const { result } = renderHook(() => useConversation(SESSION_ID));

    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0];

    act(() => {
      socket.emit({ type: 'delta' }); // sin 'text', inválido contra el schema
    });

    expect(result.current.turns).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it('send() serializa el evento user_message con el sessionId', async () => {
    const { result } = renderHook(() => useConversation(SESSION_ID));

    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0];

    act(() => {
      result.current.send('¿cómo va mi recuperación?');
    });

    expect(socket.sent).toHaveLength(1);
    const parsed = JSON.parse(socket.sent[0]);
    expect(parsed).toEqual({
      event: 'user_message',
      data: { type: 'user_message', sessionId: SESSION_ID, text: '¿cómo va mi recuperación?', isVoice: false },
    });
  });

  it('send(text, true) marca isVoice:true en el evento serializado', async () => {
    const { result } = renderHook(() => useConversation(SESSION_ID));

    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0];

    act(() => {
      result.current.send('tengo dolor', true);
    });

    const parsed = JSON.parse(socket.sent[0]);
    expect(parsed.data).toMatchObject({ isVoice: true });
  });

  it('stt_result dispara onTranscript sin enviar nada por el socket ni tocar los turnos', async () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useConversation(SESSION_ID, { onTranscript }));

    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0];

    act(() => {
      socket.emit({ type: 'stt_status', state: 'transcribing' });
    });
    expect(result.current.sttStatus).toBe('transcribing');

    act(() => {
      socket.emit({ type: 'stt_result', text: 'tengo dolor en la incisión' });
    });

    expect(onTranscript).toHaveBeenCalledWith('tengo dolor en la incisión');
    expect(result.current.sttStatus).toBe('idle');
    expect(result.current.turns).toHaveLength(0);
    expect(socket.sent).toHaveLength(0);
  });

  it('carga los turnos previos vía GET /sessions/:id al montar', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sessionDetailFixture([turnFixture({ seq: 0, who: 'patient', text: 'previo' })])),
    });

    const { result } = renderHook(() => useConversation(SESSION_ID));

    await waitFor(() => expect(result.current.turns).toHaveLength(1));
    expect(result.current.turns[0].text).toBe('previo');
  });
});
