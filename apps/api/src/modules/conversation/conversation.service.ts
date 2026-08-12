import { Injectable, Logger } from '@nestjs/common';
import type { Citation, ServerEvent, Session, SessionSummary, TranscriptTurn } from '@ts-sm/shared';

import { normalizeColloquialSpeech } from '../escalation/colloquial-glossary';
import { detectEscalationReason, EscalationService } from '../escalation/escalation.service';
import { RedFlagDetectorService } from '../escalation/red-flag-detector.service';
import {
  accumulatedLevel,
  ALL_AREAS,
  AREA_LABELS,
  detectAskedAreas,
  evaluate as evaluateTriage,
  maxLevel,
  mergeTriageAreas,
  pendingAreas,
  type TriageAreas,
  type TriageLevel,
} from '../escalation/triage.rules';
import { CitationRelevanceService } from '../knowledge/citation-relevance.service';
import { RetrievalService } from '../knowledge/retrieval.service';
import { LlmPort } from '../llm/llm.port';
import type { LlmMessage } from '../llm/llm.types';
import { LlmMetricsService } from '../llm/metrics';
import { TurnMetricsService } from '../metrics/turn-metrics';
import { SessionsService } from '../sessions/sessions.service';
import { PhraseSegmenter, VoiceService, type SttSession } from '../voice/voice.service';

import {
  buildGreetingTrigger,
  buildSystemPrompt,
  MULTI_QUERY_REPHRASE_PROMPT,
  QueryVariationsSchema,
  SUMMARY_DRAFT_PROMPT,
  SummaryDraftSchema,
} from './conversation.prompt';
import { buildKnowledgeUpdateText } from './system-turns';
import { EscalationMarkerFilter, GroupedConfirmationMarkerFilter, NoReferenceMarkerFilter, sanitizeAssistantText } from './text-sanitizer';

const ESCALATION_COUNTDOWN_SECONDS = 20;
const REFRESH_EVERY_N_TURNS = 3;

// SPEC 10 — mapeo fijo entre el vocabulario clínico del triage y el semáforo
// que sessions.status ya expone y que SessionTable/PriorityTable ya pintan.
const TRIAGE_TO_STATUS: Record<TriageLevel, 'ok' | 'attn' | 'fail'> = {
  green: 'ok',
  yellow: 'attn',
  red: 'fail',
};

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

// Bug reportado en QA manual: tras [[ESCALAR]], el prompt hace una pregunta
// disyuntiva ("¿quieres comentarme algo más, o prefieres cerrar ya?") — un
// "sí" corto ahí es genuinamente ambiguo entre las dos opciones, así que NO
// se reutiliza AFFIRMATIVE_TOKENS/isShortAffirmative (ese vocabulario es para
// una pregunta de sí/no simple, no disyuntiva). Vocabulario cerrado propio,
// mismo criterio que FAREWELL_PHRASES: nunca una segunda llamada al LLM solo
// para clasificar esto (REGLAS.md). Ver problema-cierre-confirmado-post-escalacion.md.
const CLOSE_CONFIRMATION_PHRASES = [
  'cerremos ya',
  'cerremos',
  'cerrar ya',
  'cierra ya',
  'ya podemos cerrar',
  'podemos cerrar',
  'prefiero cerrar',
  'quiero cerrar',
  'cierra la sesion',
  'cierra la conversacion',
  'terminemos',
  'terminemos ya',
];

function isCloseConfirmation(text: string): boolean {
  const normalized = normalize(text);
  return CLOSE_CONFIRMATION_PHRASES.some((phrase) => normalized.includes(phrase));
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

  // SPEC 10 — marca, por sesión, que el turno anterior del asistente agrupó las
  // áreas pendientes del guion clínico en una sola pregunta de confirmación. Si
  // el paciente confirma en el turno siguiente sin mencionar ninguna alarma, esas
  // áreas quedan cubiertas por confirmación agrupada en vez de una por una.
  private readonly pendingGroupedConfirmationBySession = new Map<string, boolean>();

  // Marca, por sesión, que el turno de asistente que se acaba de guardar
  // terminó en [[ESCALAR]] — es decir, que el prompt le hizo al paciente la
  // pregunta de cierre ("¿quieres comentarme algo más, o prefieres cerrar
  // ya?"). Se pone en true en TODO turno con [[ESCALAR]], no solo el primero:
  // el prompt repite esa pregunta en cada escalada, incluida una repetida
  // (ver problema-cierre-confirmado-post-escalacion.md).
  private readonly pendingCloseConfirmationBySession = new Map<string, boolean>();

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly llmPort: LlmPort,
    private readonly metrics: LlmMetricsService,
    private readonly voiceService: VoiceService,
    private readonly retrievalService: RetrievalService,
    private readonly citationRelevance: CitationRelevanceService,
    private readonly escalationService: EscalationService,
    private readonly redFlagDetector: RedFlagDetectorService,
    private readonly turnMetrics: TurnMetricsService,
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

  /**
   * Devuelve true si el agente emitió la marca de escalada en esta respuesta.
   *
   * `audioEndAt` es la marca de `Date.now()` que el gateway tomó al terminar
   * de transcribir el `audio_end` de este mismo socket (SPEC 13) — `null`/`undefined`
   * en turnos escritos, o si el turno hablado no tuvo un `audio_end` propio.
   */
  handleUserMessage(
    sessionId: string,
    text: string,
    isVoice: boolean,
    emit: (event: ServerEvent) => void,
    emitAudio?: (chunk: Buffer) => void,
    audioEndAt?: number | null,
  ): Promise<boolean> {
    return this.turnMetrics.runInTurn(sessionId, () =>
      this.handleUserMessageInner(sessionId, text, isVoice, emit, emitAudio, audioEndAt),
    );
  }

  private async handleUserMessageInner(
    sessionId: string,
    text: string,
    isVoice: boolean,
    emit: (event: ServerEvent) => void,
    emitAudio?: (chunk: Buffer) => void,
    audioEndAt?: number | null,
  ): Promise<boolean> {
    if (audioEndAt !== null && audioEndAt !== undefined) {
      this.turnMetrics.markAudioEnd(audioEndAt);
    }

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

    // El turno de asistente anterior pudo terminar en [[ESCALAR]], que
    // siempre cierra preguntando si el paciente quiere cerrar ya — si este
    // mensaje confirma eso, se cierra la sesión de verdad (mismo camino que
    // el botón/modal), en vez de seguir el flujo normal de streaming. Bug
    // reportado: sin esto, la conversación queda colgada esperando una
    // respuesta que nunca llega (ver problema-cierre-confirmado-post-escalacion.md).
    const closeWasOffered = this.pendingCloseConfirmationBySession.get(sessionId) ?? false;
    this.pendingCloseConfirmationBySession.delete(sessionId);
    if (closeWasOffered && isCloseConfirmation(text)) {
      const closed = await this.closeSession(sessionId);
      if (closed) {
        emit({ type: 'session_closed', session: closed });
      }
      return true;
    }

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

    // SPEC 10 — triage determinístico: se corre sobre el texto del paciente en
    // cada turno, independiente de la respuesta del LLM. `covered`/`triage_level`
    // solo pueden subir de severidad (RC.3) — nunca se leen para bajarlos.
    // SPEC 12 — solo esta copia se normaliza (modismos/diminutivos coloquiales
    // colombianos y conjugaciones de "dormir" que triage.rules no reconoce
    // literalmente). El `text` original sigue intacto para el transcript
    // guardado y para `retrievalQuery` más abajo.
    const triageSignals = evaluateTriage(normalizeColloquialSpeech(text));
    const groupedConfirmationWasPending = this.pendingGroupedConfirmationBySession.get(sessionId) ?? false;
    this.pendingGroupedConfirmationBySession.delete(sessionId);
    // La pregunta de confirmación agrupada nombra las áreas pendientes por su
    // etiqueta ("herida, apetito y sueño, ¿todo sin novedad?") para que el
    // paciente sepa a qué está respondiendo — pero eso significa que
    // detectAskedAreas() las reconocería como "preguntadas una a una" y las
    // cubriría como 'individual' antes de que mergeTriageAreas() llegue a
    // aplicar `grouped`. Se omite en este turno: esas áreas las cubre
    // exclusivamente la rama `grouped` de mergeTriageAreas().
    const askedAreas = groupedConfirmationWasPending ? [] : detectAskedAreas(lastAssistantTurn?.text ?? '');

    const triageStateBefore = await this.sessionsService.getTriageState(sessionId);
    const triageAreasBefore = (triageStateBefore.triageAreas as TriageAreas) ?? {};
    const nextTriageAreas = mergeTriageAreas(triageAreasBefore, triageSignals, askedAreas, groupedConfirmationWasPending);
    const nextTriageLevel = maxLevel([
      triageStateBefore.triageLevel,
      ...triageSignals.map((signal) => signal.level),
      accumulatedLevel(nextTriageAreas),
    ]);
    await this.sessionsService.updateTriage(sessionId, {
      triageLevel: nextTriageLevel,
      triageAreas: nextTriageAreas,
      status: TRIAGE_TO_STATUS[nextTriageLevel],
    });
    const triageEscalatesThisTurn = nextTriageLevel === 'red';
    this.logger.log(`triage level=${nextTriageLevel} señales=${triageSignals.map((s) => s.area).join(',') || 'ninguna'}`);
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
      { role: 'system', content: buildSystemPrompt(citations, pendingAreas(nextTriageAreas)) },
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
    // Tercer disparador (SPEC 10): nivel rojo de las reglas determinísticas entra
    // al mismo OR que la marca del LLM y el backstop semántico. escalate() es
    // idempotente por UNIQUE(session_id) — llamarlo en cada turno rojo no duplica fila.
    const escalationDetected = streamResult.escalated || backstop.triggered || consentAccepted || triageEscalatesThisTurn;

    // "escalated implica nivel rojo, venga la escalada de donde venga" (decisión
    // de SPEC 10): si la marca del LLM o el backstop semántico dispararon la
    // escalada sin que las reglas numéricas por sí solas llegaran a rojo, el
    // triage de la sesión sube igual — nunca puede quedar una sesión escalada
    // pintada en verde o amarillo en el dashboard del médico.
    if (escalationDetected && nextTriageLevel !== 'red') {
      await this.sessionsService.updateTriage(sessionId, {
        triageLevel: 'red',
        triageAreas: nextTriageAreas,
        status: 'fail',
      });
    }

    // El turno que acaba de generarse es el que decide si HAY que esperar un
    // "sí" en el próximo — no el que se acaba de consumir arriba.
    if (streamResult.noReferenceDetected) {
      this.pendingKnowledgeGapBySession.set(sessionId, true);
    }
    if (streamResult.groupedConfirmationDetected) {
      this.pendingGroupedConfirmationBySession.set(sessionId, true);
    }
    if (streamResult.escalated) {
      this.pendingCloseConfirmationBySession.set(sessionId, true);
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
    const triageState = await this.sessionsService.getTriageState(sessionId);
    const messages: LlmMessage[] = [
      {
        role: 'system',
        content: buildSystemPrompt([], pendingAreas((triageState.triageAreas as TriageAreas) ?? {})),
      },
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
  ): Promise<{ escalated: boolean; noReferenceDetected: boolean; groupedConfirmationDetected: boolean }> {
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
          this.turnMetrics.markFirstAudio();
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
    const groupedConfirmationFilter = new GroupedConfirmationMarkerFilter();

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
            // Las marcas [[ESCALAR]], [[SIN_REFERENCIA]] y [[CONFIRMACION_AGRUPADA]]
            // se filtran sobre el texto crudo del LLM, antes del sanitizador de
            // markdown, para poder retener una cola partida entre dos chunks sin
            // arriesgar que se cuelen en la burbuja. Son mutuamente excluyentes por
            // diseño del prompt, así que encadenar los tres filtros es seguro.
            const safeRaw = groupedConfirmationFilter.push(noReferenceFilter.push(escalationFilter.push(delta.text)));
            const clean = sanitizeAssistantText(safeRaw);
            assembled += clean;
            if (clean) emit({ type: 'delta', text: clean });

            if (segmenter && clean) {
              for (const phrase of segmenter.push(clean)) {
                enqueuePhrase(phrase);
              }
            }
          } else if (delta.type === 'done') {
            const flushedRaw =
              groupedConfirmationFilter.push(noReferenceFilter.push(escalationFilter.flush()) + noReferenceFilter.flush()) +
              groupedConfirmationFilter.flush();
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
          groupedConfirmationDetected: groupedConfirmationFilter.groupedConfirmationDetected,
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
        return { escalated: false, noReferenceDetected: false, groupedConfirmationDetected: false };
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
    const triageState = await this.sessionsService.getTriageState(sessionId);
    const triageAreas = (triageState.triageAreas as TriageAreas) ?? {};

    let summary: string | null = null;
    let recommendations: string[] = [];
    let alerts: string[] = [];

    if (hasAssistantTurn) {
      const draft = await this.metrics.runInScope(async () => {
        const start = Date.now();
        const messages: LlmMessage[] = [
          { role: 'system', content: SUMMARY_DRAFT_PROMPT },
          ...detail.turns.map(turnToLlmMessage),
          // Cierre explícito en rol 'user': con la conversación terminando en un
          // turno 'assistant' (el caso normal), algunos modelos —confirmado con
          // Llama 3.3 70B en Groq— devuelven finish_reason:'stop' con content
          // vacío si el último mensaje del array no es 'user'. Ver fricción de
          // SPEC 04/plan/PLAN-RENOVADO-KIT.md sobre el cambio de modelo.
          { role: 'user', content: 'Genera el resumen ahora, siguiendo las instrucciones anteriores.' },
        ];

        try {
          const completion = await this.llmPort.structured(messages, {
            schema: SummaryDraftSchema,
            schemaName: 'session_summary_draft',
          });

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
            `provider=${this.llmPort.providerName} model=${completion.model} method=structured(close) latencyMs=${completion.latencyMs}`,
          );

          return completion.data;
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
            `provider=${this.llmPort.providerName} model=${this.llmPort.modelId} method=structured(close) falló: ${error instanceof Error ? error.message : String(error)}`,
          );
          return null;
        }
      });

      if (draft) {
        summary = draft.summary;
        recommendations = draft.recommendations;
        alerts = draft.alerts;
      }
    }

    // RC.3 aplicado al cierre: `escalated` sale del triage determinístico —
    // que la corrección de más arriba fuerza a rojo ante cualquier disparador
    // de escalada, no del texto que el modelo generó para el resumen.
    const escalated = triageState.triageLevel === 'red';
    const durationSeconds = Math.max(0, Math.round((Date.now() - detail.createdAt.getTime()) / 1000));

    const structuredSummary: SessionSummary = {
      recommendations,
      alerts,
      escalated,
      coverage: {
        covered: ALL_AREAS.filter((area) => triageAreas[area] && triageAreas[area]?.covered !== 'no').map(
          (area) => AREA_LABELS[area],
        ),
        pending: pendingAreas(triageAreas).map((area) => AREA_LABELS[area]),
        grouped: Object.values(triageAreas).some((state) => state?.covered === 'grouped'),
      },
      metrics: {
        turns: detail.turns.length,
        durationSeconds,
        ttftMs: null,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
      },
    };

    const closed = await this.sessionsService.update(sessionId, {
      status: TRIAGE_TO_STATUS[triageState.triageLevel],
      summary,
      closedAt: new Date(),
      structuredSummary,
    });
    await this.escalationService.onSessionClosed(sessionId);
    this.pendingKnowledgeGapBySession.delete(sessionId);
    this.pendingGroupedConfirmationBySession.delete(sessionId);
    this.pendingCloseConfirmationBySession.delete(sessionId);
    return closed;
  }
}
