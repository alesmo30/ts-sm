import { Injectable, Logger } from '@nestjs/common';
import type { Citation, ServerEvent, Session, TranscriptTurn } from '@ts-sm/shared';

import { detectEscalationReason, EscalationService } from '../escalation/escalation.service';
import { RedFlagDetectorService } from '../escalation/red-flag-detector.service';
import { CitationRelevanceService } from '../knowledge/citation-relevance.service';
import { RetrievalService } from '../knowledge/retrieval.service';
import { LlmPort } from '../llm/llm.port';
import type { LlmMessage } from '../llm/llm.types';
import { LlmMetricsService } from '../llm/metrics';
import { SessionsService } from '../sessions/sessions.service';
import { PhraseSegmenter, VoiceService, type SttSession } from '../voice/voice.service';

import { MULTI_QUERY_REPHRASE_PROMPT, QueryVariationsSchema, SUMMARY_PROMPT, buildGreetingTrigger, buildSystemPrompt } from './conversation.prompt';
import { buildKnowledgeUpdateText } from './system-turns';
import { EscalationMarkerFilter, NoReferenceMarkerFilter, sanitizeAssistantText } from './text-sanitizer';

const ESCALATION_COUNTDOWN_SECONDS = 20;
const REFRESH_EVERY_N_TURNS = 3;

// Tokens de afirmación cerrados a propósito (no LLM, no embeddings — REGLAS.md
// prohíbe una segunda llamada generativa solo para clasificar un "sí"): una
// frase larga o ambigua del paciente no debe contar como consentimiento a
// que su pregunta pase al médico.
const AFFIRMATIVE_TOKENS = ['si', 'claro', 'dale', 'hagale', 'porfavor', 'ok', 'okay', 'listo', 'obvio', 'bueno'];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¡!¿?.,]/g, '')
    .trim();
}

function isShortAffirmative(text: string): boolean {
  const words = normalize(text).split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return false;
  return words.some((word) => AFFIRMATIVE_TOKENS.includes(word));
}

// El retrieval de este turno concatena el texto del turno anterior del
// asistente con el mensaje del paciente (ver retrievalQuery abajo), porque
// una pregunta de seguimiento corta ("¿y si sangra?") no trae vocabulario
// propio. Eso se vuelve un problema en una despedida: el vocabulario clínico
// del turno anterior queda solo, sube la similitud contra documentos reales
// pero fuera de tema, y aparece una cita nueva sin que el paciente haya
// preguntado nada — bug reportado en QA manual. Ninguna pregunta real termina
// solo en agradecimiento/despedida sin signo de interrogación, así que basta
// con esta heurística cerrada para saltar el retrieval en ese turno.
const FAREWELL_PHRASES = [
  'gracias',
  'hasta luego',
  'hasta pronto',
  'nos vemos',
  'adios',
  'chao',
  'eso es todo',
  'nada mas',
  'ya esta',
  'buenas noches',
  'buen dia',
  'listo asi',
];

function looksLikeFarewell(text: string): boolean {
  if (/[?¿]/.test(text)) return false;
  const normalized = normalize(text);
  return FAREWELL_PHRASES.some((phrase) => normalized.includes(phrase));
}

function turnToLlmMessage(turn: TranscriptTurn): LlmMessage {
  return {
    role: turn.who === 'patient' ? 'user' : 'assistant',
    content: turn.text,
  };
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  // Marca, por sesión, que el turno anterior del asistente declaró un vacío
  // de conocimiento y ofreció redirigir al médico — si el paciente responde
  // con un "sí" corto en el turno siguiente, eso también debe escalar (ver
  // corrección post-SPEC 08). Estado efímero de proceso, igual que
  // socketsBySession del gateway; se limpia al cerrar la sesión.
  private readonly pendingKnowledgeGapBySession = new Map<string, boolean>();

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly llmPort: LlmPort,
    private readonly metrics: LlmMetricsService,
    private readonly voiceService: VoiceService,
    private readonly retrievalService: RetrievalService,
    private readonly citationRelevance: CitationRelevanceService,
    private readonly escalationService: EscalationService,
    private readonly redFlagDetector: RedFlagDetectorService,
  ) {}

  /** Abre el socket de STT para un turno hablado. Lanza si la voz no está configurada. */
  startVoiceInput(): Promise<SttSession> {
    return this.voiceService.startTranscription();
  }

  /** El paciente cancela la cuenta regresiva: el registro queda, la conversación sigue. */
  cancelEscalation(sessionId: string): Promise<void> {
    return this.escalationService.cancel(sessionId);
  }

  /**
   * Inserta el separador `who: 'system'` en toda sesión abierta al completar
   * una ingesta. El gateway decide a qué sockets emitirlo — acá solo se
   * persiste, así que la fila queda igual aunque no haya nadie conectado.
   */
  async createKnowledgeUpdateTurns(
    referenceName: string,
  ): Promise<{ sessionId: string; turn: TranscriptTurn }[]> {
    const sessionIds = await this.sessionsService.listOpenSessionIds();
    const text = buildKnowledgeUpdateText(referenceName);

    const turns: { sessionId: string; turn: TranscriptTurn }[] = [];
    for (const sessionId of sessionIds) {
      const turn = await this.sessionsService.addTurn(sessionId, {
        sessionId,
        who: 'system',
        text,
        isVoice: false,
        at: new Date(),
        citations: [],
      });
      turns.push({ sessionId, turn });
    }
    return turns;
  }

  /** Devuelve true si el agente emitió la marca de escalada en esta respuesta. */
  async handleUserMessage(
    sessionId: string,
    text: string,
    isVoice: boolean,
    emit: (event: ServerEvent) => void,
    emitAudio?: (chunk: Buffer) => void,
  ): Promise<boolean> {
    const existingSession = await this.sessionsService.getDetail(sessionId);
    if (existingSession.closedAt) {
      emit({ type: 'error', message: 'Esta sesión ya está cerrada.' });
      return false;
    }

    // El turno del asistente anterior pudo declarar un vacío de conocimiento
    // y ofrecer redirigir al médico — si este mensaje es un "sí" corto, es
    // consentimiento a esa redirección y debe escalar igual que una bandera
    // roja o una petición explícita. Se evalúa una sola vez por turno.
    const knowledgeGapWasPending = this.pendingKnowledgeGapBySession.get(sessionId) ?? false;
    this.pendingKnowledgeGapBySession.delete(sessionId);
    const consentAccepted = knowledgeGapWasPending && isShortAffirmative(text);

    const patientTurn = await this.sessionsService.addTurn(sessionId, {
      sessionId,
      who: 'patient',
      text,
      isVoice,
      at: new Date(),
      citations: [],
    });
    emit({ type: 'turn_saved', turn: patientTurn });

    const detail = await this.sessionsService.getDetail(sessionId);

    // La última pregunta del asistente aporta términos clínicos que el
    // paciente no siempre usa (ver riesgos de ts_rank en specs/07). Pero el
    // saludo inicial (siempre seq 0, ver streamAssistantResponse) es texto
    // genérico sin contenido clínico — concatenarlo en el primer mensaje de
    // la sesión diluye el embedding de la consulta y puede tumbar por debajo
    // del umbral una cita que sí es relevante (medido: 0.70 sin saludo vs
    // 0.64 con saludo contra el mismo chunk — bug reportado en QA manual).
    const lastAssistantTurn = [...detail.turns].reverse().find((turn) => turn.who === 'assistant');
    const isGreeting = lastAssistantTurn?.seq === 0;
    const retrievalQuery = [isGreeting ? null : lastAssistantTurn?.text, text].filter(Boolean).join(' ');
    const isFarewell = looksLikeFarewell(text);
    const rawCitations = isFarewell ? [] : await this.hybridSearch(retrievalQuery);
    // El retrieval léxico+semántico siempre trae top-K en cuanto coincide algo,
    // aunque sea genérico ("control", "cita") con un documento, aunque no
    // responda nada — este filtro por similitud de embeddings es lo que
    // decide qué citas son realmente relevantes (ver citation-relevance.config.ts).
    let citations = isFarewell ? [] : await this.citationRelevance.filterRelevant(retrievalQuery, rawCitations);
    this.logger.log(
      `retrieval query="${retrievalQuery}" citations=${rawCitations.length} relevantes=${citations.length}`,
    );

    // SPEC 09 — respaldo de multi-query: la fusión híbrida (léxico+semántico)
    // más el filtro de relevancia no encontraron nada. Se le pide al mismo LLM
    // aprobado 3 reformulaciones de la pregunta, se corre la fusión híbrida
    // por cada una, se une con lo que ya se tenía, y se filtra relevancia una
    // sola vez sobre el pool completo — no un filtro por variación (menos
    // llamadas a embeddings, mismo criterio de corte). Fail-open: si la
    // reformulación falla, la conversación sigue sin citas, sin error visible.
    if (!isFarewell && citations.length === 0) {
      const variations = await this.getQueryVariations(retrievalQuery);
      if (variations.length > 0) {
        const variationResults = await Promise.all(variations.map((variation) => this.hybridSearch(variation)));
        const pool = this.dedupeCitationsByChunkId([rawCitations, ...variationResults].flat());
        citations = await this.citationRelevance.filterRelevant(retrievalQuery, pool);
        this.logger.log(
          `multi-query fallback variations=${variations.length} pool=${pool.length} relevantes=${citations.length}`,
        );
      }
    }

    const messages: LlmMessage[] = [
      { role: 'system', content: buildSystemPrompt(citations) },
      ...detail.turns.map(turnToLlmMessage),
    ];

    // Backstop determinístico (specs/problema-escalamiento-bloque5.md): el LLM
    // no emite [[ESCALAR]] de forma confiable, así que en paralelo se compara
    // el mensaje del paciente por similitud de embeddings contra frases de
    // alarma clínica. Cualquiera de las dos señales dispara la escalada (OR).
    const [streamResult, backstop] = await Promise.all([
      this.streamAssistantResponse(sessionId, messages, emit, emitAudio, citations),
      this.redFlagDetector.check(text),
    ]);
    this.logger.log(`red-flag backstop score=${backstop.score.toFixed(3)} triggered=${backstop.triggered}`);
    const escalationDetected = streamResult.escalated || backstop.triggered || consentAccepted;

    // El turno que acaba de generarse es el que decide si HAY que esperar un
    // "sí" en el próximo — no el que se acaba de consumir arriba.
    if (streamResult.noReferenceDetected) {
      this.pendingKnowledgeGapBySession.set(sessionId, true);
    }

    if (escalationDetected) {
      const reason = consentAccepted ? 'knowledge_gap' : detectEscalationReason(text);
      const created = await this.escalationService.escalate(sessionId, reason);
      if (created) {
        emit({ type: 'escalation_started', reason, countdownSeconds: ESCALATION_COUNTDOWN_SECONDS });
      }
    } else {
      // Refresca el resumen cada N turnos posteriores a una escalada ya
      // creada, nunca en cada mensaje — es un no-op sin fila que actualizar.
      const turnsSoFar = detail.turns.length + 2;
      if (turnsSoFar % REFRESH_EVERY_N_TURNS === 0) {
        await this.escalationService.refresh(sessionId);
      }
    }

    return escalationDetected;
  }

  /** Fusión híbrida (léxico + semántico) de RetrievalService — extraído para
   * poder reusarlo tanto en el intento normal como por cada variación del
   * respaldo de multi-query (SPEC 09). */
  private hybridSearch(query: string): Promise<Citation[]> {
    return this.retrievalService.search(query);
  }

  /** Fail-open: si la llamada al LLM falla o no cumple el schema, no hay
   * variaciones — el llamador sigue con las citas (o ausencia de citas) que
   * ya tenía, sin propagar el error al paciente. */
  private async getQueryVariations(query: string): Promise<string[]> {
    try {
      const { data } = await this.llmPort.structured(
        [
          { role: 'system', content: MULTI_QUERY_REPHRASE_PROMPT },
          { role: 'user', content: query },
        ],
        { schema: QueryVariationsSchema, schemaName: 'query_variations' },
      );
      return data.variations;
    } catch (error) {
      this.logger.error(
        `Multi-query fallback: no fue posible generar variaciones, se sigue sin citas: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  private dedupeCitationsByChunkId(citations: Citation[]): Citation[] {
    const byChunkId = new Map<string, Citation>();
    for (const citation of citations) {
      if (!byChunkId.has(citation.chunkId)) {
        byChunkId.set(citation.chunkId, citation);
      }
    }
    return [...byChunkId.values()];
  }

  /** Turno inicial: el agente saluda primero, sin turno de paciente que lo preceda. */
  async startConversation(
    sessionId: string,
    emit: (event: ServerEvent) => void,
    emitAudio?: (chunk: Buffer) => void,
  ): Promise<boolean> {
    emit({ type: 'greeting_start' });

    const session = await this.sessionsService.getDetail(sessionId);
    const messages: LlmMessage[] = [
      { role: 'system', content: buildSystemPrompt([]) },
      { role: 'user', content: buildGreetingTrigger(session.patientName, session.procedure) },
    ];

    const { escalated } = await this.streamAssistantResponse(sessionId, messages, emit, emitAudio);
    return escalated;
  }

  private async streamAssistantResponse(
    sessionId: string,
    messages: LlmMessage[],
    emit: (event: ServerEvent) => void,
    emitAudio?: (chunk: Buffer) => void,
    citations: Citation[] = [],
  ): Promise<{ escalated: boolean; noReferenceDetected: boolean }> {
    // Responde en voz siempre que la voz esté configurada, sin importar si el
    // turno del paciente fue hablado o escrito — el agente habla y escribe a la vez.
    const shouldSpeak = this.voiceService.isAvailable && !!emitAudio;
    const segmenter = shouldSpeak ? new PhraseSegmenter() : null;
    let spoke = false;

    // Cola de síntesis encadenada: cada frase se sintetiza y emite en orden,
    // pero SIN bloquear el loop de deltas de abajo. Bloquear ahí (await inline)
    // era el bug real detrás de la sensación de "voz dudando": cada round-trip
    // a Deepgram TTS frenaba también el texto, que debería fluir a la velocidad
    // del LLM sin esperar a que el audio esté listo.
    let ttsChain: Promise<void> = Promise.resolve();
    const enqueuePhrase = (phrase: string): void => {
      if (!emitAudio) return;
      ttsChain = ttsChain.then(async () => {
        try {
          const audio = await this.voiceService.speak(phrase);
          emit({ type: 'tts_start' });
          emitAudio(audio);
          emit({ type: 'tts_end' });
          spoke = true;
        } catch {
          // Un fallo puntual de TTS no interrumpe la conversación: el texto ya llegó por delta.
        }
      });
    };

    const escalationFilter = new EscalationMarkerFilter();
    const noReferenceFilter = new NoReferenceMarkerFilter();

    return this.metrics.runInScope(async () => {
      const start = Date.now();
      let assembled = '';
      let firstTokenSeen = false;

      try {
        for await (const delta of this.llmPort.stream(messages)) {
          if (delta.type === 'text') {
            if (!firstTokenSeen) {
              this.metrics.markFirstToken();
              firstTokenSeen = true;
            }
            // Las marcas [[ESCALAR]] y [[SIN_REFERENCIA]] se filtran sobre el
            // texto crudo del LLM, antes del sanitizador de markdown, para
            // poder retener una cola partida entre dos chunks sin arriesgar
            // que se cuelen en la burbuja. Son mutuamente excluyentes por
            // diseño del prompt, así que encadenar los dos filtros es seguro.
            const safeRaw = noReferenceFilter.push(escalationFilter.push(delta.text));
            const clean = sanitizeAssistantText(safeRaw);
            assembled += clean;
            if (clean) emit({ type: 'delta', text: clean });

            if (segmenter && clean) {
              for (const phrase of segmenter.push(clean)) {
                enqueuePhrase(phrase);
              }
            }
          } else if (delta.type === 'done') {
            const flushedRaw = noReferenceFilter.push(escalationFilter.flush()) + noReferenceFilter.flush();
            const flushedClean = sanitizeAssistantText(flushedRaw);
            if (flushedClean) {
              assembled += flushedClean;
              emit({ type: 'delta', text: flushedClean });
              if (segmenter) {
                for (const phrase of segmenter.push(flushedClean)) {
                  enqueuePhrase(phrase);
                }
              }
            }

            this.metrics.recordCall({
              provider: this.llmPort.providerName,
              model: delta.completion.model,
              method: 'stream',
              inputTokens: delta.completion.usage.inputTokens,
              outputTokens: delta.completion.usage.outputTokens,
              latencyMs: delta.completion.latencyMs,
              ok: true,
            });
            this.logger.log(
              `provider=${this.llmPort.providerName} model=${delta.completion.model} method=stream latencyMs=${delta.completion.latencyMs} inputTokens=${delta.completion.usage.inputTokens} outputTokens=${delta.completion.usage.outputTokens}`,
            );
          }
        }

        if (segmenter) {
          const remaining = segmenter.flush();
          if (remaining) enqueuePhrase(remaining);
        }
        // El texto ya se emitió completo arriba, a la velocidad del LLM. Esta
        // espera es solo para saber si algo llegó a sonar (isVoice del turno) y
        // para no persistir el turno antes de que termine de vaciarse el audio.
        await ttsChain;

        // Si el modelo declaró el límite de conocimiento ([[SIN_REFERENCIA]]),
        // no mostrar las citas recuperadas: son solo lo que trajo la búsqueda
        // léxica, no lo que realmente fundamentó la respuesta (ver
        // GROUNDING_INSTRUCTIONS). Evita citar documentos que el paciente
        // vería como "la fuente de esta respuesta" sin serlo.
        const shownCitations = noReferenceFilter.noReferenceDetected ? [] : citations;

        const assistantTurn = await this.sessionsService.addTurn(sessionId, {
          sessionId,
          who: 'assistant',
          text: assembled,
          isVoice: spoke,
          at: new Date(),
          citations: shownCitations,
        });
        emit({ type: 'done', turn: assistantTurn });
        return {
          escalated: escalationFilter.escalationDetected,
          noReferenceDetected: noReferenceFilter.noReferenceDetected,
        };
      } catch (error) {
        this.metrics.recordCall({
          provider: this.llmPort.providerName,
          model: this.llmPort.modelId,
          method: 'stream',
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - start,
          ok: false,
        });
        this.logger.error(
          `provider=${this.llmPort.providerName} model=${this.llmPort.modelId} method=stream falló: ${error instanceof Error ? error.message : String(error)}`,
        );
        emit({ type: 'error', message: 'No fue posible generar una respuesta. Intenta de nuevo.' });
        return { escalated: false, noReferenceDetected: false };
      }
    });
  }

  async closeSession(sessionId: string): Promise<Session | null> {
    const detail = await this.sessionsService.getDetail(sessionId);
    const hasPatientTurn = detail.turns.some((turn) => turn.who === 'patient');

    if (!hasPatientTurn) {
      await this.sessionsService.remove(sessionId);
      return null;
    }

    const hasAssistantTurn = detail.turns.some((turn) => turn.who === 'assistant');

    let summary: string | null = null;

    if (hasAssistantTurn) {
      summary = await this.metrics.runInScope(async () => {
        const start = Date.now();
        const messages: LlmMessage[] = [
          { role: 'system', content: SUMMARY_PROMPT },
          ...detail.turns.map(turnToLlmMessage),
          // Cierre explícito en rol 'user': con la conversación terminando en un
          // turno 'assistant' (el caso normal), algunos modelos —confirmado con
          // Llama 3.3 70B en Groq— devuelven finish_reason:'stop' con content
          // vacío si el último mensaje del array no es 'user'. Ver fricción de
          // SPEC 04/plan/PLAN-RENOVADO-KIT.md sobre el cambio de modelo.
          { role: 'user', content: 'Genera el resumen ahora, siguiendo las instrucciones anteriores.' },
        ];

        try {
          const completion = await this.llmPort.complete(messages);

          this.metrics.recordCall({
            provider: this.llmPort.providerName,
            model: completion.model,
            method: 'complete',
            inputTokens: completion.usage.inputTokens,
            outputTokens: completion.usage.outputTokens,
            latencyMs: completion.latencyMs,
            ok: true,
          });
          this.logger.log(
            `provider=${this.llmPort.providerName} model=${completion.model} method=complete(close) latencyMs=${completion.latencyMs}`,
          );

          return completion.text;
        } catch (error) {
          this.metrics.recordCall({
            provider: this.llmPort.providerName,
            model: this.llmPort.modelId,
            method: 'complete',
            inputTokens: 0,
            outputTokens: 0,
            latencyMs: Date.now() - start,
            ok: false,
          });
          this.logger.error(
            `provider=${this.llmPort.providerName} model=${this.llmPort.modelId} method=complete(close) falló: ${error instanceof Error ? error.message : String(error)}`,
          );
          return null;
        }
      });
    }

    const closed = await this.sessionsService.update(sessionId, { status: 'ok', summary, closedAt: new Date() });
    await this.escalationService.onSessionClosed(sessionId);
    this.pendingKnowledgeGapBySession.delete(sessionId);
    return closed;
  }
}
