import { Injectable, Logger } from '@nestjs/common';
import type { Citation, ServerEvent, Session, TranscriptTurn } from '@ts-sm/shared';

import { RetrievalService } from '../knowledge/retrieval.service';
import { LlmPort } from '../llm/llm.port';
import type { LlmMessage } from '../llm/llm.types';
import { LlmMetricsService } from '../llm/metrics';
import { SessionsService } from '../sessions/sessions.service';
import { PhraseSegmenter, VoiceService, type SttSession } from '../voice/voice.service';

import { GREETING_TRIGGER, SUMMARY_PROMPT, buildSystemPrompt } from './conversation.prompt';
import { sanitizeAssistantText } from './text-sanitizer';

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
  ) {}

  /** Abre el socket de STT para un turno hablado. Lanza si la voz no está configurada. */
  startVoiceInput(): Promise<SttSession> {
    return this.voiceService.startTranscription();
  }

  async handleUserMessage(
    sessionId: string,
    text: string,
    isVoice: boolean,
    emit: (event: ServerEvent) => void,
    emitAudio?: (chunk: Buffer) => void,
  ): Promise<void> {
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
    const citations = await this.retrievalService.search(retrievalQuery);
    this.logger.log(`retrieval query="${retrievalQuery}" citations=${citations.length}`);

    const messages: LlmMessage[] = [
      { role: 'system', content: buildSystemPrompt(citations) },
      ...detail.turns.map(turnToLlmMessage),
    ];

    await this.streamAssistantResponse(sessionId, messages, emit, emitAudio, citations);
  }

  /** Turno inicial: el agente saluda primero, sin turno de paciente que lo preceda. */
  async startConversation(
    sessionId: string,
    emit: (event: ServerEvent) => void,
    emitAudio?: (chunk: Buffer) => void,
  ): Promise<void> {
    emit({ type: 'greeting_start' });

    const messages: LlmMessage[] = [
      { role: 'system', content: buildSystemPrompt([]) },
      { role: 'user', content: GREETING_TRIGGER },
    ];

    await this.streamAssistantResponse(sessionId, messages, emit, emitAudio);
  }

  private async streamAssistantResponse(
    sessionId: string,
    messages: LlmMessage[],
    emit: (event: ServerEvent) => void,
    emitAudio?: (chunk: Buffer) => void,
    citations: Citation[] = [],
  ): Promise<void> {
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

    await this.metrics.runInScope(async () => {
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
            const clean = sanitizeAssistantText(delta.text);
            assembled += clean;
            emit({ type: 'delta', text: clean });

            if (segmenter) {
              for (const phrase of segmenter.push(clean)) {
                enqueuePhrase(phrase);
              }
            }
          } else if (delta.type === 'done') {
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

        const assistantTurn = await this.sessionsService.addTurn(sessionId, {
          sessionId,
          who: 'assistant',
          text: assembled,
          isVoice: spoke,
          at: new Date(),
          citations,
        });
        emit({ type: 'done', turn: assistantTurn });
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

    return this.sessionsService.update(sessionId, { status: 'ok', summary });
  }
}
