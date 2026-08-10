import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Citation } from '@ts-sm/shared';

import { cosineSimilarity, EmbeddingClient } from '../embeddings/embedding.client';

import type { CitationRelevanceConfig } from './citation-relevance.config';
import { CITATION_RELEVANCE_CONFIG } from './citation-relevance.tokens';

/**
 * Filtra las citas que trae RetrievalService (ts_rank léxico) por similitud
 * semántica real contra la pregunta del paciente. El retrieval léxico siempre
 * devuelve top-K en cuanto coincide una sola palabra, aunque sea genérica
 * ("control", "cita") y el documento no responda nada — eso hacía que el
 * paciente viera citas de documentos irrelevantes incluso cuando el asistente
 * decía honestamente "no tengo información sobre eso". Este filtro es lo que
 * decide qué citas se muestran y con qué se fundamenta la respuesta del LLM.
 *
 * Fail-open por diseño: sin GEMINI_API_KEY, o si Gemini falla, devuelve las
 * citas de retrieval sin filtrar — nunca bloquea una respuesta por esto.
 */
@Injectable()
export class CitationRelevanceService {
  private readonly logger = new Logger(CitationRelevanceService.name);

  constructor(
    @Inject(CITATION_RELEVANCE_CONFIG) private readonly config: CitationRelevanceConfig,
    private readonly embeddingClient: EmbeddingClient,
  ) {}

  async filterRelevant(query: string, citations: Citation[]): Promise<Citation[]> {
    if (citations.length === 0 || !this.embeddingClient.isAvailable) {
      return citations;
    }

    try {
      const [queryVector, ...snippetVectors] = await this.embeddingClient.embedBatch([
        query,
        ...citations.map((citation) => citation.snippet),
      ]);

      return citations.filter((_, index) => cosineSimilarity(queryVector, snippetVectors[index]) >= this.config.threshold);
    } catch (error) {
      this.logger.error(
        `Filtro de relevancia de citas falló, se muestran sin filtrar: ${error instanceof Error ? error.message : String(error)}`,
      );
      return citations;
    }
  }
}
