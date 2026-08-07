import { Test } from '@nestjs/testing';
import type { CreateTranscriptTurnInput, SessionDetail, TranscriptTurn } from '@ts-sm/shared';

import { LlmPort } from '../llm/llm.port';
import type { LlmCompletion, LlmDelta, LlmMessage, LlmStructured } from '../llm/llm.types';
import { LlmMetricsService } from '../llm/metrics';
import { SessionsService } from '../sessions/sessions.service';

import { ConversationService } from './conversation.service';

const SESSION_ID = '11111111-1111-1111-1111-111111111111';

class FakePort implements LlmPort {
  readonly providerName = 'mock' as const;
  readonly modelId = 'mock';
  receivedMessages: LlmMessage[] = [];

  complete(): Promise<LlmCompletion> {
    throw new Error('no usado en este test');
  }

  async *stream(messages: LlmMessage[]): AsyncIterable<LlmDelta> {
    this.receivedMessages = messages;
    const words = ['hola', ' cómo', ' vas'];
    for (const word of words) {
      yield { type: 'text', text: word };
    }
    yield {
      type: 'done',
      completion: {
        text: words.join(''),
        model: 'mock',
        usage: { inputTokens: 5, outputTokens: 3, costUsd: 0 },
        latencyMs: 15,
      },
    };
  }

  structured<T>(): Promise<LlmStructured<T>> {
    throw new Error('no usado en este test');
  }
}

function fakeTurn(overrides: Partial<TranscriptTurn>): TranscriptTurn {
  return {
    id: `turn-${overrides.seq ?? 0}`,
    sessionId: SESSION_ID,
    seq: overrides.seq ?? 0,
    who: 'patient',
    text: '',
    isVoice: false,
    at: new Date(),
    citations: [],
    kbVersion: 1,
    ...overrides,
  };
}

describe('ConversationService', () => {
  it('persiste el turno del paciente, transmite el system prompt + historial, y persiste el turno del asistente', async () => {
    const savedTurns: TranscriptTurn[] = [];
    let seq = 0;

    const sessionsService = {
      addTurn: jest.fn((_sessionId: string, input: CreateTranscriptTurnInput) => {
        const turn = fakeTurn({ seq: seq++, who: input.who, text: input.text, isVoice: input.isVoice });
        savedTurns.push(turn);
        return Promise.resolve(turn);
      }),
      getDetail: jest.fn(() =>
        Promise.resolve({
          id: SESSION_ID,
          turns: savedTurns,
        } as unknown as SessionDetail),
      ),
    };

    const port = new FakePort();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationService,
        LlmMetricsService,
        { provide: SessionsService, useValue: sessionsService },
        { provide: LlmPort, useValue: port },
      ],
    }).compile();

    const service = moduleRef.get(ConversationService);
    const metrics = moduleRef.get(LlmMetricsService);

    const events: unknown[] = [];
    await service.handleUserMessage(SESSION_ID, '¿cómo va mi recuperación?', (event) => events.push(event));

    expect(sessionsService.addTurn).toHaveBeenCalledTimes(2);
    expect(sessionsService.addTurn.mock.calls[0][1]).toMatchObject({ who: 'patient', text: '¿cómo va mi recuperación?' });
    expect(sessionsService.addTurn.mock.calls[1][1]).toMatchObject({ who: 'assistant', text: 'hola cómo vas' });

    expect(port.receivedMessages[0]).toMatchObject({ role: 'system' });
    expect(port.receivedMessages[1]).toMatchObject({ role: 'user', content: '¿cómo va mi recuperación?' });

    const types = events.map((event) => (event as { type: string }).type);
    expect(types).toEqual(['turn_saved', 'delta', 'delta', 'delta', 'done']);

    const deltaText = events
      .filter((event) => (event as { type: string }).type === 'delta')
      .map((event) => (event as { text: string }).text)
      .join('');
    expect(deltaText).toBe('hola cómo vas');

    expect(metrics.getSnapshot().totalCalls).toBe(1);
    expect(metrics.getSnapshot().recent[0].ok).toBe(true);
  });

  it('emite un evento error y no rompe si el puerto falla', async () => {
    const savedTurns: TranscriptTurn[] = [];
    const sessionsService = {
      addTurn: jest.fn((_sessionId: string, input: CreateTranscriptTurnInput) => {
        const turn = fakeTurn({ seq: savedTurns.length, who: input.who, text: input.text });
        savedTurns.push(turn);
        return Promise.resolve(turn);
      }),
      getDetail: jest.fn(() => Promise.resolve({ id: SESSION_ID, turns: savedTurns } as unknown as SessionDetail)),
    };

    class FailingPort extends FakePort {
      // eslint-disable-next-line require-yield
      async *stream(): AsyncIterable<LlmDelta> {
        throw new Error('proveedor caído');
      }
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationService,
        LlmMetricsService,
        { provide: SessionsService, useValue: sessionsService },
        { provide: LlmPort, useValue: new FailingPort() },
      ],
    }).compile();

    const service = moduleRef.get(ConversationService);
    const events: unknown[] = [];

    await service.handleUserMessage(SESSION_ID, 'hola', (event) => events.push(event));

    expect(sessionsService.addTurn).toHaveBeenCalledTimes(1);
    expect(events.map((event) => (event as { type: string }).type)).toEqual(['turn_saved', 'error']);
  });
});
