import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { cosineSimilarity, EmbeddingClient } from '../embeddings/embedding.client';

import type { EscalationConfig } from './escalation.config';
import { ESCALATION_CONFIG } from './escalation.tokens';
import { RED_FLAG_PHRASES } from './red-flag-phrases';

export interface RedFlagCheckResult {
  triggered: boolean;
  score: number;
  matchedPhrase: string | null;
}

interface CachedPhraseVector {
  phrase: string;
  vector: number[];
}

/**
 * Backstop determinístico para la escalada (specs/problema-escalamiento-bloque5.md):
 * el LLM conversacional emite `[[ESCALAR]]` de forma inconsistente, así que
 * este servicio corre en paralelo, sin depender de él, y usa similitud de
 * embeddings contra una lista fija de frases de alarma clínica.
 *
 * Fail-open por diseño: sin GEMINI_API_KEY, o si la llamada a Gemini falla,
 * `check()` devuelve `triggered: false` — la escalada sigue funcionando vía
 * la marca del LLM sola, como antes de este servicio existir.
 */
@Injectable()
export class RedFlagDetectorService implements OnModuleInit {
  private readonly logger = new Logger(RedFlagDetectorService.name);
  private cache: CachedPhraseVector[] = [];
  private isAvailable = false;

  constructor(
    @Inject(ESCALATION_CONFIG) private readonly config: EscalationConfig,
    private readonly embeddingClient: EmbeddingClient,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.embeddingClient.isAvailable) {
      this.logger.warn('GEMINI_API_KEY no configurada: backstop de escalada por embeddings desactivado.');
      return;
    }

    try {
      const vectors = await this.embeddingClient.embedBatch(RED_FLAG_PHRASES);
      this.cache = RED_FLAG_PHRASES.map((phrase, i) => ({ phrase, vector: vectors[i] }));
      this.isAvailable = true;
      this.logger.log(`Backstop de escalada por embeddings activo con ${this.cache.length} frases de referencia.`);
    } catch (error) {
      this.logger.error(
        `No fue posible inicializar el backstop de escalada por embeddings: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async check(patientText: string): Promise<RedFlagCheckResult> {
    if (!this.isAvailable) {
      return { triggered: false, score: 0, matchedPhrase: null };
    }

    try {
      const vector = await this.embeddingClient.embedOne(patientText);

      let bestScore = 0;
      let bestPhrase: string | null = null;
      for (const entry of this.cache) {
        const score = cosineSimilarity(vector, entry.vector);
        if (score > bestScore) {
          bestScore = score;
          bestPhrase = entry.phrase;
        }
      }

      return {
        triggered: bestScore > this.config.similarityThreshold,
        score: bestScore,
        matchedPhrase: bestPhrase,
      };
    } catch (error) {
      this.logger.error(
        `Backstop de escalada por embeddings falló, se ignora este turno: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { triggered: false, score: 0, matchedPhrase: null };
    }
  }
}
