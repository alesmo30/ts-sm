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

import { SUMMARY_PROMPT, buildGreetingTrigger, buildSystemPrompt } from './conversation.prompt';
import { buildKnowledgeUpdateText } from './system-turns';
import { EscalationMarkerFilter, NoReferenceMarkerFilter, sanitizeAssistantText } from './text-sanitizer';

const ESCALATION_COUNTDOWN_SECONDS = 10;
const REFRESH_EVERY_N_TURNS = 3;

function turnToLlmMessage(turn: TranscriptTurn): LlmMessage {
  return {
    role: turn.who === 'patient' ? 'user' : 'assistant',
    content: turn.text,
  };
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

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
    // paciente no siempre usa (ver riesgos de ts_rank en specs/07).
    const lastAssistantTurn = [...detail.turns].reverse().find((turn) => turn.who === 'assistant');
    const retrievalQuery = [lastAssistantTurn?.text, text].filter(Boolean).join(' ');
    const rawCitations = await this.retrievalService.search(retrievalQuery);
    // El retrieval léxico (ts_rank) siempre trae top-K en cuanto coincide una
    // sola palabra genérica ("control", "cita") con un documento, aunque no
    // responda nada — este filtro por similitud de embeddings es lo que
    // decide qué citas son realmente relevantes (ver citation-relevance.config.ts).
    const citations = await this.citationRelevance.filterRelevant(retrievalQuery, rawCitations);
    this.logger.log(
      `retrieval query="${retrievalQuery}" citations=${rawCitations.length} relevantes=${citations.length}`,
    );

    const messages: LlmMessage[] = [
      { role: 'system', content: buildSystemPrompt(citations) },
      ...detail.turns.map(turnToLlmMessage),
    ];

    // Backstop determinístico (specs/problema-escalamiento-bloque5.md): el LLM
    // no emite [[ESCALAR]] de forma confiable, así que en paralelo se compara
    // el mensaje del paciente por similitud de embeddings contra frases de
    // alarma clínica. Cualquiera de las dos señales dispara la escalada (OR).
    const [llmEscalated, backstop] = await Promise.all([
      this.streamAssistantResponse(sessionId, messages, emit, emitAudio, citations),
      this.redFlagDetector.check(text),
    ]);
    this.logger.log(`red-flag backstop score=${backstop.score.toFixed(3)} triggered=${backstop.triggered}`);
    const escalationDetected = llmEscalated || backstop.triggered;

    if (escalationDetected) {
      const reason = detectEscalationReason(text);
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

    return this.streamAssistantResponse(sessionId, messages, emit, emitAudio);
  }

  private async streamAssistantResponse(
    sessionId: string,
    messages: LlmMessage[],
    emit: (event: ServerEvent) => void,
    emitAudio?: (chunk: Buffer) => void,
    citations: Citation[] = [],
  ): Promise<boolean> {
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
        return escalationFilter.escalationDetected;
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
        return false;
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
    return closed;
  }
}
