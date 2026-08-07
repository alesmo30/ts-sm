import { Injectable, Logger } from '@nestjs/common';
import type { ServerEvent, Session, TranscriptTurn } from '@ts-sm/shared';

import { LlmPort } from '../llm/llm.port';
import type { LlmMessage } from '../llm/llm.types';
import { LlmMetricsService } from '../llm/metrics';
import { SessionsService } from '../sessions/sessions.service';

import { SUMMARY_PROMPT, SYSTEM_PROMPT } from './conversation.prompt';

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
  ) {}

  async handleUserMessage(
    sessionId: string,
    text: string,
    emit: (event: ServerEvent) => void,
  ): Promise<void> {
    const patientTurn = await this.sessionsService.addTurn(sessionId, {
      sessionId,
      who: 'patient',
      text,
      isVoice: false,
      at: new Date(),
      citations: [],
    });
    emit({ type: 'turn_saved', turn: patientTurn });

    const detail = await this.sessionsService.getDetail(sessionId);
    const messages: LlmMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...detail.turns.map(turnToLlmMessage),
    ];

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
            assembled += delta.text;
            emit({ type: 'delta', text: delta.text });
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

        const assistantTurn = await this.sessionsService.addTurn(sessionId, {
          sessionId,
          who: 'assistant',
          text: assembled,
          isVoice: false,
          at: new Date(),
          citations: [],
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

  async closeSession(sessionId: string): Promise<Session> {
    const detail = await this.sessionsService.getDetail(sessionId);
    const hasAssistantTurn = detail.turns.some((turn) => turn.who === 'assistant');

    let summary: string | null = null;

    if (hasAssistantTurn) {
      summary = await this.metrics.runInScope(async () => {
        const start = Date.now();
        const messages: LlmMessage[] = [
          { role: 'system', content: SUMMARY_PROMPT },
          ...detail.turns.map(turnToLlmMessage),
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
