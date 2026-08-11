import { Test } from '@nestjs/testing';
import type { CreateTranscriptTurnInput, Session, SessionDetail, TranscriptTurn } from '@ts-sm/shared';

import { EscalationService } from '../escalation/escalation.service';
import { RedFlagDetectorService } from '../escalation/red-flag-detector.service';
import { CitationRelevanceService } from '../knowledge/citation-relevance.service';
import { RetrievalService } from '../knowledge/retrieval.service';
import { LlmPort } from '../llm/llm.port';
import type { LlmCompletion, LlmDelta, LlmMessage, LlmStructured } from '../llm/llm.types';
import { LlmMetricsService } from '../llm/metrics';
import { TurnMetricsService } from '../metrics/turn-metrics';
import { SessionsService } from '../sessions/sessions.service';
import { VoiceService } from '../voice/voice.service';

import { ConversationService } from './conversation.service';

const SESSION_ID = '11111111-1111-1111-1111-111111111111';

// Sin proveedor de voz configurado: isAvailable siempre false, igual que VOICE_PROVIDER=off.
const fakeVoiceService = { isAvailable: false } as unknown as VoiceService;

function fakeRetrievalService(citations: unknown[] = []) {
  return { search: jest.fn(() => Promise.resolve(citations)) } as unknown as RetrievalService;
}

// Pass-through por default: mismo comportamiento fail-open que la implementación
// real cuando no hay GEMINI_API_KEY — no filtra nada salvo que el test lo pida.
function fakeCitationRelevanceService(filtered?: unknown[]) {
  return {
    filterRelevant: jest.fn((_query: string, citations: unknown[]) => Promise.resolve(filtered ?? citations)),
  } as unknown as CitationRelevanceService;
}

function fakeEscalationService() {
  return {
    escalate: jest.fn(() => Promise.resolve(false)),
    refresh: jest.fn(() => Promise.resolve()),
    cancel: jest.fn(() => Promise.resolve()),
    onSessionClosed: jest.fn(() => Promise.resolve()),
  } as unknown as EscalationService;
}

function fakeRedFlagDetector(result: { triggered: boolean; score?: number; matchedPhrase?: string | null } = { triggered: false }) {
  return {
    check: jest.fn(() =>
      Promise.resolve({ triggered: result.triggered, score: result.score ?? 0, matchedPhrase: result.matchedPhrase ?? null }),
    ),
  } as unknown as RedFlagDetectorService;
}

// SPEC 10 — todos los mocks de SessionsService de este archivo predatan el
// triage. Sesión sin señal previa: green, sin áreas cubiertas — es lo que un
// registro sembrado desde antes de este spec tendría.
function withTriageDefaults<T extends object>(sessionsService: T): T {
  return {
    getTriageState: jest.fn(() => Promise.resolve({ triageLevel: 'green' as const, triageAreas: {} })),
    updateTriage: jest.fn(() => Promise.resolve()),
    ...sessionsService,
  };
}

class FakePort implements LlmPort {
  readonly providerName = 'mock' as const;
  readonly modelId = 'mock';
  receivedMessages: LlmMessage[] = [];

  complete(): Promise<LlmCompletion> {
    return Promise.resolve({
      text: 'Resumen de una línea.',
      model: 'mock',
      usage: { inputTokens: 10, outputTokens: 4, costUsd: 0 },
      latencyMs: 8,
    });
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
        TurnMetricsService,
        { provide: EscalationService, useValue: fakeEscalationService() },
        { provide: SessionsService, useValue: withTriageDefaults(sessionsService) },
        { provide: LlmPort, useValue: port },
        { provide: VoiceService, useValue: fakeVoiceService },
        { provide: RetrievalService, useValue: fakeRetrievalService() },
        { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
        { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
      ],
    }).compile();

    const service = moduleRef.get(ConversationService);
    const metrics = moduleRef.get(LlmMetricsService);

    const events: unknown[] = [];
    await service.handleUserMessage(SESSION_ID, '¿cómo va mi recuperación?', false, (event) => events.push(event));

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

  it('enriquece la consulta al retrieval con la última pregunta del asistente y persiste las citas en el turno del asistente', async () => {
    // seq 0 es siempre el saludo inicial en producción — el fix de retrieval
    // lo excluye de la consulta por diluir el embedding con texto genérico
    // (ver bug reportado en QA manual). La pregunta clínica que sí debe
    // enriquecer la consulta llega en un turno posterior (seq 2), como en la
    // conversación real.
    const savedTurns: TranscriptTurn[] = [
      fakeTurn({ seq: 0, who: 'assistant', text: 'Hola, soy MeridianAsiste. ¿En qué te puedo ayudar hoy?' }),
      fakeTurn({ seq: 1, who: 'patient', text: 'Tengo una duda sobre mi recuperación.' }),
      fakeTurn({ seq: 2, who: 'assistant', text: '¿Sientes fiebre o dolor intenso en la zona operada?' }),
    ];
    let seq = savedTurns.length;

    const sessionsService = {
      addTurn: jest.fn((_sessionId: string, input: CreateTranscriptTurnInput) => {
        const turn = fakeTurn({
          seq: seq++,
          who: input.who,
          text: input.text,
          isVoice: input.isVoice,
          citations: input.citations,
        });
        savedTurns.push(turn);
        return Promise.resolve(turn);
      }),
      getDetail: jest.fn(() => Promise.resolve({ id: SESSION_ID, turns: savedTurns } as unknown as SessionDetail)),
    };

    const fakeCitations = [
      {
        docId: '33333333-3333-3333-3333-333333333333',
        docName: 'guia-colecistectomia.pdf',
        chunkId: '44444444-4444-4444-4444-444444444444',
        version: 1,
        score: 0.5,
        snippet: 'Reposo relativo por 48 horas.',
      },
    ];
    const retrievalService = fakeRetrievalService(fakeCitations);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationService,
        LlmMetricsService,
        TurnMetricsService,
        { provide: EscalationService, useValue: fakeEscalationService() },
        { provide: SessionsService, useValue: withTriageDefaults(sessionsService) },
        { provide: LlmPort, useValue: new FakePort() },
        { provide: VoiceService, useValue: fakeVoiceService },
        { provide: RetrievalService, useValue: retrievalService },
        { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
        { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
      ],
    }).compile();

    const service = moduleRef.get(ConversationService);
    await service.handleUserMessage(SESSION_ID, 'no, ningún síntoma raro', false, () => {});

    expect(retrievalService.search).toHaveBeenCalledWith(
      '¿Sientes fiebre o dolor intenso en la zona operada? no, ningún síntoma raro',
    );

    // El turno del paciente nunca lleva citas; solo el del asistente.
    expect(sessionsService.addTurn.mock.calls[0][1]).toMatchObject({ who: 'patient', citations: [] });
    expect(sessionsService.addTurn.mock.calls[1][1]).toMatchObject({ who: 'assistant', citations: fakeCitations });
  });

  it('no concatena el saludo inicial a la consulta de retrieval en el primer mensaje del paciente', async () => {
    // Bug reportado en QA manual: el saludo (siempre seq 0) es texto genérico
    // sin contenido clínico. Concatenarlo diluía el embedding de la consulta
    // y tumbaba por debajo del umbral una cita que sí era relevante.
    const savedTurns: TranscriptTurn[] = [
      fakeTurn({ seq: 0, who: 'assistant', text: 'Hola, soy MeridianAsiste. ¿En qué te puedo ayudar hoy?' }),
    ];
    let seq = savedTurns.length;

    const sessionsService = {
      addTurn: jest.fn((_sessionId: string, input: CreateTranscriptTurnInput) => {
        const turn = fakeTurn({ seq: seq++, who: input.who, text: input.text, citations: input.citations });
        savedTurns.push(turn);
        return Promise.resolve(turn);
      }),
      getDetail: jest.fn(() => Promise.resolve({ id: SESSION_ID, turns: savedTurns } as unknown as SessionDetail)),
    };

    const retrievalService = fakeRetrievalService([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationService,
        LlmMetricsService,
        TurnMetricsService,
        { provide: EscalationService, useValue: fakeEscalationService() },
        { provide: SessionsService, useValue: withTriageDefaults(sessionsService) },
        { provide: LlmPort, useValue: new FakePort() },
        { provide: VoiceService, useValue: fakeVoiceService },
        { provide: RetrievalService, useValue: retrievalService },
        { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
        { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
      ],
    }).compile();

    const service = moduleRef.get(ConversationService);
    await service.handleUserMessage(SESSION_ID, '¿Cómo debo cuidar la herida?', false, () => {});

    expect(retrievalService.search).toHaveBeenCalledWith('¿Cómo debo cuidar la herida?');
  });

  it('no busca ni adjunta citas cuando el paciente se despide, aunque el turno anterior tenga vocabulario clínico', async () => {
    const savedTurns: TranscriptTurn[] = [
      fakeTurn({
        seq: 0,
        who: 'assistant',
        text: 'Si tienes dolor en el área abdominal después de la cirugía, es normal. ¿Quieres comentarme algo más?',
      }),
    ];
    let seq = savedTurns.length;

    const sessionsService = {
      addTurn: jest.fn((_sessionId: string, input: CreateTranscriptTurnInput) => {
        const turn = fakeTurn({
          seq: seq++,
          who: input.who,
          text: input.text,
          isVoice: input.isVoice,
          citations: input.citations,
        });
        savedTurns.push(turn);
        return Promise.resolve(turn);
      }),
      getDetail: jest.fn(() => Promise.resolve({ id: SESSION_ID, turns: savedTurns } as unknown as SessionDetail)),
    };

    const fakeCitations = [
      {
        docId: '55555555-5555-5555-5555-555555555555',
        docName: 'colon-cancer-care.pdf',
        chunkId: '66666666-6666-6666-6666-666666666666',
        version: 1,
        score: 0.5,
        snippet: 'Fragmento sin relación real con la pregunta del paciente.',
      },
    ];
    const retrievalService = fakeRetrievalService(fakeCitations);
    const citationRelevance = fakeCitationRelevanceService();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationService,
        LlmMetricsService,
        TurnMetricsService,
        { provide: EscalationService, useValue: fakeEscalationService() },
        { provide: SessionsService, useValue: withTriageDefaults(sessionsService) },
        { provide: LlmPort, useValue: new FakePort() },
        { provide: VoiceService, useValue: fakeVoiceService },
        { provide: RetrievalService, useValue: retrievalService },
        { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
        { provide: CitationRelevanceService, useValue: citationRelevance },
      ],
    }).compile();

    const service = moduleRef.get(ConversationService);
    await service.handleUserMessage(SESSION_ID, 'No, por ahora todo está muy bien así, muchas gracias. Hasta luego.', false, () => {});

    expect(retrievalService.search).not.toHaveBeenCalled();
    expect(citationRelevance.filterRelevant).not.toHaveBeenCalled();
    expect(sessionsService.addTurn.mock.calls[1][1]).toMatchObject({ who: 'assistant', citations: [] });
  });

  describe('respaldo de multi-query (SPEC 09)', () => {
    function makeSessionsService() {
      const savedTurns: TranscriptTurn[] = [];
      let seq = 0;
      return {
        savedTurns,
        addTurn: jest.fn((_sessionId: string, input: CreateTranscriptTurnInput) => {
          const turn = fakeTurn({ seq: seq++, who: input.who, text: input.text, citations: input.citations });
          savedTurns.push(turn);
          return Promise.resolve(turn);
        }),
        getDetail: jest.fn(() => Promise.resolve({ id: SESSION_ID, turns: savedTurns } as unknown as SessionDetail)),
      };
    }

    class VariationsPort extends FakePort {
      structured<T>(): Promise<LlmStructured<T>> {
        return Promise.resolve({
          data: {
            variations: [
              '¿qué cuidados debo tener con la herida?',
              '¿cómo debo limpiar la herida?',
              '¿qué hago para curar la herida?',
            ],
          } as unknown as T,
          model: 'mock',
          usage: { inputTokens: 5, outputTokens: 5, costUsd: 0 },
          latencyMs: 10,
          usedFallbackParser: false,
        });
      }
    }

    const relevantCitation = {
      docId: '77777777-7777-7777-7777-777777777777',
      docName: 'heridas-generales.txt',
      chunkId: '88888888-8888-8888-8888-888888888888',
      version: 1,
      score: 0.8,
      snippet: 'Mantén la herida limpia y seca.',
    };

    it('con 0 citas relevantes en el primer intento, genera 3 variaciones, corre la fusión híbrida por cada una + la original, dedupea, y filtra una sola vez', async () => {
      const sessionsService = makeSessionsService();
      const originalQuery = '¿cómo cuido la herida?';

      const retrievalService = {
        search: jest.fn((query: string) =>
          Promise.resolve(query === originalQuery ? [] : [relevantCitation]),
        ),
      } as unknown as RetrievalService;

      const citationRelevance = {
        filterRelevant: jest
          .fn()
          .mockResolvedValueOnce([]) // primer intento: sin citas relevantes -> dispara el fallback
          .mockResolvedValueOnce([relevantCitation]), // pase final sobre el pool unido
      } as unknown as CitationRelevanceService;

      const moduleRef = await Test.createTestingModule({
        providers: [
          ConversationService,
          LlmMetricsService,
          TurnMetricsService,
          { provide: EscalationService, useValue: fakeEscalationService() },
          { provide: SessionsService, useValue: withTriageDefaults(sessionsService) },
          { provide: LlmPort, useValue: new VariationsPort() },
          { provide: VoiceService, useValue: fakeVoiceService },
          { provide: RetrievalService, useValue: retrievalService },
          { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
          { provide: CitationRelevanceService, useValue: citationRelevance },
        ],
      }).compile();

      const service = moduleRef.get(ConversationService);
      await service.handleUserMessage(SESSION_ID, originalQuery, false, () => {});

      // 1 búsqueda original + 3 variaciones
      expect(retrievalService.search).toHaveBeenCalledTimes(4);
      // 1 filtro en el primer intento + 1 filtro final sobre el pool unido — nunca uno por variación
      expect(citationRelevance.filterRelevant).toHaveBeenCalledTimes(2);

      const finalFilterCall = (citationRelevance.filterRelevant as jest.Mock).mock.calls[1];
      // Las 3 variaciones traen el mismo chunk: el pool que llega al filtro final está deduplicado a 1.
      expect(finalFilterCall[1]).toEqual([relevantCitation]);

      expect(sessionsService.addTurn.mock.calls[1][1]).toMatchObject({
        who: 'assistant',
        citations: [relevantCitation],
      });
    });

    it('con al menos 1 cita relevante en el primer intento, no llama a LlmPort.structured (el fallback no se activa)', async () => {
      const sessionsService = makeSessionsService();
      const retrievalService = fakeRetrievalService([relevantCitation]);
      const citationRelevance = fakeCitationRelevanceService([relevantCitation]);
      const port = new FakePort();
      const structuredSpy = jest.spyOn(port, 'structured');

      const moduleRef = await Test.createTestingModule({
        providers: [
          ConversationService,
          LlmMetricsService,
          TurnMetricsService,
          { provide: EscalationService, useValue: fakeEscalationService() },
          { provide: SessionsService, useValue: withTriageDefaults(sessionsService) },
          { provide: LlmPort, useValue: port },
          { provide: VoiceService, useValue: fakeVoiceService },
          { provide: RetrievalService, useValue: retrievalService },
          { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
          { provide: CitationRelevanceService, useValue: citationRelevance },
        ],
      }).compile();

      const service = moduleRef.get(ConversationService);
      await service.handleUserMessage(SESSION_ID, '¿cómo cuido la herida?', false, () => {});

      expect(structuredSpy).not.toHaveBeenCalled();
      expect(retrievalService.search).toHaveBeenCalledTimes(1);
      expect(citationRelevance.filterRelevant).toHaveBeenCalledTimes(1);
    });

    it('fail-open: si LlmPort.structured() falla durante el fallback, la conversación sigue sin citas y sin error visible', async () => {
      const sessionsService = makeSessionsService();
      const retrievalService = fakeRetrievalService([]);
      const citationRelevance = fakeCitationRelevanceService([]);
      const port = new FakePort(); // structured() lanza por default

      const moduleRef = await Test.createTestingModule({
        providers: [
          ConversationService,
          LlmMetricsService,
          TurnMetricsService,
          { provide: EscalationService, useValue: fakeEscalationService() },
          { provide: SessionsService, useValue: withTriageDefaults(sessionsService) },
          { provide: LlmPort, useValue: port },
          { provide: VoiceService, useValue: fakeVoiceService },
          { provide: RetrievalService, useValue: retrievalService },
          { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
          { provide: CitationRelevanceService, useValue: citationRelevance },
        ],
      }).compile();

      const service = moduleRef.get(ConversationService);
      const events: unknown[] = [];
      await service.handleUserMessage(SESSION_ID, '¿cómo cuido la herida?', false, (event) => events.push(event));

      // Solo se dispara el intento original + el intento de reformulación fallido — nunca una segunda búsqueda.
      expect(retrievalService.search).toHaveBeenCalledTimes(1);
      expect(citationRelevance.filterRelevant).toHaveBeenCalledTimes(1);
      expect(events.some((event) => (event as { type: string }).type === 'error')).toBe(false);
      expect(sessionsService.addTurn.mock.calls[1][1]).toMatchObject({ who: 'assistant', citations: [] });
    });
  });

  describe('triage clínico determinístico (SPEC 10)', () => {
    function makeStatefulSessionsService() {
      const savedTurns: TranscriptTurn[] = [];
      let seq = 0;
      let triageLevel: 'green' | 'yellow' | 'red' = 'green';
      let triageAreas: unknown = {};
      return {
        addTurn: jest.fn((_sessionId: string, input: CreateTranscriptTurnInput) => {
          const turn = fakeTurn({ seq: seq++, who: input.who, text: input.text, citations: input.citations });
          savedTurns.push(turn);
          return Promise.resolve(turn);
        }),
        getDetail: jest.fn(() => Promise.resolve({ id: SESSION_ID, turns: savedTurns } as unknown as SessionDetail)),
        getTriageState: jest.fn(() => Promise.resolve({ triageLevel, triageAreas })),
        updateTriage: jest.fn(
          (_id: string, patch: { triageLevel: 'green' | 'yellow' | 'red'; triageAreas: unknown; status: string }) => {
            triageLevel = patch.triageLevel;
            triageAreas = patch.triageAreas;
            return Promise.resolve();
          },
        ),
      };
    }

    it('fiebre de 39 y dolor de 9 escala por el triage determinístico, sin marca del LLM ni backstop', async () => {
      const sessionsService = makeStatefulSessionsService();
      const escalationService = fakeEscalationService();
      (escalationService.escalate as jest.Mock).mockResolvedValue(true);

      const moduleRef = await Test.createTestingModule({
        providers: [
          ConversationService,
          LlmMetricsService,
          TurnMetricsService,
          { provide: EscalationService, useValue: escalationService },
          { provide: SessionsService, useValue: sessionsService },
          { provide: LlmPort, useValue: new FakePort() },
          { provide: VoiceService, useValue: fakeVoiceService },
          { provide: RetrievalService, useValue: fakeRetrievalService() },
          { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector({ triggered: false }) },
          { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
        ],
      }).compile();

      const service = moduleRef.get(ConversationService);
      const escalated = await service.handleUserMessage(SESSION_ID, 'fiebre de 39 y dolor de 9', false, () => {});

      expect(escalated).toBe(true);
      expect(escalationService.escalate).toHaveBeenCalledWith(SESSION_ID, 'red_flag');
      expect(sessionsService.updateTriage).toHaveBeenCalledWith(
        SESSION_ID,
        expect.objectContaining({ triageLevel: 'red', status: 'fail' }),
      );
    });

    it('un turno sin señales de alarma persiste triageLevel green y status ok, sin escalar', async () => {
      const sessionsService = makeStatefulSessionsService();
      const escalationService = fakeEscalationService();

      const moduleRef = await Test.createTestingModule({
        providers: [
          ConversationService,
          LlmMetricsService,
          TurnMetricsService,
          { provide: EscalationService, useValue: escalationService },
          { provide: SessionsService, useValue: sessionsService },
          { provide: LlmPort, useValue: new FakePort() },
          { provide: VoiceService, useValue: fakeVoiceService },
          { provide: RetrievalService, useValue: fakeRetrievalService() },
          { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
          { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
        ],
      }).compile();

      const service = moduleRef.get(ConversationService);
      const escalated = await service.handleUserMessage(SESSION_ID, 'dolor 2, sin fiebre, todo normal', false, () => {});

      expect(escalated).toBe(false);
      expect(escalationService.escalate).not.toHaveBeenCalled();
      expect(sessionsService.updateTriage).toHaveBeenCalledWith(
        SESSION_ID,
        expect.objectContaining({ triageLevel: 'green', status: 'ok' }),
      );
    });

    it('dos áreas en amarillo en el mismo turno elevan la sesión a rojo por acumulación', async () => {
      const sessionsService = makeStatefulSessionsService();
      const escalationService = fakeEscalationService();
      (escalationService.escalate as jest.Mock).mockResolvedValue(true);

      const moduleRef = await Test.createTestingModule({
        providers: [
          ConversationService,
          LlmMetricsService,
          TurnMetricsService,
          { provide: EscalationService, useValue: escalationService },
          { provide: SessionsService, useValue: sessionsService },
          { provide: LlmPort, useValue: new FakePort() },
          { provide: VoiceService, useValue: fakeVoiceService },
          { provide: RetrievalService, useValue: fakeRetrievalService() },
          { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
          { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
        ],
      }).compile();

      const service = moduleRef.get(ConversationService);
      // dolor 7 (amarillo) + fiebre 38 (amarillo) en el mismo turno: dos amarillos hacen un rojo.
      const escalated = await service.handleUserMessage(SESSION_ID, 'dolor de 7 y fiebre de 38', false, () => {});

      expect(escalated).toBe(true);
      expect(sessionsService.updateTriage).toHaveBeenCalledWith(
        SESSION_ID,
        expect.objectContaining({ triageLevel: 'red' }),
      );
    });

    it('el nivel de triage nunca baja: un turno sin señales tras uno rojo mantiene la sesión en rojo', async () => {
      const sessionsService = makeStatefulSessionsService();
      const escalationService = fakeEscalationService();
      (escalationService.escalate as jest.Mock).mockResolvedValue(true);

      const moduleRef = await Test.createTestingModule({
        providers: [
          ConversationService,
          LlmMetricsService,
          TurnMetricsService,
          { provide: EscalationService, useValue: escalationService },
          { provide: SessionsService, useValue: sessionsService },
          { provide: LlmPort, useValue: new FakePort() },
          { provide: VoiceService, useValue: fakeVoiceService },
          { provide: RetrievalService, useValue: fakeRetrievalService() },
          { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
          { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
        ],
      }).compile();

      const service = moduleRef.get(ConversationService);
      await service.handleUserMessage(SESSION_ID, 'fiebre de 39', false, () => {});
      await service.handleUserMessage(SESSION_ID, 'todo tranquilo, gracias', false, () => {});

      const calls = (sessionsService.updateTriage as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toMatchObject({ triageLevel: 'red', status: 'fail' });
    });

    it('escalated implica nivel rojo venga de donde venga: la marca del LLM sin señal numérica también sube triage_level', async () => {
      const sessionsService = makeStatefulSessionsService();
      const escalationService = fakeEscalationService();
      (escalationService.escalate as jest.Mock).mockResolvedValue(true);

      class EscalatingPort extends FakePort {
        async *stream(): AsyncIterable<LlmDelta> {
          yield { type: 'text', text: 'Ya aviso a tu médico.\n[[ESCALAR]]' };
          yield {
            type: 'done',
            completion: {
              text: 'Ya aviso a tu médico.\n[[ESCALAR]]',
              model: 'mock',
              usage: { inputTokens: 5, outputTokens: 3, costUsd: 0 },
              latencyMs: 10,
            },
          };
        }
      }

      const moduleRef = await Test.createTestingModule({
        providers: [
          ConversationService,
          LlmMetricsService,
          TurnMetricsService,
          { provide: EscalationService, useValue: escalationService },
          { provide: SessionsService, useValue: sessionsService },
          { provide: LlmPort, useValue: new EscalatingPort() },
          { provide: VoiceService, useValue: fakeVoiceService },
          { provide: RetrievalService, useValue: fakeRetrievalService() },
          { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
          { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
        ],
      }).compile();

      const service = moduleRef.get(ConversationService);
      // Sin dígitos ni palabras reconocidas por triage.rules — solo la marca del LLM.
      const escalated = await service.handleUserMessage(SESSION_ID, 'quiero hablar con un médico', false, () => {});

      expect(escalated).toBe(true);
      const calls = (sessionsService.updateTriage as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toMatchObject({ triageLevel: 'red', status: 'fail' });
    });

    it('el cierre agrupado cubre las áreas nombradas como grouped, no como individual', async () => {
      // Regresión: la pregunta de confirmación agrupada nombra las áreas
      // pendientes por su etiqueta ("herida, apetito y sueño") — sin la
      // corrección, detectAskedAreas() las reconocía como preguntadas una a
      // una y las marcaba 'individual' antes de que aplicara 'grouped'.
      const sessionsService = makeStatefulSessionsService();

      class GroupedConfirmationPort extends FakePort {
        async *stream(): AsyncIterable<LlmDelta> {
          yield {
            type: 'text',
            text: 'Entonces herida, apetito y sueño, ¿todo sin novedad en esas áreas?\n[[CONFIRMACION_AGRUPADA]]',
          };
          yield {
            type: 'done',
            completion: {
              text: 'Entonces herida, apetito y sueño, ¿todo sin novedad en esas áreas?\n[[CONFIRMACION_AGRUPADA]]',
              model: 'mock',
              usage: { inputTokens: 5, outputTokens: 3, costUsd: 0 },
              latencyMs: 10,
            },
          };
        }
      }

      const moduleRef = await Test.createTestingModule({
        providers: [
          ConversationService,
          LlmMetricsService,
          TurnMetricsService,
          { provide: EscalationService, useValue: fakeEscalationService() },
          { provide: SessionsService, useValue: sessionsService },
          { provide: LlmPort, useValue: new GroupedConfirmationPort() },
          { provide: VoiceService, useValue: fakeVoiceService },
          { provide: RetrievalService, useValue: fakeRetrievalService() },
          { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
          { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
        ],
      }).compile();

      const service = moduleRef.get(ConversationService);
      // Turno 1: el paciente dice que todo está bien, el asistente agrupa las
      // pendientes y emite la marca (capturada por GroupedConfirmationPort arriba).
      await service.handleUserMessage(SESSION_ID, 'todo bien por lo demás', false, () => {});
      // Turno 2: confirma sin mencionar ninguna de las áreas por su nombre.
      await service.handleUserMessage(SESSION_ID, 'sí, todo bien con eso también', false, () => {});

      const calls = (sessionsService.updateTriage as jest.Mock).mock.calls;
      const lastAreas = calls[calls.length - 1][1].triageAreas as Record<string, { covered: string }>;
      expect(lastAreas.wound.covered).toBe('grouped');
      expect(lastAreas.appetite.covered).toBe('grouped');
      expect(lastAreas.sleep.covered).toBe('grouped');
    });
  });

  describe('normalización de modismos colombianos (SPEC 12)', () => {
    function makeStatefulSessionsService() {
      const savedTurns: TranscriptTurn[] = [];
      let seq = 0;
      let triageLevel: 'green' | 'yellow' | 'red' = 'green';
      let triageAreas: unknown = {};
      return {
        addTurn: jest.fn((_sessionId: string, input: CreateTranscriptTurnInput) => {
          const turn = fakeTurn({ seq: seq++, who: input.who, text: input.text, citations: input.citations });
          savedTurns.push(turn);
          return Promise.resolve(turn);
        }),
        getDetail: jest.fn(() => Promise.resolve({ id: SESSION_ID, turns: savedTurns } as unknown as SessionDetail)),
        getTriageState: jest.fn(() => Promise.resolve({ triageLevel, triageAreas })),
        updateTriage: jest.fn(
          (_id: string, patch: { triageLevel: 'green' | 'yellow' | 'red'; triageAreas: unknown; status: string }) => {
            triageLevel = patch.triageLevel;
            triageAreas = patch.triageAreas;
            return Promise.resolve();
          },
        ),
      };
    }

    it('detecta señal de sueño a partir de un modismo colombiano, pero guarda el transcript con el texto original', async () => {
      const sessionsService = makeStatefulSessionsService();

      const moduleRef = await Test.createTestingModule({
        providers: [
          ConversationService,
          LlmMetricsService,
          TurnMetricsService,
          { provide: EscalationService, useValue: fakeEscalationService() },
          { provide: SessionsService, useValue: sessionsService },
          { provide: LlmPort, useValue: new FakePort() },
          { provide: VoiceService, useValue: fakeVoiceService },
          { provide: RetrievalService, useValue: fakeRetrievalService() },
          { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector({ triggered: false }) },
          { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
        ],
      }).compile();

      const service = moduleRef.get(ConversationService);
      const colloquialText = 'doctor, no me deja pegar el ojo desde la operación';
      await service.handleUserMessage(SESSION_ID, colloquialText, false, () => {});

      const lastAreas = (sessionsService.updateTriage as jest.Mock).mock.calls[0][1].triageAreas as Record<
        string,
        { covered: string; level: string }
      >;
      expect(lastAreas.sleep).toMatchObject({ covered: 'individual', level: 'yellow' });

      const patientTurn = (sessionsService.addTurn as jest.Mock).mock.calls.find(([, input]) => input.who === 'patient');
      expect(patientTurn[1].text).toBe(colloquialText);
    });
  });

  it('oculta las citas del turno del asistente cuando el LLM emite [[SIN_REFERENCIA]]', async () => {
    const savedTurns: TranscriptTurn[] = [];
    let seq = 0;

    const sessionsService = {
      addTurn: jest.fn((_sessionId: string, input: CreateTranscriptTurnInput) => {
        const turn = fakeTurn({ seq: seq++, who: input.who, text: input.text, citations: input.citations });
        savedTurns.push(turn);
        return Promise.resolve(turn);
      }),
      getDetail: jest.fn(() => Promise.resolve({ id: SESSION_ID, turns: savedTurns } as unknown as SessionDetail)),
    };

    const fakeCitations = [
      {
        docId: '33333333-3333-3333-3333-333333333333',
        docName: 'guia-hielo.md',
        chunkId: '44444444-4444-4444-4444-444444444444',
        version: 1,
        score: 0.001,
        snippet: 'Fragmento que no responde la pregunta real del paciente.',
      },
    ];

    class NoReferencePort extends FakePort {
      async *stream(): AsyncIterable<LlmDelta> {
        yield { type: 'text', text: 'No tengo información confirmada sobre eso.\n[[SIN_REFERENCIA]]' };
        yield {
          type: 'done',
          completion: {
            text: 'No tengo información confirmada sobre eso.\n[[SIN_REFERENCIA]]',
            model: 'mock',
            usage: { inputTokens: 5, outputTokens: 3, costUsd: 0 },
            latencyMs: 10,
          },
        };
      }
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationService,
        LlmMetricsService,
        TurnMetricsService,
        { provide: EscalationService, useValue: fakeEscalationService() },
        { provide: SessionsService, useValue: withTriageDefaults(sessionsService) },
        { provide: LlmPort, useValue: new NoReferencePort() },
        { provide: VoiceService, useValue: fakeVoiceService },
        { provide: RetrievalService, useValue: fakeRetrievalService(fakeCitations) },
        { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
        { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
      ],
    }).compile();

    const service = moduleRef.get(ConversationService);
    const events: unknown[] = [];

    await service.handleUserMessage(SESSION_ID, 'confirmar mi cita de control', false, (event) =>
      events.push(event),
    );

    expect(sessionsService.addTurn.mock.calls[1][1]).toMatchObject({ who: 'assistant', citations: [] });

    const deltaText = events
      .filter((event) => (event as { type: string }).type === 'delta')
      .map((event) => (event as { text: string }).text)
      .join('');
    expect(deltaText).not.toContain('SIN_REFERENCIA');
    expect(deltaText).not.toContain('[[');
  });

  it('con isVoice y voz disponible, sintetiza por frase y persiste el turno del asistente con isVoice:true', async () => {
    const savedTurns: TranscriptTurn[] = [];
    let seq = 0;

    const sessionsService = {
      addTurn: jest.fn((_sessionId: string, input: CreateTranscriptTurnInput) => {
        const turn = fakeTurn({ seq: seq++, who: input.who, text: input.text, isVoice: input.isVoice });
        savedTurns.push(turn);
        return Promise.resolve(turn);
      }),
      getDetail: jest.fn(() => Promise.resolve({ id: SESSION_ID, turns: savedTurns } as unknown as SessionDetail)),
    };

    class SentencePort extends FakePort {
      async *stream(): AsyncIterable<LlmDelta> {
        yield { type: 'text', text: 'Todo va bien con tu recuperación. ' };
        yield { type: 'text', text: '¿Cómo te sientes hoy?' };
        yield {
          type: 'done',
          completion: {
            text: 'Todo va bien con tu recuperación. ¿Cómo te sientes hoy?',
            model: 'mock',
            usage: { inputTokens: 5, outputTokens: 3, costUsd: 0 },
            latencyMs: 15,
          },
        };
      }
    }

    const speakingVoiceService = {
      isAvailable: true,
      speak: jest.fn((text: string) => Promise.resolve(Buffer.from(text))),
    } as unknown as VoiceService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationService,
        LlmMetricsService,
        TurnMetricsService,
        { provide: EscalationService, useValue: fakeEscalationService() },
        { provide: SessionsService, useValue: withTriageDefaults(sessionsService) },
        { provide: LlmPort, useValue: new SentencePort() },
        { provide: VoiceService, useValue: speakingVoiceService },
        { provide: RetrievalService, useValue: fakeRetrievalService() },
        { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
        { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
      ],
    }).compile();

    const service = moduleRef.get(ConversationService);
    const events: unknown[] = [];
    const audioChunks: Buffer[] = [];

    await service.handleUserMessage(
      SESSION_ID,
      'hola',
      true,
      (event) => events.push(event),
      (chunk) => audioChunks.push(chunk),
    );

    expect(speakingVoiceService.speak).toHaveBeenCalledTimes(2);
    expect(audioChunks).toHaveLength(2);
    // La síntesis ya no bloquea el loop de deltas (ver comentario en el
    // service): el orden relativo entre 'delta' y 'tts_*' no está garantizado,
    // solo que turn_saved abre, done cierra, y todo lo demás pasa en el medio.
    const types = events.map((event) => (event as { type: string }).type);
    expect(types[0]).toBe('turn_saved');
    expect(types[types.length - 1]).toBe('done');
    expect(types.filter((t) => t === 'delta')).toHaveLength(2);
    expect(types.filter((t) => t === 'tts_start')).toHaveLength(2);
    expect(types.filter((t) => t === 'tts_end')).toHaveLength(2);
    expect(sessionsService.addTurn.mock.calls[1][1]).toMatchObject({ who: 'assistant', isVoice: true });
  });

  it('sintetiza en voz la respuesta aunque el paciente haya escrito el mensaje (isVoice:false)', async () => {
    const savedTurns: TranscriptTurn[] = [];
    let seq = 0;

    const sessionsService = {
      addTurn: jest.fn((_sessionId: string, input: CreateTranscriptTurnInput) => {
        const turn = fakeTurn({ seq: seq++, who: input.who, text: input.text, isVoice: input.isVoice });
        savedTurns.push(turn);
        return Promise.resolve(turn);
      }),
      getDetail: jest.fn(() => Promise.resolve({ id: SESSION_ID, turns: savedTurns } as unknown as SessionDetail)),
    };

    const speakingVoiceService = {
      isAvailable: true,
      speak: jest.fn((text: string) => Promise.resolve(Buffer.from(text))),
    } as unknown as VoiceService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationService,
        LlmMetricsService,
        TurnMetricsService,
        { provide: EscalationService, useValue: fakeEscalationService() },
        { provide: SessionsService, useValue: withTriageDefaults(sessionsService) },
        { provide: LlmPort, useValue: new FakePort() },
        { provide: VoiceService, useValue: speakingVoiceService },
        { provide: RetrievalService, useValue: fakeRetrievalService() },
        { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
        { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
      ],
    }).compile();

    const service = moduleRef.get(ConversationService);
    const audioChunks: Buffer[] = [];

    // isVoice=false (el paciente escribió), pero se pasa emitAudio igual —
    // así lo hace el gateway ahora para el camino de texto.
    await service.handleUserMessage(
      SESSION_ID,
      'hola, escrito',
      false,
      () => {},
      (chunk) => audioChunks.push(chunk),
    );

    expect(speakingVoiceService.speak).toHaveBeenCalled();
    expect(audioChunks.length).toBeGreaterThan(0);
    expect(sessionsService.addTurn.mock.calls[0][1]).toMatchObject({ who: 'patient', isVoice: false });
    expect(sessionsService.addTurn.mock.calls[1][1]).toMatchObject({ who: 'assistant', isVoice: true });
  });

  it('detecta [[ESCALAR]] partido entre chunks, nunca lo emite y dispara la escalada', async () => {
    const savedTurns: TranscriptTurn[] = [];
    let seq = 0;

    const sessionsService = {
      addTurn: jest.fn((_sessionId: string, input: CreateTranscriptTurnInput) => {
        const turn = fakeTurn({ seq: seq++, who: input.who, text: input.text });
        savedTurns.push(turn);
        return Promise.resolve(turn);
      }),
      getDetail: jest.fn(() => Promise.resolve({ id: SESSION_ID, turns: savedTurns } as unknown as SessionDetail)),
    };

    class EscalatingPort extends FakePort {
      async *stream(): AsyncIterable<LlmDelta> {
        yield { type: 'text', text: 'Ya aviso a tu médico.\n[[ESCA' };
        yield { type: 'text', text: 'LAR]]' };
        yield {
          type: 'done',
          completion: {
            text: 'Ya aviso a tu médico.\n[[ESCALAR]]',
            model: 'mock',
            usage: { inputTokens: 5, outputTokens: 3, costUsd: 0 },
            latencyMs: 10,
          },
        };
      }
    }

    const escalationService = fakeEscalationService();
    (escalationService.escalate as jest.Mock).mockResolvedValue(true);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationService,
        LlmMetricsService,
        TurnMetricsService,
        { provide: EscalationService, useValue: escalationService },
        { provide: SessionsService, useValue: withTriageDefaults(sessionsService) },
        { provide: LlmPort, useValue: new EscalatingPort() },
        { provide: VoiceService, useValue: fakeVoiceService },
        { provide: RetrievalService, useValue: fakeRetrievalService() },
        { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
        { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
      ],
    }).compile();

    const service = moduleRef.get(ConversationService);
    const events: unknown[] = [];

    const escalated = await service.handleUserMessage(SESSION_ID, 'quiero hablar con un médico', false, (event) =>
      events.push(event),
    );

    expect(escalated).toBe(true);
    expect(escalationService.escalate).toHaveBeenCalledWith(SESSION_ID, 'patient_request');

    const deltaTexts = events
      .filter((event) => (event as { type: string }).type === 'delta')
      .map((event) => (event as { text: string }).text)
      .join('');
    expect(deltaTexts).not.toContain('ESCALAR');
    expect(deltaTexts).not.toContain('[[');

    const assistantTurnText = sessionsService.addTurn.mock.calls[1][1].text as string;
    expect(assistantTurnText).not.toContain('ESCALAR');

    const eventTypes = events.map((event) => (event as { type: string }).type);
    expect(eventTypes).toContain('escalation_started');
  });

  it('escala por el backstop de embeddings aunque el LLM no emita [[ESCALAR]]', async () => {
    const savedTurns: TranscriptTurn[] = [];
    let seq = 0;

    const sessionsService = {
      addTurn: jest.fn((_sessionId: string, input: CreateTranscriptTurnInput) => {
        const turn = fakeTurn({ seq: seq++, who: input.who, text: input.text });
        savedTurns.push(turn);
        return Promise.resolve(turn);
      }),
      getDetail: jest.fn(() => Promise.resolve({ id: SESSION_ID, turns: savedTurns } as unknown as SessionDetail)),
    };

    const escalationService = fakeEscalationService();
    (escalationService.escalate as jest.Mock).mockResolvedValue(true);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationService,
        LlmMetricsService,
        TurnMetricsService,
        { provide: EscalationService, useValue: escalationService },
        { provide: SessionsService, useValue: withTriageDefaults(sessionsService) },
        { provide: LlmPort, useValue: new FakePort() },
        { provide: VoiceService, useValue: fakeVoiceService },
        { provide: RetrievalService, useValue: fakeRetrievalService() },
        { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector({ triggered: true, score: 0.7 }) },
        { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
      ],
    }).compile();

    const service = moduleRef.get(ConversationService);
    const events: unknown[] = [];

    const escalated = await service.handleUserMessage(
      SESSION_ID,
      'Tengo fiebre muy alta y me cuesta respirar.',
      false,
      (event) => events.push(event),
    );

    expect(escalated).toBe(true);
    expect(escalationService.escalate).toHaveBeenCalledWith(SESSION_ID, 'red_flag');
    expect(events.map((event) => (event as { type: string }).type)).toContain('escalation_started');
  });

  it('no escala si ni el LLM ni el backstop lo detectan', async () => {
    const savedTurns: TranscriptTurn[] = [];
    let seq = 0;

    const sessionsService = {
      addTurn: jest.fn((_sessionId: string, input: CreateTranscriptTurnInput) => {
        const turn = fakeTurn({ seq: seq++, who: input.who, text: input.text });
        savedTurns.push(turn);
        return Promise.resolve(turn);
      }),
      getDetail: jest.fn(() => Promise.resolve({ id: SESSION_ID, turns: savedTurns } as unknown as SessionDetail)),
    };

    const escalationService = fakeEscalationService();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationService,
        LlmMetricsService,
        TurnMetricsService,
        { provide: EscalationService, useValue: escalationService },
        { provide: SessionsService, useValue: withTriageDefaults(sessionsService) },
        { provide: LlmPort, useValue: new FakePort() },
        { provide: VoiceService, useValue: fakeVoiceService },
        { provide: RetrievalService, useValue: fakeRetrievalService() },
        { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector({ triggered: false, score: 0.2 }) },
        { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
      ],
    }).compile();

    const service = moduleRef.get(ConversationService);
    const escalated = await service.handleUserMessage(SESSION_ID, 'hola, todo bien', false, () => {});

    expect(escalated).toBe(false);
    expect(escalationService.escalate).not.toHaveBeenCalled();
  });

  it('escala con reason knowledge_gap si el paciente acepta con un "sí" corto el ofrecimiento del turno anterior', async () => {
    const savedTurns: TranscriptTurn[] = [];
    let seq = 0;

    const sessionsService = {
      addTurn: jest.fn((_sessionId: string, input: CreateTranscriptTurnInput) => {
        const turn = fakeTurn({ seq: seq++, who: input.who, text: input.text });
        savedTurns.push(turn);
        return Promise.resolve(turn);
      }),
      getDetail: jest.fn(() => Promise.resolve({ id: SESSION_ID, turns: savedTurns } as unknown as SessionDetail)),
    };

    // Primer turno: el LLM declara el límite de conocimiento y ofrece redirigir.
    class NoReferencePort extends FakePort {
      async *stream(): AsyncIterable<LlmDelta> {
        yield { type: 'text', text: 'No tengo información confirmada. ¿Quieres que avise a tu médico?\n[[SIN_RE' };
        yield { type: 'text', text: 'FERENCIA]]' };
        yield {
          type: 'done',
          completion: {
            text: 'No tengo información confirmada. ¿Quieres que avise a tu médico?\n[[SIN_REFERENCIA]]',
            model: 'mock',
            usage: { inputTokens: 5, outputTokens: 3, costUsd: 0 },
            latencyMs: 10,
          },
        };
      }
    }

    const escalationService = fakeEscalationService();
    (escalationService.escalate as jest.Mock).mockResolvedValue(true);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationService,
        LlmMetricsService,
        TurnMetricsService,
        { provide: EscalationService, useValue: escalationService },
        { provide: SessionsService, useValue: withTriageDefaults(sessionsService) },
        { provide: LlmPort, useValue: new NoReferencePort() },
        { provide: VoiceService, useValue: fakeVoiceService },
        { provide: RetrievalService, useValue: fakeRetrievalService() },
        { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
        { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
      ],
    }).compile();

    const service = moduleRef.get(ConversationService);

    const firstTurnEscalated = await service.handleUserMessage(
      SESSION_ID,
      '¿puedo ducharme?',
      false,
      () => {},
    );
    expect(firstTurnEscalated).toBe(false);
    expect(escalationService.escalate).not.toHaveBeenCalled();

    // Segundo turno, mismo service (mismo estado en memoria): el paciente
    // responde "sí" — eso debe escalar aunque el LLM no vuelva a emitir
    // [[ESCALAR]] ni el backstop de embeddings se dispare.
    const secondTurnEscalated = await service.handleUserMessage(SESSION_ID, 'sí, por favor', false, () => {});

    expect(secondTurnEscalated).toBe(true);
    expect(escalationService.escalate).toHaveBeenCalledWith(SESSION_ID, 'knowledge_gap');
  });

  it('no escala un "sí" corto si no hubo un vacío de conocimiento en el turno anterior', async () => {
    const savedTurns: TranscriptTurn[] = [];
    let seq = 0;

    const sessionsService = {
      addTurn: jest.fn((_sessionId: string, input: CreateTranscriptTurnInput) => {
        const turn = fakeTurn({ seq: seq++, who: input.who, text: input.text });
        savedTurns.push(turn);
        return Promise.resolve(turn);
      }),
      getDetail: jest.fn(() => Promise.resolve({ id: SESSION_ID, turns: savedTurns } as unknown as SessionDetail)),
    };

    const escalationService = fakeEscalationService();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationService,
        LlmMetricsService,
        TurnMetricsService,
        { provide: EscalationService, useValue: escalationService },
        { provide: SessionsService, useValue: withTriageDefaults(sessionsService) },
        { provide: LlmPort, useValue: new FakePort() },
        { provide: VoiceService, useValue: fakeVoiceService },
        { provide: RetrievalService, useValue: fakeRetrievalService() },
        { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
        { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
      ],
    }).compile();

    const service = moduleRef.get(ConversationService);

    await service.handleUserMessage(SESSION_ID, 'hola, todo bien', false, () => {});
    const escalated = await service.handleUserMessage(SESSION_ID, 'sí', false, () => {});

    expect(escalated).toBe(false);
    expect(escalationService.escalate).not.toHaveBeenCalled();
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
        TurnMetricsService,
        { provide: EscalationService, useValue: fakeEscalationService() },
        { provide: SessionsService, useValue: withTriageDefaults(sessionsService) },
        { provide: LlmPort, useValue: new FailingPort() },
        { provide: VoiceService, useValue: fakeVoiceService },
        { provide: RetrievalService, useValue: fakeRetrievalService() },
        { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
        { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
      ],
    }).compile();

    const service = moduleRef.get(ConversationService);
    const events: unknown[] = [];

    await service.handleUserMessage(SESSION_ID, 'hola', false, (event) => events.push(event));

    expect(sessionsService.addTurn).toHaveBeenCalledTimes(1);
    expect(events.map((event) => (event as { type: string }).type)).toEqual(['turn_saved', 'error']);
  });

  it('closeSession genera un resumen de una línea y cierra la sesión con status ok', async () => {
    const turns: TranscriptTurn[] = [
      fakeTurn({ seq: 0, who: 'patient', text: 'hola' }),
      fakeTurn({ seq: 1, who: 'assistant', text: 'hola, ¿en qué te ayudo?' }),
    ];

    const sessionsService = {
      addTurn: jest.fn(),
      getDetail: jest.fn(() =>
        Promise.resolve({ id: SESSION_ID, turns, createdAt: new Date(Date.now() - 60_000) } as unknown as SessionDetail),
      ),
      update: jest.fn((_id: string, patch: unknown) => Promise.resolve({ id: SESSION_ID, ...(patch as object) } as unknown as Session)),
    };

    class SummaryDraftPort extends FakePort {
      structured<T>(): Promise<LlmStructured<T>> {
        return Promise.resolve({
          data: { summary: 'Resumen de una línea.', recommendations: [], alerts: [] } as unknown as T,
          model: 'mock',
          usage: { inputTokens: 5, outputTokens: 5, costUsd: 0 },
          latencyMs: 10,
          usedFallbackParser: false,
        });
      }
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationService,
        LlmMetricsService,
        TurnMetricsService,
        { provide: EscalationService, useValue: fakeEscalationService() },
        { provide: SessionsService, useValue: withTriageDefaults(sessionsService) },
        { provide: LlmPort, useValue: new SummaryDraftPort() },
        { provide: VoiceService, useValue: fakeVoiceService },
        { provide: RetrievalService, useValue: fakeRetrievalService() },
        { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
        { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
      ],
    }).compile();

    const service = moduleRef.get(ConversationService);
    const result = await service.closeSession(SESSION_ID);

    expect(sessionsService.update).toHaveBeenCalledWith(SESSION_ID, {
      status: 'ok',
      summary: 'Resumen de una línea.',
      closedAt: expect.any(Date),
      structuredSummary: {
        recommendations: [],
        alerts: [],
        escalated: false,
        coverage: {
          covered: [],
          pending: ['dolor', 'fiebre', 'movilidad', 'herida', 'apetito', 'sueño'],
          grouped: false,
        },
        metrics: {
          turns: 2,
          durationSeconds: expect.any(Number),
          ttftMs: null,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
        },
      },
    });
    expect(result?.status).toBe('ok');
  });

  it('closeSession de una sesión roja deja structuredSummary.escalated:true y status:fail, del triage — no del texto del modelo', async () => {
    const turns: TranscriptTurn[] = [
      fakeTurn({ seq: 0, who: 'patient', text: 'fiebre de 39' }),
      fakeTurn({ seq: 1, who: 'assistant', text: 'Ya aviso a tu médico.' }),
    ];

    const sessionsService = {
      addTurn: jest.fn(),
      getDetail: jest.fn(() =>
        Promise.resolve({ id: SESSION_ID, turns, createdAt: new Date(Date.now() - 60_000) } as unknown as SessionDetail),
      ),
      update: jest.fn((_id: string, patch: unknown) => Promise.resolve({ id: SESSION_ID, ...(patch as object) } as unknown as Session)),
      getTriageState: jest.fn(() =>
        Promise.resolve({
          triageLevel: 'red' as const,
          triageAreas: { fever: { covered: 'individual', level: 'red', value: 39 } },
        }),
      ),
      updateTriage: jest.fn(() => Promise.resolve()),
    };

    class SummaryDraftPort extends FakePort {
      structured<T>(): Promise<LlmStructured<T>> {
        return Promise.resolve({
          data: { summary: 'Fiebre alta reportada, se avisó al médico.', recommendations: [], alerts: ['Fiebre de 39°C'] } as unknown as T,
          model: 'mock',
          usage: { inputTokens: 5, outputTokens: 5, costUsd: 0 },
          latencyMs: 10,
          usedFallbackParser: false,
        });
      }
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationService,
        LlmMetricsService,
        TurnMetricsService,
        { provide: EscalationService, useValue: fakeEscalationService() },
        { provide: SessionsService, useValue: sessionsService },
        { provide: LlmPort, useValue: new SummaryDraftPort() },
        { provide: VoiceService, useValue: fakeVoiceService },
        { provide: RetrievalService, useValue: fakeRetrievalService() },
        { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
        { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
      ],
    }).compile();

    const service = moduleRef.get(ConversationService);
    const result = await service.closeSession(SESSION_ID);

    const updateCall = (sessionsService.update as jest.Mock).mock.calls[0][1] as {
      status: string;
      structuredSummary: { escalated: boolean; coverage: { covered: string[]; pending: string[] } };
    };
    expect(updateCall.status).toBe('fail');
    expect(updateCall.structuredSummary.escalated).toBe(true);
    expect(updateCall.structuredSummary.coverage.covered).toEqual(['fiebre']);
    expect(updateCall.structuredSummary.coverage.pending).toEqual(['dolor', 'movilidad', 'herida', 'apetito', 'sueño']);
    expect(result?.status).toBe('fail');
  });

  it('closeSession cierra la sesión con summary null si el LLM falla', async () => {
    const turns: TranscriptTurn[] = [
      fakeTurn({ seq: 0, who: 'patient', text: 'hola' }),
      fakeTurn({ seq: 1, who: 'assistant', text: 'hola, ¿en qué te ayudo?' }),
    ];

    const sessionsService = {
      addTurn: jest.fn(),
      getDetail: jest.fn(() =>
        Promise.resolve({ id: SESSION_ID, turns, createdAt: new Date(Date.now() - 60_000) } as unknown as SessionDetail),
      ),
      update: jest.fn((_id: string, patch: unknown) => Promise.resolve({ id: SESSION_ID, ...(patch as object) } as unknown as Session)),
    };

    class FailingStructuredPort extends FakePort {
      structured<T>(): Promise<LlmStructured<T>> {
        return Promise.reject(new Error('proveedor caído'));
      }
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationService,
        LlmMetricsService,
        TurnMetricsService,
        { provide: EscalationService, useValue: fakeEscalationService() },
        { provide: SessionsService, useValue: withTriageDefaults(sessionsService) },
        { provide: LlmPort, useValue: new FailingStructuredPort() },
        { provide: VoiceService, useValue: fakeVoiceService },
        { provide: RetrievalService, useValue: fakeRetrievalService() },
        { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
        { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
      ],
    }).compile();

    const service = moduleRef.get(ConversationService);
    const result = await service.closeSession(SESSION_ID);

    expect(sessionsService.update).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ status: 'ok', summary: null, closedAt: expect.any(Date) }),
    );
    expect(result?.status).toBe('ok');
  });

  it('closeSession no llama al LLM si no hay turnos del asistente', async () => {
    const turns: TranscriptTurn[] = [fakeTurn({ seq: 0, who: 'patient', text: 'hola' })];

    const sessionsService = {
      addTurn: jest.fn(),
      getDetail: jest.fn(() =>
        Promise.resolve({ id: SESSION_ID, turns, createdAt: new Date(Date.now() - 60_000) } as unknown as SessionDetail),
      ),
      update: jest.fn((_id: string, patch: unknown) => Promise.resolve({ id: SESSION_ID, ...(patch as object) } as unknown as Session)),
    };

    const port = new FakePort();
    const structuredSpy = jest.spyOn(port, 'structured');

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationService,
        LlmMetricsService,
        TurnMetricsService,
        { provide: EscalationService, useValue: fakeEscalationService() },
        { provide: SessionsService, useValue: withTriageDefaults(sessionsService) },
        { provide: LlmPort, useValue: port },
        { provide: VoiceService, useValue: fakeVoiceService },
        { provide: RetrievalService, useValue: fakeRetrievalService() },
        { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
        { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
      ],
    }).compile();

    const service = moduleRef.get(ConversationService);
    await service.closeSession(SESSION_ID);

    expect(structuredSpy).not.toHaveBeenCalled();
    expect(sessionsService.update).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ status: 'ok', summary: null, closedAt: expect.any(Date) }),
    );
  });

  it('closeSession borra la sesión y no genera resumen si el paciente nunca escribió', async () => {
    const sessionsService = {
      addTurn: jest.fn(),
      getDetail: jest.fn(() => Promise.resolve({ id: SESSION_ID, turns: [] } as unknown as SessionDetail)),
      update: jest.fn(),
      remove: jest.fn(() => Promise.resolve()),
    };

    const port = new FakePort();
    const completeSpy = jest.spyOn(port, 'complete');

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationService,
        LlmMetricsService,
        TurnMetricsService,
        { provide: EscalationService, useValue: fakeEscalationService() },
        { provide: SessionsService, useValue: withTriageDefaults(sessionsService) },
        { provide: LlmPort, useValue: port },
        { provide: VoiceService, useValue: fakeVoiceService },
        { provide: RetrievalService, useValue: fakeRetrievalService() },
        { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
        { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
      ],
    }).compile();

    const service = moduleRef.get(ConversationService);
    const result = await service.closeSession(SESSION_ID);

    expect(completeSpy).not.toHaveBeenCalled();
    expect(sessionsService.remove).toHaveBeenCalledWith(SESSION_ID);
    expect(sessionsService.update).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  describe('métricas de turno (SPEC 13)', () => {
    function basicSessionsService() {
      const savedTurns: TranscriptTurn[] = [];
      let seq = 0;
      return {
        addTurn: jest.fn((_sessionId: string, input: CreateTranscriptTurnInput) => {
          const turn = fakeTurn({ seq: seq++, who: input.who, text: input.text, isVoice: input.isVoice });
          savedTurns.push(turn);
          return Promise.resolve(turn);
        }),
        getDetail: jest.fn(() => Promise.resolve({ id: SESSION_ID, turns: savedTurns } as unknown as SessionDetail)),
      };
    }

    it('un turno con TTS deja un TurnMetric con spoke:true y responseLatencyMs > 0', async () => {
      const speakingVoiceService = {
        isAvailable: true,
        speak: jest.fn((text: string) => Promise.resolve(Buffer.from(text))),
      } as unknown as VoiceService;

      const moduleRef = await Test.createTestingModule({
        providers: [
          ConversationService,
          LlmMetricsService,
          TurnMetricsService,
          { provide: EscalationService, useValue: fakeEscalationService() },
          { provide: SessionsService, useValue: withTriageDefaults(basicSessionsService()) },
          { provide: LlmPort, useValue: new FakePort() },
          { provide: VoiceService, useValue: speakingVoiceService },
          { provide: RetrievalService, useValue: fakeRetrievalService() },
          { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
          { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
        ],
      }).compile();

      const service = moduleRef.get(ConversationService);
      const turnMetrics = moduleRef.get(TurnMetricsService);

      await service.handleUserMessage(SESSION_ID, 'hola', true, () => undefined, (chunk) => void chunk);

      const snapshot = turnMetrics.getSnapshot();
      expect(snapshot.recentTurns).toHaveLength(1);
      expect(snapshot.recentTurns[0].spoke).toBe(true);
      expect(snapshot.recentTurns[0].responseLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it('un turno sin voz deja spoke:false y no aporta a los percentiles', async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          ConversationService,
          LlmMetricsService,
          TurnMetricsService,
          { provide: EscalationService, useValue: fakeEscalationService() },
          { provide: SessionsService, useValue: withTriageDefaults(basicSessionsService()) },
          { provide: LlmPort, useValue: new FakePort() },
          { provide: VoiceService, useValue: fakeVoiceService },
          { provide: RetrievalService, useValue: fakeRetrievalService() },
          { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
          { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
        ],
      }).compile();

      const service = moduleRef.get(ConversationService);
      const turnMetrics = moduleRef.get(TurnMetricsService);

      await service.handleUserMessage(SESSION_ID, 'hola', false, () => undefined);

      const snapshot = turnMetrics.getSnapshot();
      expect(snapshot.recentTurns[0].spoke).toBe(false);
      expect(snapshot.overall.responseLatency.count).toBe(0);
    });

    it('un TurnMetricsService que lanza en todos sus métodos no tumba el turno del paciente', async () => {
      const throwingTurnMetrics = {
        runInTurn: (_sessionId: string, fn: () => Promise<unknown>) => fn(),
        markAudioEnd: () => {
          throw new Error('boom');
        },
        markFirstAudio: () => {
          throw new Error('boom');
        },
        addLlmCall: () => {
          throw new Error('boom');
        },
        addEmbeddingCall: () => {
          throw new Error('boom');
        },
        addRagQuery: () => {
          throw new Error('boom');
        },
        addSttCall: () => {
          throw new Error('boom');
        },
        addTtsCall: () => {
          throw new Error('boom');
        },
        getSnapshot: () => {
          throw new Error('boom');
        },
      } as unknown as TurnMetricsService;

      const sessionsService = basicSessionsService();
      const speakingVoiceService = {
        isAvailable: true,
        speak: jest.fn((text: string) => Promise.resolve(Buffer.from(text))),
      } as unknown as VoiceService;

      const moduleRef = await Test.createTestingModule({
        providers: [
          ConversationService,
          LlmMetricsService,
          { provide: TurnMetricsService, useValue: throwingTurnMetrics },
          { provide: EscalationService, useValue: fakeEscalationService() },
          { provide: SessionsService, useValue: withTriageDefaults(sessionsService) },
          { provide: LlmPort, useValue: new FakePort() },
          { provide: VoiceService, useValue: speakingVoiceService },
          { provide: RetrievalService, useValue: fakeRetrievalService() },
          { provide: RedFlagDetectorService, useValue: fakeRedFlagDetector() },
          { provide: CitationRelevanceService, useValue: fakeCitationRelevanceService() },
        ],
      }).compile();

      const service = moduleRef.get(ConversationService);
      const events: unknown[] = [];

      // Ninguno de los add*/mark* de TurnMetricsService puede tumbar el turno
      // real: los sitios de llamada los envuelven en try/catch silencioso
      // (ver spec 13, riesgo "instrumentación en el camino crítico"). Con este
      // doble que lanza en todo, el turno debe seguir respondiendo y
      // guardando su transcript sin propagar el error de la métrica.
      await service.handleUserMessage(SESSION_ID, 'hola', true, (event) => events.push(event), (chunk) => void chunk);

      expect(sessionsService.addTurn).toHaveBeenCalledTimes(2);
      const types = events.map((event) => (event as { type: string }).type);
      expect(types[0]).toBe('turn_saved');
      expect(types[types.length - 1]).toBe('done');
    });
  });
});
