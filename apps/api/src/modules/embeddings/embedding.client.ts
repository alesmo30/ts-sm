import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

import { TurnMetricsService } from '../metrics/turn-metrics';

import type { EmbeddingConfig } from './embedding.config';
import { EMBEDDING_CONFIG } from './embedding.tokens';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Cliente compartido de embeddings (Gemini/AI Studio) — encoder, no LLM
 * generativo, permitido por la zona gris de REGLAS.md (líneas 63-78). Usado
 * por RedFlagDetectorService (backstop de escalada, specs/problema-escalamiento-bloque5.md)
 * y CitationRelevanceService (filtrado de citas irrelevantes).
 *
 * gemini-embedding-001 no soporta batchEmbedContents de forma síncrona (solo
 * embedContent y asyncBatchEmbedContent, que es un job asíncrono) — cada
 * texto se embebe con su propia petición.
 */
export interface EmbedOptions {
  outputDimensionality?: number; // sin especificar → 3072 (comportamiento actual, sin cambios)
}

@Injectable()
export class EmbeddingClient {
  private readonly logger = new Logger(EmbeddingClient.name);

  constructor(
    @Inject(EMBEDDING_CONFIG) private readonly config: EmbeddingConfig,
    @Optional() private readonly turnMetrics?: TurnMetricsService,
  ) {}

  get isAvailable(): boolean {
    return !!this.config.apiKey;
  }

  embedBatch(texts: string[], options?: EmbedOptions): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embedOne(text, options)));
  }

  async embedOne(text: string, options?: EmbedOptions): Promise<number[]> {
    // SPEC 13 — cuenta aparte de llmCalls (Gemini es encoder, no el LLM
    // generativo). Una falla acá nunca puede tumbar la llamada real.
    try {
      this.turnMetrics?.addEmbeddingCall();
    } catch (error) {
      this.logger.debug(
        `No fue posible registrar la métrica de turno para este embedding: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const url = `${GEMINI_API_BASE}/models/${this.config.model}:embedContent?key=${this.config.apiKey}`;
    const body = {
      model: `models/${this.config.model}`,
      content: { parts: [{ text }] },
      ...(options?.outputDimensionality ? { outputDimensionality: options.outputDimensionality } : {}),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Gemini embeddings respondió ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as { embedding: { values: number[] } };
    return data.embedding.values;
  }
}
